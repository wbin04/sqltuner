# Hướng Dẫn Setup và Deploy SQLTuner lên Google Cloud Platform

## Tổng Quan

Tài liệu này hướng dẫn setup và deploy dự án **SQLTuner** lên **Google Cloud Run** với kiến trúc hybrid:
- **Backend:** FastAPI (Python) - API server
- **Frontend:** React (Vite) + Nginx - Web interface
- **Database:** Supabase PostgreSQL (external)
- **Platform:** Google Cloud Run (serverless)

## Yêu Cầu Tiên Quyết

### 1. Tài Khoản và Tools
- Tài khoản Google Cloud Platform với billing enabled
- Google Cloud SDK (gcloud CLI) đã cài đặt
- Docker Desktop đã cài đặt
- Git đã cài đặt

### 2. GCP Project Setup
```bash
# Đăng nhập GCP
gcloud auth login

# Thiết lập project ID (thay sqltuner bằng project ID thực)
gcloud config set project sqltuner

# Kích hoạt các API cần thiết
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 3. Supabase Database
- Tạo project trên [Supabase](https://supabase.com)
- Lưu lại thông tin database:
  - Host: `db.xxxxx.supabase.co`
  - Username: `postgres`
  - Password: (database password)
  - Database: `postgres`

## Backend Deployment

### 1. Chuẩn Bị Environment Variables

Tạo file `backend/.env.prod`:

```env
# Database
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@db.xxxxx.supabase.co:5432/postgres?sslmode=require

# Security
SECRET_KEY=your-super-secret-key-here
ENCRYPTION_KEY=your-32-character-encryption-key

# Environment
ENVIRONMENT=production
LOG_LEVEL=info

# CORS
FRONTEND_URL=https://sqltuner-frontend-xxxxx.run.app

# Optional: Google OAuth (nếu sử dụng)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 2. Build và Push Docker Image

```bash
# Di chuyển vào thư mục backend
cd backend

# Build và push image
gcloud builds submit --tag gcr.io/sqltuner/sqltuner-backend:latest .
```

### 3. Tạo Secrets trong GCP

```bash
# Tạo secret cho database URL
echo -n "postgresql://postgres:YOUR_DB_PASSWORD@db.xxxxx.supabase.co:5432/postgres?sslmode=require" | \
gcloud secrets create database-url --data-file=-

# Tạo secret cho encryption key
echo -n "your-32-character-encryption-key" | \
gcloud secrets create encryption-key --data-file=-
```

### 4. Deploy Backend lên Cloud Run

```bash
gcloud run deploy sqltuner-backend \
  --image gcr.io/sqltuner/sqltuner-backend:latest \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 0 \
  --port 8080 \
  --set-env-vars "ENVIRONMENT=production,LOG_LEVEL=info,SECRET_KEY=your-secret-key" \
  --update-secrets DATABASE_URL=database-url:latest \
  --update-secrets ENCRYPTION_KEY=encryption-key:latest
```

### 5. Lấy Backend URL

```bash
BACKEND_URL=$(gcloud run services describe sqltuner-backend \
  --platform managed \
  --region asia-southeast1 \
  --format 'value(status.url)')

echo "Backend URL: $BACKEND_URL"
```

## Frontend Deployment

### 1. Cập Nhật API Base URL

Trong file `frontend/.env.production`:

```env
VITE_API_BASE_URL=https://sqltuner-backend-xxxxx.run.app
```

### 2. Build và Push Docker Image

```bash
# Di chuyển vào thư mục frontend
cd frontend

# Build với API URL
docker build \
  --build-arg VITE_API_BASE_URL=$BACKEND_URL \
  -t gcr.io/sqltuner/sqltuner-frontend:latest \
  -f Dockerfile.prod \
  .

# Push lên Google Container Registry
docker push gcr.io/sqltuner/sqltuner-frontend:latest
```

### 3. Deploy Frontend lên Cloud Run

```bash
gcloud run deploy sqltuner-frontend \
  --image gcr.io/sqltuner/sqltuner-frontend:latest \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --memory 256Mi \
  --cpu 1 \
  --max-instances 5 \
  --min-instances 0 \
  --port 8080
```

### 4. Lấy Frontend URL

