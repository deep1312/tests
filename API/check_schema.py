import asyncio
import asyncpg

async def check():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost:5433/pg_monitoring')
    
    checks_cols = await conn.fetch(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema='config' AND table_name='checks_master' ORDER BY ordinal_position"
    )
    print('checks_master columns:', [r['column_name'] for r in checks_cols])
    
    servers_tags = await conn.fetch(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_schema='config' AND table_name='servers' AND column_name='tags'"
    )
    print('servers.tags:', [(r['column_name'], r['data_type']) for r in servers_tags])
    
    mapping_cols = await conn.fetch(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema='config' AND table_name='server_checks_mapping' ORDER BY ordinal_position"
    )
    print('server_checks_mapping columns:', [r['column_name'] for r in mapping_cols])

    threshold_cols = await conn.fetch(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema='config' AND table_name='check_thresholds' ORDER BY ordinal_position"
    )
    print('check_thresholds columns:', [r['column_name'] for r in threshold_cols])

    await conn.close()

asyncio.run(check())
