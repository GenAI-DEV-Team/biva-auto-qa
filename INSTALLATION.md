# 📦 Hướng dẫn Cài đặt - BIVA Auto-QA System

## Mục lục

1. [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
2. [Cài đặt với Docker](#cài-đặt-với-docker)
3. [Cài đặt Development](#cài-đặt-development)
4. [Cấu hình Environment](#cấu-hình-environment)
5. [Khởi tạo Database](#khởi-tạo-database)
6. [Chạy hệ thống](#chạy-hệ-thống)
7. [Kiểm tra hoạt động](#kiểm-tra-hoạt-động)
8. [Troubleshooting](#troubleshooting)

## Yêu cầu hệ thống

### Minimum Requirements
- **RAM**: 4GB
- **CPU**: 2 cores
- **Storage**: 10GB free space
- **OS**: Linux, macOS, Windows (WSL2)

### Dependencies
- **Docker & Docker Compose** (recommended)
- **Git**
- **Node.js 20+** & **npm** (for development)

## Cài đặt với Docker

### Bước 1: Clone Repository

```bash
git clone <repository-url>
cd biva-auto-qa
```

### Bước 2: Cấu hình Environment

#### Backend Configuration
```bash
# Copy và chỉnh sửa file environment
cp backend/.env.example backend/.env
```

Chỉnh sửa file `backend/.env` với thông tin thực tế:

```env
# Database
DATABASE_URL=postgresql://autoqa:autoqa@localhost:5434/autoqa
DATABASE_READ_URL=postgresql://autoqa:autoqa@localhost:5434/autoqa

# Redis
REDIS_URL=redis://localhost:6378/0

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Langfuse (optional)
LANGFUSE_SECRET_KEY=your_langfuse_key
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_HOST=https://cloud.langfuse.com

# Google Sheets
GOOGLE_SHEET_CREDENTIALS_PATH=/app/credentials.json
GOOGLE_SHEET_SPREADSHEET_ID=your_google_sheet_id

# Environment
ENVIRONMENT=production
DEBUG=false
```

#### Frontend Configuration
```bash
cp qa-dialog-compass/.env.docker qa-dialog-compass/.env
```

### Bước 3: Cấu hình Google Sheets (Optional)

1. Tạo project mới tại [Google Cloud Console](https://console.cloud.google.com)
2. Enable Google Sheets API và Google Drive API
3. Tạo Service Account và download credentials.json
4. Đặt file credentials.json vào `backend/credentials.json`
5. Share Google Sheet với Service Account email

### Bước 4: Chạy hệ thống

```bash
# Chạy toàn bộ hệ thống
docker-compose up -d

# Xem logs để kiểm tra
docker-compose logs -f
```

### Bước 5: Khởi tạo Database

```bash
# Chạy database migrations
docker-compose exec backend alembic upgrade head
```

## Cài đặt Development

### Backend Setup

```bash
cd backend

# Tạo virtual environment
python -m venv venv

# Linux/Mac
source venv/bin/activate

# Windows
venv\Scripts\activate

# Cài đặt dependencies
pip install -r requirements.txt

# Cài đặt dev dependencies
pip install -r requirements-dev.txt
```

### Frontend Setup

```bash
cd qa-dialog-compass

# Cài đặt dependencies
npm install

# Copy environment file
cp .env.example .env
```

### Database Setup

```bash
# Tạo database
createdb autoqa

# Chạy migrations
alembic upgrade head
```

### Redis Setup

```bash
# Chạy Redis
redis-server --daemonize yes

# Hoặc với Docker
docker run -d -p 6379:6379 redis:7-alpine
```

## Cấu hình Environment

### Environment Variables Chi tiết

#### Backend (.env)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/autoqa
DATABASE_READ_URL=postgresql://user:password@localhost:5432/autoqa  # Optional

# Redis
REDIS_URL=redis://localhost:6379/0

# OpenAI
OPENAI_API_KEY=sk-your-key-here

# Langfuse (Optional - for LLM observability)
LANGFUSE_SECRET_KEY=your-langfuse-secret
LANGFUSE_PUBLIC_KEY=your-langfuse-public
LANGFUSE_HOST=https://cloud.langfuse.com

# Google Sheets Integration
GOOGLE_SHEET_CREDENTIALS_PATH=/path/to/credentials.json
GOOGLE_SHEET_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

# Server Configuration
PORT=8000
HOST=0.0.0.0
ENVIRONMENT=development
DEBUG=true

# CORS
CORS_ALLOW_ORIGINS=http://localhost:3000,http://localhost:8080
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOW_METHODS=*
CORS_ALLOW_HEADERS=*

# Database Pool Settings
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_RECYCLE_SEC=1800
DB_POOL_TIMEOUT_SEC=30

# Redis Settings
REDIS_MAX_CONNECTIONS=50
REDIS_HEALTHCHECK_SEC=30
REDIS_SOCKET_TIMEOUT_SEC=5
```

#### Frontend (.env)

```env
# Development
VITE_DEV_SERVER_HOST=0.0.0.0
VITE_DEV_SERVER_PORT=3000

# API Configuration
VITE_DEV_API_PROXY_TARGET=http://localhost:8000
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Environment
VITE_ENVIRONMENT=development
```

## Khởi tạo Database

### Tạo User Tables

```sql
-- Chạy SQL script để tạo bảng users
psql -h localhost -p 5432 -U autoqa -d autoqa -f create_users_table.sql
```

### Database Schema

Hệ thống tự động tạo các bảng sau:

#### **bots** - Thông tin các bot
```sql
CREATE TABLE bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_index INTEGER NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **bot_versions** - Knowledge base versions
```sql
CREATE TABLE bot_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_index INTEGER NOT NULL REFERENCES bots(bot_index),
    system_prompt TEXT NOT NULL,
    knowledge_base JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **evaluations** - Kết quả đánh giá QA
```sql
CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id TEXT NOT NULL UNIQUE,
    memory JSONB NOT NULL,
    evaluation_result JSONB NOT NULL,
    reviewed BOOLEAN DEFAULT FALSE,
    review_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Chạy hệ thống

### Development Mode

#### Backend:
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend:
```bash
cd qa-dialog-compass
npm run dev
```

### Production Mode (Docker)

```bash
# Build và chạy
docker-compose up --build -d

# Xem logs
docker-compose logs -f

# Stop
docker-compose down
```

## Kiểm tra hoạt động

### 1. Kiểm tra Services

```bash
# Kiểm tra containers
docker-compose ps

# Kiểm tra logs
docker-compose logs postgres
docker-compose logs redis
docker-compose logs backend
docker-compose logs frontend
```

### 2. Kiểm tra API

```bash
# Health check
curl http://localhost:8000/health

# API docs
curl http://localhost:8000/docs

# Backend API
curl http://localhost:8000/api/v1/bots/

# Frontend
curl http://localhost:80
```

### 3. Kiểm tra Database

```bash
# Connect to database
psql -h localhost -p 5432 -U autoqa -d autoqa

# Check tables
\dt

# Check data
SELECT COUNT(*) FROM bots;
SELECT COUNT(*) FROM conversations;
```

## Troubleshooting

### Docker Issues

#### **Port conflicts**
```bash
# Kiểm tra port đang sử dụng
netstat -tulpn | grep :80
netstat -tulpn | grep :8000

# Thay đổi port trong docker-compose.yml
# hoặc kill process đang dùng port
kill -9 <PID>
```

#### **Permission denied**
```bash
# Fix permissions
sudo chown -R $USER:$USER .
chmod +x backend/run.sh
```

#### **Build fails**
```bash
# Clean và rebuild
docker-compose down -v
docker system prune -f
docker-compose up --build
```

### Database Issues

#### **Connection refused**
```bash
# Restart database
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

#### **Migration fails**
```bash
# Reset database
docker-compose down -v
docker volume rm biva-auto-qa_pgdata
docker-compose up -d postgres

# Run migration lại
docker-compose exec backend alembic upgrade head
```

### Redis Issues

#### **Redis connection fails**
```bash
# Restart Redis
docker-compose restart redis

# Check Redis logs
docker-compose logs redis
```

### API Issues

#### **500 Internal Server Error**
```bash
# Check backend logs
docker-compose logs backend

# Debug với verbose logging
docker-compose exec backend python -c "
import asyncio
from app.core.db import get_db
async def test():
    try:
        async with get_db() as db:
            await db.execute('SELECT 1')
        print('Database OK')
    except Exception as e:
        print(f'Database Error: {e}')
asyncio.run(test())
"
```

#### **CORS errors**
```bash
# Kiểm tra CORS config
curl -H "Origin: http://localhost:3000" \
     -v http://localhost:8000/api/v1/bots/
```

### Frontend Issues

#### **Build fails**
```bash
cd qa-dialog-compass
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm run build
```

#### **Dev server crashes**
```bash
# Kill port 3000
kill -9 $(lsof -ti:3000)

# Restart
npm run dev
```

### Performance Issues

#### **Slow API responses**
```bash
# Check database performance
docker-compose exec postgres psql -U autoqa -d autoqa -c "
EXPLAIN ANALYZE SELECT * FROM conversations LIMIT 100;
"

# Check Redis
docker-compose exec redis redis-cli info memory
```

#### **High memory usage**
```bash
# Monitor memory
docker stats

# Optimize settings trong .env
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
```

## Environment Examples

### Development (.env)
```env
# Database
DATABASE_URL=postgresql://autoqa:autoqa@localhost:5434/autoqa
DATABASE_READ_URL=postgresql://autoqa:autoqa@localhost:5434/autoqa

# Redis
REDIS_URL=redis://localhost:6378/0

# OpenAI
OPENAI_API_KEY=sk-test-key-here

# Environment
ENVIRONMENT=development
DEBUG=true

# Frontend
VITE_DEV_API_PROXY_TARGET=http://localhost:8000
```

### Production (.env)
```env
# Database
DATABASE_URL=postgresql://prod_user:prod_pass@prod_host:5432/autoqa_prod
DATABASE_READ_URL=postgresql://readonly:readonly_pass@replica_host:5432/autoqa_prod

# Redis
REDIS_URL=redis://redis-cluster:6379/0

# OpenAI
OPENAI_API_KEY=sk-prod-key-here

# Environment
ENVIRONMENT=production
DEBUG=false

# Security
CORS_ALLOW_ORIGINS=https://yourdomain.com
CORS_ALLOW_CREDENTIALS=false
```

## Support

Nếu gặp vấn đề:

1. **Check logs**: `docker-compose logs -f [service-name]`
2. **Database**: `docker-compose exec postgres psql -U autoqa -d autoqa`
3. **Redis**: `docker-compose exec redis redis-cli`
4. **API**: `curl http://localhost:8000/docs`

---

**Cài đặt thành công! 🚀**