```bash
FRONTEND_URL=$(gcloud run services describe sqltuner-frontend \
  --platform managed \
  --region asia-southeast1 \
  --format 'value(status.url)')

echo "Frontend URL: $FRONTEND_URL"
```

## Cập Nhật CORS Settings

Sau khi có frontend URL, cập nhật backend:

```bash
# Cập nhật FRONTEND_URL trong backend
gcloud run services update sqltuner-backend \
  --region asia-southeast1 \
  --set-env-vars "FRONTEND_URL=$FRONTEND_URL"
```

## Testing và Verification

### 1. Kiểm Tra Backend Health

```bash
curl -X GET "$BACKEND_URL/health" \
  -H "Content-Type: application/json"
```

### 2. Kiểm Tra Frontend

Truy cập `$FRONTEND_URL` trong browser và kiểm tra:
- Frontend load được
- Có thể connect tới backend
- Login/register hoạt động

### 3. Test Database Connection

Trong UI SQLTuner:
1. Tạo connection tới Supabase
2. Test connection
3. Sync schema
4. Run sample query

## CI/CD Setup (Tùy Chọn)

### 1. Tạo Cloud Build Trigger

```bash
# Tạo trigger cho main branch
gcloud builds triggers create github \
  --repo-name=sqltuner \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

### 2. Cập Nhật cloudbuild.yaml

File `cloudbuild.yaml` đã được tạo với substitutions cho backend URL.

## Monitoring và Logs

### 1. Xem Logs

```bash
# Backend logs
gcloud run services logs read sqltuner-backend \
  --region asia-southeast1 \
  --follow

# Frontend logs
gcloud run services logs read sqltuner-frontend \
  --region asia-southeast1 \
  --follow
```

### 2. Monitoring Metrics

```bash
# Xem service metrics
gcloud run services describe sqltuner-backend \
  --region asia-southeast1

gcloud run services describe sqltuner-frontend \
  --region asia-southeast1
```

## Troubleshooting

### Backend Không Khởi Động
```bash
# Kiểm tra logs
gcloud run services logs read sqltuner-backend \
  --region asia-southeast1 \
  --limit 50

# Kiểm tra environment variables
gcloud run services describe sqltuner-backend \
  --region asia-southeast1 \
  --format 'value(spec.template.spec.containers[0].env)'
```

### Frontend Không Connect Backend
1. Kiểm tra VITE_API_BASE_URL trong build
2. Verify CORS settings trong backend
3. Check network connectivity

### Database Connection Issues
1. Verify Supabase credentials
2. Check SSL mode (?sslmode=require)
3. Ensure IP allowlist trong Supabase

## Cost Optimization

### Free Tier Limits
- 2 triệu requests/tháng
- 360,000 GB-seconds
- 180,000 vCPU-seconds

### Chiến Lược Tiết Kiệm
```bash
# Deploy với cấu hình tối ưu
gcloud run deploy SERVICE_NAME \
  --min-instances 0 \
  --max-instances 3 \
  --memory 256Mi \
  --concurrency 80 \
  --cpu-throttling
```

## Cleanup (Nếu Cần)

```bash
# Xóa services
gcloud run services delete sqltuner-backend --region asia-southeast1
gcloud run services delete sqltuner-frontend --region asia-southeast1

# Xóa images
gcloud container images delete gcr.io/sqltuner/sqltuner-backend:latest
gcloud container images delete gcr.io/sqltuner/sqltuner-frontend:latest

# Xóa secrets
gcloud secrets delete database-url
gcloud secrets delete encryption-key
```

## Checklist Triển Khai

- [ ] GCP project đã setup
- [ ] APIs đã enable
- [ ] Supabase database đã tạo
- [ ] Backend environment variables đã cấu hình
- [ ] Secrets đã tạo trong GCP
- [ ] Backend đã deploy thành công
- [ ] Frontend đã build với đúng API URL
- [ ] Frontend đã deploy thành công
- [ ] CORS đã cập nhật
- [ ] Health checks pass
- [ ] Database connection test thành công
- [ ] Frontend truy cập được và hoạt động

## Support

Nếu gặp vấn đề:
1. Check logs với `gcloud run services logs read`
2. Verify environment variables
3. Test local trước khi deploy
4. Tham khảo [Cloud Run Documentation](https://cloud.google.com/run/docs)