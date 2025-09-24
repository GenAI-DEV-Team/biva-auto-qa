from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.engine import make_url
from app.core.config import settings


def normalize_db_url(url: str) -> str:
    """Normalize sync driver URLs to async drivers for SQLAlchemy asyncio.

    - PostgreSQL: postgresql[+psycopg2] -> postgresql+asyncpg
    - MySQL: mysql[+pymysql] -> mysql+asyncmy
    - MariaDB: mariadb[+pymysql] -> mariadb+asyncmy
    """
    lowered = url.lower()
    if lowered.startswith('postgresql+psycopg2://'):
        return 'postgresql+asyncpg://' + url.split('://', 1)[1]
    if lowered.startswith('postgresql://'):
        return 'postgresql+asyncpg://' + url.split('://', 1)[1]
    if lowered.startswith('mysql+pymysql://'):
        return 'mysql+asyncmy://' + url.split('://', 1)[1]
    if lowered.startswith('mariadb+pymysql://'):
        return 'mariadb+asyncmy://' + url.split('://', 1)[1]
    if lowered.startswith('mysql://'):
        return 'mysql+asyncmy://' + url.split('://', 1)[1]
    if lowered.startswith('mariadb://'):
        return 'mariadb+asyncmy://' + url.split('://', 1)[1]
    return url


# Create async engines (write primary, optional read replica)
write_url = normalize_db_url(settings.DATABASE_URL)
read_url = normalize_db_url(settings.DATABASE_READ_URL) if settings.DATABASE_READ_URL else write_url

write_backend = make_url(write_url).get_backend_name()
read_backend = make_url(read_url).get_backend_name()

engine = create_async_engine(
    write_url,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_recycle=settings.DB_POOL_RECYCLE_SEC,
    pool_timeout=settings.DB_POOL_TIMEOUT_SEC,
)

read_engine = create_async_engine(
    read_url,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_recycle=settings.DB_POOL_RECYCLE_SEC,
    pool_timeout=settings.DB_POOL_TIMEOUT_SEC,
)

# Create async session factory
async_session = async_sessionmaker(engine, expire_on_commit=False)
async_read_session = async_sessionmaker(read_engine, expire_on_commit=False)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()

async def create_tables():
    """Create all tables defined in models"""
    # Ensure models are imported so metadata is populated
    async with engine.begin() as conn:
        # Apply Postgres-only session settings
        if write_backend == 'postgresql':
            # Set a statement timeout to protect from long-running DDL
            await conn.exec_driver_sql(f"SET statement_timeout = {settings.PG_STATEMENT_TIMEOUT_MS}")
        await conn.run_sync(Base.metadata.create_all)

async def get_read_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_read_session() as session:
        try:
            yield session
        finally:
            await session.close()
