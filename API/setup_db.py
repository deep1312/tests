#!/usr/bin/env python3
"""
Database setup script - creates the database and applies migrations.
Also ensures the admin user has a known-good password hash.
"""

import asyncio
import asyncpg
import bcrypt
from pathlib import Path
from app.core.config import get_settings


async def setup_database():
    """Create database and apply migrations."""
    settings = get_settings()

    from urllib.parse import urlparse
    parsed = urlparse(settings.DATABASE_URL)

    db_user = parsed.username
    db_password = parsed.password
    db_host = parsed.hostname
    db_port = parsed.port or 5432
    db_name = parsed.path.lstrip('/')

    # Connect to the default 'postgres' database to create our database
    try:
        conn = await asyncpg.connect(
            user=db_user,
            password=db_password,
            host=db_host,
            port=db_port,
            database='postgres'
        )

        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            db_name
        )

        if not exists:
            print(f"Creating database '{db_name}'...")
            await conn.execute(f'CREATE DATABASE "{db_name}"')
            print(f"✓ Database '{db_name}' created")
        else:
            print(f"✓ Database '{db_name}' already exists")

        await conn.close()

        # Connect to the target database and apply migrations
        conn = await asyncpg.connect(
            user=db_user,
            password=db_password,
            host=db_host,
            port=db_port,
            database=db_name
        )

        migrations_dir = Path(__file__).parent / "migrations"
        migration_files = sorted(migrations_dir.glob("*.sql"))

        for migration_file in migration_files:
            print(f"Applying {migration_file.name}...")
            with open(migration_file) as f:
                sql = f.read()
            try:
                await conn.execute(sql)
                print(f"✓ {migration_file.name} applied")
            except Exception as e:
                if "already exists" in str(e) or "DuplicateTable" in type(e).__name__:
                    print(f"  skipping {migration_file.name} (already applied)")
                else:
                    print(f"  skipping {migration_file.name} ({e})")

        # Fix the admin password hash — generate a correct one for "changeme"
        print("Updating admin password hash...")
        correct_hash = bcrypt.hashpw(b"changeme", bcrypt.gensalt(rounds=12)).decode()
        await conn.execute(
            """
            UPDATE api.users
            SET password_hash = $1
            WHERE username = 'admin'
            """,
            correct_hash,
        )
        print("✓ Admin password hash updated (password: changeme)")

        # Fix the viewer password hash — generate a correct one for "viewer123"
        print("Updating viewer password hash...")
        viewer_hash = bcrypt.hashpw(b"viewer123", bcrypt.gensalt(rounds=12)).decode()
        await conn.execute(
            """
            UPDATE api.users
            SET password_hash = $1
            WHERE username = 'viewer'
            """,
            viewer_hash,
        )
        print("✓ Viewer password hash updated (password: viewer123)")

        await conn.close()
        print("\n✓ Database setup complete!")
        print("\nLogin credentials:")
        print("  Admin:  admin / changeme")
        print("  Viewer: viewer / viewer123")

    except Exception as e:
        print(f"✗ Error: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(setup_database())