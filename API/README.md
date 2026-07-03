# PostgreSQL Health Monitoring Platform - Backend API

A production-ready FastAPI application for monitoring PostgreSQL database health with comprehensive alerting, incident tracking, and audit logging.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [Running the API](#running-the-api)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- **Python**: 3.13 or higher
- **PostgreSQL**: 14 or higher
- **pip**: Python package manager
- **Git**: For version control

### Verify Prerequisites

```bash
python --version  # Should be 3.13+
psql --version    # Should be 14+
pip --version     # Should be 23+
```

## Project Structure

```
api/
├── app/
│   ├── core/                    # Core configuration and utilities
│   │   ├── config.py           # Settings and environment variables
│   │   ├── security.py         # JWT, password hashing, token management
│   │   ├── encryption.py       # AES-256-GCM credential encryption
│   │   └── dependencies.py     # FastAPI dependencies (DB, auth, roles)
│   ├── db/
│   │   └── pool.py             # asyncpg connection pool management
│   ├── middleware/
│   │   ├── request_id.py       # Request ID tracking
│   │   ├── cors.py             # CORS configuration
│   │   ├── auth.py             # JWT validation middleware
│   │   └── rate_limit.py       # Rate limiting (token bucket)
│   ├── models/
│   │   ├── requests/           # Pydantic request models
│   │   └── responses/          # Pydantic response models
│   ├── repositories/           # Data access layer
│   │   ├── server_repo.py
│   │   ├── check_repo.py
│   │   ├── threshold_repo.py
│   │   ├── monitoring_repo.py
│   │   ├── alert_repo.py
│   │   ├── incident_repo.py
│   │   ├── dashboard_repo.py
│   │   ├── audit_repo.py
│   │   └── user_repo.py
│   ├── services/               # Business logic layer
│   │   ├── auth_service.py
│   │   ├── server_service.py
│   │   ├── check_service.py
│   │   ├── threshold_service.py
│   │   ├── monitoring_service.py
│   │   ├── alert_service.py
│   │   ├── incident_service.py
│   │   ├── dashboard_service.py
│   │   ├── audit_service.py
│   │   └── credential_service.py
│   ├── routers/                # API endpoints
│   │   ├── auth.py
│   │   ├── servers.py
│   │   ├── checks.py
│   │   ├── thresholds.py
│   │   ├── monitoring.py
│   │   ├── alerts.py
│   │   ├── incidents.py
│   │   ├── dashboard.py
│   │   ├── audit.py
│   │   └── admin.py
│   ├── utils/
│   │   ├── envelope.py         # Response envelope formatting
│   │   └── pagination.py       # Pagination utilities
│   └── main.py                 # FastAPI app factory
├── migrations/                 # SQL migration files
│   ├── 001_create_api_schema.sql
│   ├── 002_create_users_table.sql
│   ├── 003_create_audit_log_table.sql
│   ├── 004_seed_admin_user.sql
│   └── README.md
├── tests/
│   ├── property/               # Property-based tests (Hypothesis)
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── conftest.py             # pytest configuration
├── requirements.txt            # Python dependencies
├── pyproject.toml              # pytest and Hypothesis configuration
└── README.md                   # This file
```

## Local Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd pg-health-platform/api
```

### 2. Create Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate

# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# On Windows (Command Prompt):
venv\Scripts\activate.bat
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Set Up Environment Variables

Create a `.env` file in the `api/` directory:

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/pg_health_monitoring

# Encryption (generate with: python -c "import base64; print(base64.b64encode(b'0' * 32).decode())")
CREDENTIAL_ENCRYPTION_KEY=MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRY_SECONDS=3600

# Connection Validation
CONNECTION_VALIDATION_MODE=warn  # or 'strict'

# Monitoring
STALENESS_THRESHOLD_SECS=300
RATE_LIMIT_RPM=1000
DB_STATEMENT_TIMEOUT_MS=30000
HIGH_COST_DAYS_THRESHOLD=30

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 5. Set Up PostgreSQL Database

```bash
# Create database
createdb pg_health_monitoring

# Apply migrations
psql -U postgres -d pg_health_monitoring -f migrations/001_create_api_schema.sql
psql -U postgres -d pg_health_monitoring -f migrations/002_create_users_table.sql
psql -U postgres -d pg_health_monitoring -f migrations/003_create_audit_log_table.sql
psql -U postgres -d pg_health_monitoring -f migrations/004_seed_admin_user.sql
```

Or use the migration script:

```bash
python -c "
import asyncio
import asyncpg
import os

async def run_migrations():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    migration_files = [
        'migrations/001_create_api_schema.sql',
        'migrations/002_create_users_table.sql',
        'migrations/003_create_audit_log_table.sql',
        'migrations/004_seed_admin_user.sql',
    ]
    
    for file in migration_files:
        with open(file, 'r') as f:
            await conn.execute(f.read())
        print(f'Applied {file}')
    
    await conn.close()

asyncio.run(run_migrations())
"
```

## Running the API

### Development Server

```bash
# Start with auto-reload
uvicorn app.main:app --reload

# Or with custom host/port
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API**: http://localhost:8000
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Production Server

```bash
# Using Gunicorn with Uvicorn workers
gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Or using Uvicorn directly
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Testing

### Run All Tests

```bash
# Run all tests with verbose output
python -m pytest tests/ -v

# Run with coverage report
python -m pytest tests/ --cov=app --cov-report=html
```

### Run Specific Test Categories

```bash
# Property-based tests (Hypothesis)
python -m pytest tests/property/ -v

# Unit tests
python -m pytest tests/unit/ -v

# Integration tests (requires database)
python -m pytest tests/integration/ -v

# Skip integration tests
python -m pytest tests/ -v -m "not integration"
```

### Run Specific Test File

```bash
python -m pytest tests/unit/test_auth.py -v
python -m pytest tests/property/test_encryption.py -v
```

### Test with Different Hypothesis Profiles

```bash
# Development profile (fast, low example count)
python -m pytest tests/property/ -v

# CI profile (thorough, higher example count)
HYPOTHESIS_PROFILE=ci python -m pytest tests/property/ -v

# Nightly profile (exhaustive, no deadline)
HYPOTHESIS_PROFILE=nightly python -m pytest tests/property/ -v
```

## API Documentation

### Interactive Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### API Endpoints Overview

#### Authentication
- `POST /api/v1/auth/login` - Login with credentials
- `POST /api/v1/auth/refresh` - Refresh JWT token

#### Servers
- `GET /api/v1/servers` - List servers
- `POST /api/v1/servers` - Create server (admin only)
- `GET /api/v1/servers/{server_id}` - Get server details
- `PUT /api/v1/servers/{server_id}` - Update server (admin only)
- `DELETE /api/v1/servers/{server_id}` - Delete server (admin only)
- `PATCH /api/v1/servers/{server_id}/deactivate` - Soft delete (admin only)

#### Checks
- `GET /api/v1/checks` - List checks
- `POST /api/v1/checks` - Create check (admin only)
- `GET /api/v1/checks/{check_id}` - Get check details
- `PUT /api/v1/checks/{check_id}` - Update check (admin only)
- `DELETE /api/v1/checks/{check_id}` - Delete check (admin only)
- `GET /api/v1/checks/health` - Check health summary

#### Mappings
- `GET /api/v1/mappings` - List mappings
- `POST /api/v1/mappings` - Create mapping (admin only)
- `PUT /api/v1/mappings/{mapping_id}` - Update mapping (admin only)
- `DELETE /api/v1/mappings/{mapping_id}` - Delete mapping (admin only)

#### Thresholds
- `GET /api/v1/thresholds` - List thresholds
- `POST /api/v1/thresholds` - Create threshold (admin only)
- `GET /api/v1/thresholds/{threshold_id}` - Get threshold details
- `PUT /api/v1/thresholds/{threshold_id}` - Update threshold (admin only)
- `DELETE /api/v1/thresholds/{threshold_id}` - Delete threshold (admin only)

#### Monitoring
- `GET /api/v1/monitoring/runs` - List check runs
- `GET /api/v1/monitoring/logs` - List monitoring logs
- `GET /api/v1/monitoring/metrics` - List metrics
- `GET /api/v1/monitoring/metrics/aggregate` - Aggregated metrics

#### Alerts
- `GET /api/v1/alerts` - List alerts
- `POST /api/v1/alerts/{alert_id}/acknowledge` - Acknowledge alert (admin only)

#### Incidents
- `GET /api/v1/incidents` - List incidents
- `GET /api/v1/incidents/{incident_id}` - Get incident details
- `PATCH /api/v1/incidents/{incident_id}` - Update root cause (admin only)

#### Dashboard
- `GET /api/v1/dashboard/summary` - Dashboard overview
- `GET /api/v1/dashboard/servers/{server_id}/health` - Server health details
- `GET /api/v1/dashboard/metrics/chart` - Metrics chart data

#### Audit
- `GET /api/v1/audit-logs` - List audit logs (admin only)

#### Admin
- `POST /api/v1/admin/credentials/rotate` - Rotate encryption keys (admin only)

## Environment Configuration

### Required Environment Variables

```bash
# Database connection
DATABASE_URL=postgresql://user:password@host:port/database

# Encryption key (must be base64-encoded 32 bytes)
CREDENTIAL_ENCRYPTION_KEY=<base64-encoded-32-byte-key>

# JWT configuration
JWT_SECRET=<your-secret-key>
JWT_EXPIRY_SECONDS=3600
```

### Optional Environment Variables

```bash
# Connection validation mode: 'strict' or 'warn'
CONNECTION_VALIDATION_MODE=warn

# Staleness threshold in seconds (when collector is considered stale)
STALENESS_THRESHOLD_SECS=300

# Rate limiting: requests per minute per user
RATE_LIMIT_RPM=1000

# Database statement timeout in milliseconds
DB_STATEMENT_TIMEOUT_MS=30000

# High-cost query threshold in days
HIGH_COST_DAYS_THRESHOLD=30

# CORS allowed origins (comma-separated)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Generate Encryption Key

```bash
python -c "import base64; print(base64.b64encode(b'0' * 32).decode())"
```

## Database Setup

### Create Database

```bash
# Using psql
createdb pg_health_monitoring

# Or using SQL
psql -U postgres -c "CREATE DATABASE pg_health_monitoring;"
```

### Apply Migrations

```bash
# Apply all migrations in order
for file in migrations/*.sql; do
    psql -U postgres -d pg_health_monitoring -f "$file"
done
```

### Verify Database Setup

```bash
# Connect to database
psql -U postgres -d pg_health_monitoring

# List tables
\dt api.*

# Check users table
SELECT * FROM api.users;

# Check audit log table
SELECT * FROM api.audit_log LIMIT 5;
```

### Default Admin User

After running migrations, a default admin user is created:
- **Username**: `admin`
- **Password**: `admin` (change immediately in production)

Login to get JWT token:

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}'
```

## Development Workflow

### 1. Start PostgreSQL

```bash
# macOS with Homebrew
brew services start postgresql

