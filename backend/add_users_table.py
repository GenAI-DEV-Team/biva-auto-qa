#!/usr/bin/env python3
"""
Script to add users table to the database.
Run this script to create the users table with basic columns.
"""

import asyncio
import sys
from sqlalchemy import text
from app.core.db import engine, Base
from app.models.base import User

async def add_users_table():
    """Add the users table to the database"""
    async with engine.begin() as conn:
        print("Creating users table...")

        # Create the users table (simplified)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id UUID NOT NULL,
                username VARCHAR(50) NOT NULL,
                email VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                PRIMARY KEY (id),
                UNIQUE (username),
                UNIQUE (email)
            )
        """))

        # Verify table was created
        result = await conn.execute(text("""
            SELECT table_name, column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        """))

        columns = result.fetchall()
        print(f"\n✓ Users table columns ({len(columns)}):")
        for col in columns:
            print(f"  - {col[1]}: {col[2]} {'NOT NULL' if col[3] == 'NO' else 'NULL'} {f'DEFAULT {col[4]}' if col[4] else ''}")

        await conn.commit()
        print("✓ Users table created successfully!")
        print("\n✓ Script completed successfully!")
        print("You can now register and login users using the /api/v1/auth endpoints")

if __name__ == "__main__":
    asyncio.run(add_users_table())