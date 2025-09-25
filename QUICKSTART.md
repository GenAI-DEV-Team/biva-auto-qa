# 🚀 Quick Start - BIVA Auto-QA System

## 5 phút để bắt đầu!

### 1. Clone & Setup
```bash
git clone <repository-url>
cd biva-auto-qa

# Copy environment files
cp backend/.env.example backend/.env
cp qa-dialog-compass/.env.docker qa-dialog-compass/.env
```

### 2. Cấu hình OpenAI API Key
Chỉnh sửa file `backend/.env`:
```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. Chạy hệ thống
```bash
# Chạy toàn bộ với Docker (khuyến nghị)
docker-compose up -d

# Hoặc chạy từng phần
# Backend: cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Frontend: cd qa-dialog-compass && npm install && npm run dev
```

### 4. Truy cập ứng dụng
- **Frontend**: http://localhost:80
- **API Docs**: http://localhost:13886/docs
- **Health Check**: http://localhost:13886/health

## 🎯 Sử dụng cơ bản

### Đăng ký & Đăng nhập
1. Mở http://localhost:80
2. Click "Register" để tạo tài khoản
3. Đăng nhập với email/password

### Tạo Bot đầu tiên
1. Vào tab "Bots"
2. Nhập "Legacy Bot Index" (ví dụ: 1, 2, 3...)
3. Click "Create Bot"
4. Hệ thống tự động tạo bot với knowledge base

### Chạy QA
#### QA đơn lẻ:
1. Vào tab "Conversations"
2. Tìm conversation cần đánh giá
3. Click vào conversation để xem chi tiết
4. Click nút "Run QA" ở góc trên phải

#### QA hàng loạt:
1. Chọn nhiều conversations bằng checkbox
2. Click nút "Run QA" để chạy cho tất cả
3. Theo dõi tiến độ và kết quả

### Xem kết quả
- **Conversations Tab**: Danh sách với điểm QA
- **Analytics**: Thống kê chi tiết
- **Export**: Tự động xuất ra Google Sheets

## 🔧 Troubleshooting Nhanh

### API trả về empty?
```bash
# Xóa cache
curl -X DELETE http://localhost:13886/api/v1/bots/cache
```

### Database error?
```bash
# Restart database
docker-compose restart postgres
```

### OpenAI quota hết?
- Kiểm tra quota tại OpenAI dashboard
- Cân nhắc dùng model nhỏ hơn

### Frontend không load?
```bash
cd qa-dialog-compass
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## 📊 API Examples

### List Bots
```bash
curl http://localhost:13886/api/v1/bots/
```

### Run QA
```bash
curl -X POST http://localhost:13886/api/v1/qa_runs/run \
  -H "Content-Type: application/json" \
  -d '{"conversation_ids": ["conv-123", "conv-456"]}'
```

### Get Conversations
```bash
curl "http://localhost:13886/api/v1/conversations/?limit=50&qa_status=qa"
```

## 🆘 Help & Support

- **Full Documentation**: Xem [README.md](README.md)
- **Installation Guide**: Xem [INSTALLATION.md](INSTALLATION.md)
- **Issues**: Tạo issue trên GitHub
- **API Reference**: http://localhost:13886/docs

---

**Chúc bạn sử dụng hiệu quả! 🎉**
