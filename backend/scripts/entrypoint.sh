#!/bin/bash
set -e

echo "Running Alembic migrations..."
alembic upgrade head

echo "Seeding database..."
python -c "
import asyncio, asyncpg, os

async def seed():
    conn = await asyncpg.connect(
        os.environ.get('DATABASE_URL', '').replace('postgresql+asyncpg', 'postgresql')
    )
    with open('/app/seed.sql') as f:
        sql = f.read()
    await conn.execute(sql)
    await conn.close()
    print('Seed complete.')

asyncio.run(seed())
"

echo "Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --timeout-graceful-shutdown 10