# Linux with systemd
sudo systemctl start postgresql

# Docker
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:14
```

### 2. Activate Virtual Environment

```bash
source venv/bin/activate  # macOS/Linux
# or
.\venv\Scripts\Activate.ps1  # Windows PowerShell
```

### 3. Start Development Server

```bash
uvicorn app.main:app --reload
```

### 4. Run Tests

```bash
# In another terminal
python -m pytest tests/ -v
```

### 5. Access API Documentation

Open http://localhost:8000/docs in your browser

## Code Style and Linting

### Format Code with Black

```bash
pip install black
black app/ tests/
```

### Lint with Flake8

```bash
pip install flake8
flake8 app/ tests/
```

### Type Check with mypy

```bash
pip install mypy
mypy app/
```

## Troubleshooting

### Issue: `CREDENTIAL_ENCRYPTION_KEY` validation error

**Error**: `ValueError: CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes`

**Solution**: Generate a proper 32-byte key:
```bash
python -c "import base64; print(base64.b64encode(b'0' * 32).decode())"
```

### Issue: Database connection error

**Error**: `asyncpg.exceptions.CannotConnectNowError`

**Solution**: 
1. Verify PostgreSQL is running
2. Check DATABASE_URL is correct
3. Verify database exists: `psql -l`

### Issue: Port already in use

**Error**: `Address already in use`

**Solution**: Use a different port:
```bash
uvicorn app.main:app --reload --port 8001
```

### Issue: pytest-asyncio not found

**Error**: `async def functions are not natively supported`

**Solution**: Install pytest-asyncio:
```bash
pip install pytest-asyncio==1.3.0
```

### Issue: Module not found

**Error**: `ModuleNotFoundError: No module named 'app'`

**Solution**: Ensure you're in the `api/` directory and virtual environment is activated:
```bash
cd api
source venv/bin/activate
```

### Issue: JWT token expired

**Error**: `401 Unauthorized`

**Solution**: Refresh the token:
```bash
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Authorization: Bearer <expired-token>"
```

## Performance Tips

1. **Connection Pooling**: Configured automatically with asyncpg
2. **Query Optimization**: Use partition pruning for time-series queries
3. **Caching**: Implement Redis for frequently accessed data
4. **Rate Limiting**: Adjust `RATE_LIMIT_RPM` based on your needs
5. **Database Indexes**: Ensure all indexed columns are used in WHERE clauses

## Security Best Practices

1. **Change Default Password**: Update admin password immediately
2. **Use Strong JWT Secret**: Generate a cryptographically secure secret
3. **Enable HTTPS**: Use SSL/TLS in production
4. **Rotate Encryption Keys**: Use `/admin/credentials/rotate` endpoint periodically
5. **Audit Logs**: Monitor audit logs for suspicious activity
6. **Rate Limiting**: Adjust based on your security requirements

## Deployment

### Docker

```dockerfile
FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: pg_health_monitoring
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: .
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/pg_health_monitoring
      CREDENTIAL_ENCRYPTION_KEY: MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=
      JWT_SECRET: your-secret-key
    ports:
      - "8000:8000"
    depends_on:
      - postgres

volumes:
  postgres_data:
```

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [asyncpg Documentation](https://magicstack.github.io/asyncpg/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [pytest Documentation](https://docs.pytest.org/)
- [Hypothesis Documentation](https://hypothesis.readthedocs.io/)

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review API documentation at http://localhost:8000/docs
3. Check test files for usage examples
4. Review the main spec at `.kiro/specs/pg-health-platform/requirements.md`

## License

[Your License Here]
