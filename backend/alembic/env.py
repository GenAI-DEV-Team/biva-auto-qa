import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool, create_engine, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# --- Phần thiết lập đường dẫn để import từ ứng dụng chính ---
# Thêm thư mục gốc của dự án vào sys.path để có thể import các module của app
# ví dụ: from app.core.config import settings
# Điều này giúp Alembic "nhìn thấy" các model và cấu hình của bạn.
# -----------------------------------------------------------------
# Lấy đường dẫn thư mục gốc của dự án (thư mục cha của thư mục 'alembic')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


# --- Phần import model và cấu hình từ ứng dụng ---
# Đây là phần quan trọng nhất cần cấu hình đúng.
# -------------------------------------------------------
# Import Base từ nơi bạn định nghĩa Declarative Base. Alembic dùng nó để
# tự động phát hiện thay đổi trong các model (autogenerate).
from app.core.db import Base

# Ensure all model classes are imported so Base.metadata is populated
# Alembic's autogenerate relies on metadata containing Table definitions
import app.models.base  # noqa: F401

# Import đối tượng settings để lấy URL của database.
# Cách này giúp bạn quản lý cấu hình ở một nơi duy nhất.
from app.core.config import settings


# --- Cấu hình Alembic ---
# -----------------------------
# Lấy đối tượng config của Alembic từ context
config = context.config

# Thiết lập logging từ file alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Gán metadata của model cho Alembic để hỗ trợ 'autogenerate'
target_metadata = Base.metadata

# --- Các hàm chạy Migration ---
# --------------------------------

def to_sync_driver_url(url: str) -> str:
    """Convert async driver URLs to sync driver URLs for Alembic.

    Alembic's online mode should use synchronous DBAPIs (e.g. psycopg2) when
    running via create_engine(). If an async driver is supplied (e.g. asyncpg),
    SQLAlchemy will attempt async I/O in a sync context and raise MissingGreenlet.

    This function maps common async drivers to their sync equivalents:
    - postgresql+asyncpg -> postgresql+psycopg2
    - mysql+asyncmy      -> mysql+pymysql
    - mariadb+asyncmy    -> mariadb+pymysql
    """
    lowered = url.lower()
    if lowered.startswith("postgresql+asyncpg://"):
        return "postgresql+psycopg2://" + url.split("://", 1)[1]
    if lowered.startswith("mysql+asyncmy://"):
        return "mysql+pymysql://" + url.split("://", 1)[1]
    if lowered.startswith("mariadb+asyncmy://"):
        return "mariadb+pymysql://" + url.split("://", 1)[1]
    return url

def run_migrations_offline() -> None:
    """Chạy migration ở chế độ 'offline'.
    Chế độ này tạo ra file SQL script thay vì chạy trực tiếp vào DB.
    """
    # Sử dụng trực tiếp URL từ settings, đảm bảo nó đã đúng định dạng
    # Ensure a synchronous driver URL in offline mode as well
    sync_url = to_sync_driver_url(settings.DATABASE_URL)
    print(sync_url)
    context.configure(
        url=sync_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Hàm chạy migration chính được gọi bởi run_migrations_online."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Chạy migration ở chế độ 'online' (đồng bộ)."""
    configuration = config.get_section(config.config_ini_section)
    sync_url = to_sync_driver_url(settings.DATABASE_URL)
    configuration["sqlalchemy.url"] = sync_url
    configuration["sqlalchemy.echo"] = "true"
    print(sync_url)

    connectable = create_engine(
        configuration["sqlalchemy.url"],
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        # Đặt statement timeout cho phiên làm việc
        connection.execute(text(f"SET statement_timeout = {settings.PG_STATEMENT_TIMEOUT_MS}"))

        do_run_migrations(connection)

    connectable.dispose()


# --- Logic chính ---
# ---------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()