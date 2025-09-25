# 🤖 BIVA Auto-QA System

[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://docker.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=flat&logo=redis&logoColor=white)](https://redis.io)

**Hệ thống Auto-QA thông minh cho các AI Agent/Conversation Bot** - Tự động đánh giá chất lượng hội thoại dựa trên các tiêu chí như độ chính xác, tính liên quan, tính hữu ích và độ an toàn.

## 🌟 Tính năng chính

- ✅ **Auto-QA Engine**: Chạy QA tự động cho hàng nghìn conversation
- 🔄 **Real-time Updates**: UI tự động cập nhật khi QA hoàn thành
- 📊 **Analytics Dashboard**: Thống kê chi tiết về chất lượng AI
- 🤖 **Multi-Bot Support**: Hỗ trợ nhiều bot với knowledge base riêng
- 📈 **Export to Google Sheets**: Tự động xuất kết quả ra Google Sheets
- 🔍 **Advanced Filtering**: Lọc theo bot, thời gian, trạng thái QA
- 📱 **Responsive UI**: Giao diện thân thiện trên mọi thiết bị

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   React + TS    │◄──►│  FastAPI + SQL  │◄──►│  PostgreSQL     │
│                 │    │                 │    │  + Redis Cache  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   AI Services   │
                       │  OpenAI + GPT   │
                       └─────────────────┘
```

### **Tech Stack**

**Backend:**
- **FastAPI** - Web framework cao tốc
- **SQLAlchemy** - ORM cho PostgreSQL
- **AsyncPG** - PostgreSQL async client
- **Redis** - Caching và session management
- **OpenAI API** - QA evaluation engine
- **Langfuse** - LLM observability

**Frontend:**
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **shadcn/ui** - Component library
- **Tailwind CSS** - Styling
- **React Query** - Data fetching

**Infrastructure:**
- **Docker** - Containerization
- **PostgreSQL** - Primary database
- **Redis** - Caching layer
- **Nginx** - Reverse proxy

## 🚀 Cài đặt và Chạy

### **Yêu cầu hệ thống**

- **Docker & Docker Compose** (recommended)
- **Node.js 20+** & **npm** (for development)
- **Git**

### **Chạy với Docker (Khuyến nghị)**

1. **Clone repository:**
   ```bash
   git clone <repository-url>
   cd biva-auto-qa
   ```

2. **Cấu hình environment:**
   ```bash
   # Backend
   cp backend/.env.example backend/.env
   # Frontend
   cp qa-dialog-compass/.env.docker qa-dialog-compass/.env
   ```

3. **Chạy toàn bộ hệ thống:**
   ```bash
   docker-compose up -d
   ```

4. **Truy cập ứng dụng:**
   - **Frontend**: http://localhost:80
   - **Backend API**: http://localhost:13886
   - **API Documentation**: http://localhost:13886/docs

### **Chạy Development Mode**

#### **Backend:**
```bash
cd backend
# Tạo virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# hoặc
venv\Scripts\activate     # Windows

# Cài đặt dependencies
pip install -r requirements.txt

# Chạy database migrations
alembic upgrade head

# Chạy server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### **Frontend:**
```bash
cd qa-dialog-compass
npm install
npm run dev
```

## 📖 Hướng dẫn sử dụng

### **1. Đăng nhập và Setup Bot**

1. **Truy cập ứng dụng**: Mở http://localhost:80
2. **Đăng ký tài khoản** hoặc đăng nhập
3. **Tạo Bot**:
   - Vào tab "Bots"
   - Nhập Legacy Bot Index
   - Hệ thống tự động tạo bot mới với knowledge base

### **2. Chạy Auto-QA**

#### **Chạy QA cho Conversation đơn lẻ:**
1. Vào tab "Conversations"
2. Tìm conversation cần đánh giá
3. Click vào conversation để xem chi tiết
4. Click nút "Run QA" ở góc trên phải
5. Chờ kết quả và xem đánh giá chi tiết

#### **Chạy QA hàng loạt:**
1. Vào tab "Conversations"
2. Chọn nhiều conversations bằng checkbox
3. Click nút "Run QA" để chạy cho tất cả
4. Theo dõi tiến độ và kết quả

### **3. Xem Kết quả và Analytics**

- **Conversations Tab**: Xem danh sách conversations với điểm QA
- **Bots Tab**: Quản lý các bot và knowledge base
- **Analytics**: Thống kê chi tiết về chất lượng AI

### **4. Export Kết quả**

- Chọn conversations cần export
- Click nút "Export to Sheets"
- Kết quả tự động xuất ra Google Sheets

## 🔧 Cấu hình

### **Environment Variables**

```env
# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost:5432/autoqa
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=your_openai_api_key
LANGFUSE_SECRET_KEY=your_langfuse_key
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
GOOGLE_SHEET_CREDENTIALS_PATH=/path/to/credentials.json
GOOGLE_SHEET_SPREADSHEET_ID=your_spreadsheet_id

# Frontend (.env)
VITE_DEV_API_PROXY_TARGET=http://localhost:8000
```

### **Cấu hình Database**

Hệ thống sử dụng PostgreSQL với các bảng chính:

- **`bots`** - Thông tin các bot
- **`bot_versions`** - Version của knowledge base
- **`conversations`** - Dữ liệu conversation từ legacy system
- **`evaluations`** - Kết quả đánh giá QA

### **Cấu hình AI Models**

QA Engine sử dụng:
- **GPT-4.1-mini** - Đánh giá chính
- **GPT-4.1** - Tạo knowledge base (nếu cần)

## 📚 API Documentation

### **Swagger UI**

Truy cập http://localhost:13886/docs để xem API documentation đầy đủ.

### **Endpoints chính**

#### **Bots Management**
```http
GET    /api/v1/bots/                    # List all bots
POST   /api/v1/bots/                    # Create bot from legacy index
GET    /api/v1/bots/{bot_id}            # Get bot details
GET    /api/v1/bots/{bot_id}/versions   # Get bot versions
POST   /api/v1/bots/{bot_index}/knowledge_base/regenerate # Regenerate KB
```

#### **QA Runs**
```http
POST   /api/v1/qa_runs/run              # Run QA for conversations
```

#### **Conversations**
```http
GET    /api/v1/conversations/           # List conversations with filters
GET    /api/v1/conversations/{id}       # Get conversation details
GET    /api/v1/conversations/{id}/spans # Get conversation spans
```

#### **Evaluations**
```http
GET    /api/v1/evaluations/             # List evaluations
GET    /api/v1/evaluations/{id}         # Get evaluation details
PATCH  /api/v1/evaluations/{id}         # Update evaluation review
```

## 🛠️ Troubleshooting

### **Vấn đề thường gặp**

#### **1. API trả về empty array**
```bash
# Xóa cache Redis
curl -X DELETE http://localhost:13886/api/v1/bots/cache
# Hoặc restart Redis container
docker-compose restart redis
```

#### **2. Database connection error**
```bash
# Kiểm tra PostgreSQL
docker-compose logs postgres
# Restart database
docker-compose restart postgres
```

#### **3. OpenAI API quota exceeded**
- Kiểm tra quota tại OpenAI dashboard
- Cân nhắc sử dụng model nhỏ hơn (GPT-3.5-turbo)

#### **4. Frontend không load được**
```bash
# Xóa node_modules và cài lại
cd qa-dialog-compass
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### **Performance Tuning**

#### **Database:**
- Tăng connection pool trong config
- Tối ưu query với indexes
- Sử dụng read replica cho heavy queries

#### **Caching:**
- Redis cache TTL: 24h cho bots, 5min cho conversations
- Cache invalidation khi có data mới

#### **Concurrency:**
- QA runs: 3 concurrent tasks
- Database pool: 10-20 connections

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Tạo Pull Request

### **Development Guidelines**

- Sử dụng TypeScript cho tất cả frontend code
- Viết unit tests cho backend APIs
- Follow ESLint và Prettier rules
- Sử dụng conventional commits

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Xem docs tại `/docs`
- **Issues**: Tạo issue trên GitHub
- **Discussions**: Thảo luận tại GitHub Discussions

---

**Made with ❤️ for AI Quality Assurance**
