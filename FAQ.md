# ❓ FAQ - Câu hỏi thường gặp

## 📋 Mục lục
1. [Cài đặt & Setup](#cài-đặt--setup)
2. [Sử dụng hệ thống](#sử-dụng-hệ-thống)
3. [API & Integration](#api--integration)
4. [Performance & Scale](#performance--scale)
5. [Troubleshooting](#troubleshooting)

---

## Cài đặt & Setup

### **Q: Làm thế nào để cài đặt hệ thống?**
**A:** Hệ thống có thể cài đặt theo 2 cách:

**Docker (Khuyến nghị):**
```bash
git clone <repo>
cd biva-auto-qa
docker-compose up -d
```

**Development:**
- Backend: Python venv + pip install
- Frontend: npm install + npm run dev

Xem chi tiết tại [INSTALLATION.md](INSTALLATION.md)

### **Q: Cần cấu hình gì sau khi cài đặt?**
**A:** Cần cấu hình:
1. **OpenAI API Key** trong `backend/.env`
2. **Database credentials** (mặc định: autoqa/autoqa)
3. **Redis URL** (mặc định: localhost:6378)
4. **Google Sheets** (optional)

### **Q: Hệ thống yêu cầu tài nguyên gì?**
**A:** Minimum requirements:
- RAM: 4GB
- CPU: 2 cores
- Storage: 10GB
- OS: Linux/macOS/Windows (WSL2)

### **Q: Có thể chạy trên cloud không?**
**A:** Có! Hệ thống được thiết kế để chạy trên:
- AWS ECS/Fargate
- Google Cloud Run
- Azure Container Instances
- DigitalOcean App Platform
- Heroku (với một số điều chỉnh)

---

## Sử dụng hệ thống

### **Q: Làm thế nào để tạo bot mới?**
**A:**
1. Vào tab "Bots"
2. Nhập "Legacy Bot Index" (số ID của bot cũ)
3. Click "Create Bot"
4. Hệ thống tự động tạo bot với knowledge base

### **Q: QA Engine đánh giá theo tiêu chí gì?**
**A:** Hệ thống đánh giá theo các tiêu chí:
- **Overall Score**: Điểm tổng thể
- **Relevance**: Độ liên quan
- **Accuracy**: Độ chính xác
- **Helpfulness**: Tính hữu ích
- **Safety**: Độ an toàn

### **Q: Có thể chạy QA cho nhiều conversations cùng lúc không?**
**A:** Có! Hệ thống hỗ trợ:
- **Single QA**: 1 conversation
- **Bulk QA**: Lên đến 20 conversations cùng lúc
- **Auto QA**: Tự động chọn conversations mới nhất

### **Q: UI có tự động cập nhật không?**
**A:** Có! Hệ thống có:
- **Auto-refresh**: Mỗi 30-60s
- **Real-time updates**: Khi QA hoàn thành
- **Visual indicators**: Hiển thị trạng thái refresh

### **Q: Có thể export kết quả ra đâu?**
**A:** Hỗ trợ export ra:
- **Google Sheets**: Tự động sync
- **CSV/Excel**: Download trực tiếp
- **API**: JSON endpoints

---

## API & Integration

### **Q: API có authentication không?**
**A:** Hiện tại API không yêu cầu auth cho development, nhưng có thể thêm JWT authentication khi cần.

### **Q: Rate limiting như thế nào?**
**A:** Hệ thống có rate limiting:
- QA runs: 3 concurrent requests
- API calls: 100 requests/minute
- Database connections: 10-20 pool

### **Q: Có webhook/notification không?**
**A:** Hiện tại chưa có webhook, nhưng có thể tích hợp:
- Slack notifications
- Email alerts
- WebSocket real-time updates

### **Q: Database schema có thể customize không?**
**A:** Có! Có thể:
- Thêm fields mới vào models
- Tạo custom evaluation metrics
- Extend conversation data structure

---

## Performance & Scale

### **Q: Hệ thống xử lý được bao nhiêu conversations?**
**A:** Tùy thuộc vào infrastructure:
- **Small**: 1K-10K conversations
- **Medium**: 10K-100K conversations
- **Large**: 100K+ conversations (với optimization)

### **Q: QA processing time như thế nào?**
**A:** Thời gian xử lý:
- **Single QA**: 5-15 seconds
- **Bulk QA (20 conv)**: 30-60 seconds
- **Heavy load**: Có thể lên đến 2-3 minutes

### **Q: Có thể scale horizontally không?**
**A:** Có! Có thể scale:
- **Load balancer** cho multiple backend instances
- **Redis cluster** cho caching
- **Read replicas** cho database
- **CDN** cho static assets

### **Q: Memory usage như thế nào?**
**A:** Memory consumption:
- **Base system**: ~200MB
- **Per conversation**: ~1-5MB
- **Cache**: Tùy thuộc vào data size

---

## Troubleshooting

### **Q: API trả về empty array?**
**A:** Thử các cách sau:
```bash
# 1. Xóa cache
curl -X DELETE http://localhost:13886/api/v1/bots/cache

# 2. Restart Redis
docker-compose restart redis

# 3. Check database
docker-compose exec postgres psql -U autoqa -d autoqa -c "SELECT COUNT(*) FROM bots;"
```

### **Q: OpenAI API quota exceeded?**
**A:** Các giải pháp:
1. **Kiểm tra quota**: Tại OpenAI dashboard
2. **Giảm model size**: Dùng GPT-3.5 thay vì GPT-4
3. **Rate limiting**: Tăng interval giữa requests
4. **Batch processing**: Xử lý theo batches nhỏ hơn

### **Q: Database connection error?**
**A:**
```bash
# 1. Restart database
docker-compose restart postgres

# 2. Check logs
docker-compose logs postgres

# 3. Reset database
docker-compose down -v
docker volume rm biva-auto-qa_pgdata
docker-compose up -d postgres
```

### **Q: Frontend không load được?**
**A:**
```bash
# 1. Clear cache
cd qa-dialog-compass
rm -rf node_modules package-lock.json
npm cache clean --force

# 2. Reinstall
npm install
npm run dev

# 3. Check port conflicts
lsof -ti:3000 | xargs kill -9
```

### **Q: Slow API responses?**
**A:** Tối ưu performance:
```bash
# 1. Check database indexes
docker-compose exec postgres psql -U autoqa -d autoqa -c "\d conversations"

# 2. Monitor Redis
docker-compose exec redis redis-cli info memory

# 3. Optimize config
# Tăng DB_POOL_SIZE=20
# Tăng REDIS_MAX_CONNECTIONS=100
```

### **Q: High CPU usage?**
**A:** Giảm load:
```bash
# 1. Giảm concurrent QA runs
# 2. Tăng polling intervals
# 3. Use smaller AI models
# 4. Add more caching
```

### **Q: CORS errors?**
**A:** Cấu hình CORS trong backend:
```env
CORS_ALLOW_ORIGINS=http://localhost:3000,http://localhost:8080
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOW_METHODS=*
CORS_ALLOW_HEADERS=*
```

### **Q: Memory leaks?**
**A:** Monitoring và cleanup:
```bash
# 1. Monitor memory usage
docker stats

# 2. Restart containers periodically
docker-compose restart

# 3. Check for memory leaks in logs
docker-compose logs -f backend | grep -i "memory\|leak"
```

---

## Support & Community

### **Q: Làm thế nào để contribute?**
**A:**
1. Fork repository
2. Tạo feature branch
3. Implement changes
4. Tạo Pull Request
5. Follow coding standards

### **Q: Có community/discord không?**
**A:** Hiện tại chưa có community chính thức, nhưng có thể:
- Tạo GitHub Discussions
- Tạo Discord/Slack workspace
- Tạo Stack Overflow tag

### **Q: Có training/documentation không?**
**A:** Có đầy đủ documentation:
- [README.md](README.md) - Tổng quan
- [INSTALLATION.md](INSTALLATION.md) - Cài đặt chi tiết
- [QUICKSTART.md](QUICKSTART.md) - Bắt đầu nhanh
- API Docs tại `/docs`

### **Q: Hỗ trợ enterprise/commercial?**
**A:** Có thể hỗ trợ:
- Custom features
- On-premise deployment
- Enterprise security
- SLA & support contracts
- Training & consulting

---

**Câu hỏi khác? Tạo issue trên GitHub! 🚀**
