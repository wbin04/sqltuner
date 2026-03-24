# Hướng Dẫn Triển Khai SQLTuner lên Google Cloud Run

## Tổng Quan

Tài liệu này hướng dẫn triển khai dự án **SQLTuner** lên **Google Cloud Run** với kiến trúc:
- **Backend:** FastAPI (Python 3.10)
- **Frontend:** React (Vite) + Nginx
- **Platform:** Google Cloud Run (Serverless, tối ưu chi phí)
- **Region:** asia-southeast1 (Singapore)

## Yêu Cầu Tiên Quyết

1. Tài khoản Google Cloud Platform với billing được kích hoạt
2. Google Cloud SDK (gcloud CLI) đã cài đặt
3. Docker đã cài đặt trên máy local
4. Quyền truy cập vào project GCP

### Thiết Lập Ban Đầu

```bash
# Đăng nhập vào GCP
gcloud auth login

# Thiết lập project ID
gcloud config set project YOUR_PROJECT_ID

# Kích hoạt các API cần thiết
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

---

## 1. Backend Deployment Configuration

### 1.1. Dockerfile cho Backend

Tạo file `backend/Dockerfile.prod`:

```dockerfile
# Backend Production Dockerfile
FROM python:3.10-slim

# Thiết lập biến môi trường
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Cài đặt system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Tạo non-root user
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app && \
    chown -R appuser:appuser /app

# Thiết lập working directory
WORKDIR /app

# Copy requirements và cài đặt dependencies
COPY --chown=appuser:appuser requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=appuser:appuser . .

# Chuyển sang non-root user
USER appuser

# Expose port (Cloud Run sẽ inject $PORT)
EXPOSE 8080

# CRITICAL: Lắng nghe trên $PORT từ Cloud Run
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
```

### 1.2. Build và Deploy Backend

#### Build Image

```bash
# Di chuyển vào thư mục backend
cd backend

# Build image và push lên Google Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/sqltuner-backend:latest .
```

#### Deploy lên Cloud Run

```bash
gcloud run deploy sqltuner-backend \
  --image gcr.io/YOUR_PROJECT_ID/sqltuner-backend:latest \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars "DATABASE_URL=postgresql://user:password@host:5432/dbname,ENVIRONMENT=production,LOG_LEVEL=info"
```

#### Lấy URL của Backend

```bash
gcloud run services describe sqltuner-backend \
  --platform managed \
  --region asia-southeast1 \
  --format 'value(status.url)'
```

Lưu URL này để cấu hình cho Frontend.

### 1.3. Cập Nhật Biến Môi Trường

```bash
# Cập nhật env vars sau khi deploy
gcloud run services update sqltuner-backend \
  --region asia-southeast1 \
  --update-env-vars "NEW_VAR=value"
```

---

## 2. Frontend Deployment Configuration

### 2.1. Nginx Configuration

Tạo file `frontend/nginx.conf`:

```nginx
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback - tất cả routes trả về index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK";
        add_header Content-Type text/plain;
    }
}
```

### 2.2. Docker Entrypoint Script

Tạo file `frontend/docker-entrypoint.sh`:

```bash
#!/bin/sh
set -e

# Thay thế PORT trong nginx.conf bằng $PORT từ Cloud Run
if [ -n "$PORT" ]; then
    echo "Configuring Nginx to listen on port $PORT"
    sed -i "s/listen 8080;/listen $PORT;/g" /etc/nginx/conf.d/default.conf
fi

# Khởi động Nginx
echo "Starting Nginx..."
exec nginx -g 'daemon off;'
```

### 2.3. Dockerfile cho Frontend

Tạo file `frontend/Dockerfile.prod`:

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build argument cho API URL
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Build production bundle
RUN npm run build

# Stage 2: Production
FROM nginx:1.25-alpine

# Install gettext cho envsubst (nếu cần)
RUN apk add --no-cache gettext

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts từ stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port (Cloud Run sẽ inject $PORT)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

# Sử dụng custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
```

### 2.4. Build và Deploy Frontend

#### Build Image với API URL

```bash
# Di chuyển vào thư mục frontend
cd frontend

# Build image với build arg cho API URL
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _VITE_API_BASE_URL=https://sqltuner-backend-xxxxx.run.app \
  --tag gcr.io/YOUR_PROJECT_ID/sqltuner-frontend:latest .
```

Tạo file `frontend/cloudbuild.yaml` (tuỳ chọn):

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'VITE_API_BASE_URL=${_VITE_API_BASE_URL}'
      - '-t'
      - 'gcr.io/$PROJECT_ID/sqltuner-frontend:latest'
      - '-f'
      - 'Dockerfile.prod'
      - '.'
images:
  - 'gcr.io/$PROJECT_ID/sqltuner-frontend:latest'
```

Hoặc build trực tiếp:

```bash
# Build với Docker local
docker build \
  --build-arg VITE_API_BASE_URL=https://sqltuner-backend-xxxxx.run.app \
  -t gcr.io/YOUR_PROJECT_ID/sqltuner-frontend:latest \
  -f Dockerfile.prod \
  .

# Push lên GCR
docker push gcr.io/YOUR_PROJECT_ID/sqltuner-frontend:latest
```

#### Deploy lên Cloud Run

```bash
gcloud run deploy sqltuner-frontend \
  --image gcr.io/YOUR_PROJECT_ID/sqltuner-frontend:latest \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --memory 256Mi \
  --cpu 1 \
  --max-instances 5 \
  --min-instances 0 \
  --port 8080
```

### 2.5. Lấy URL của Frontend

```bash
gcloud run services describe sqltuner-frontend \
  --platform managed \
  --region asia-southeast1 \
  --format 'value(status.url)'
```

---

## 3. Operational Workflow (Quy Trình Vận Hành)

### 3.1. Quy Trình Cập Nhật Backend

```bash
# Bước 1: Di chuyển vào thư mục backend
cd backend

# Bước 2: Build và push image mới
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/sqltuner-backend:latest .

# Bước 3: Deploy phiên bản mới
gcloud run deploy sqltuner-backend \
  --image gcr.io/YOUR_PROJECT_ID/sqltuner-backend:latest \
  --region asia-southeast1

# Bước 4: Xác minh deployment
gcloud run services describe sqltuner-backend \
  --region asia-southeast1 \
  --format 'value(status.url)'
```

### 3.2. Quy Trình Cập Nhật Frontend

```bash
# Bước 1: Di chuyển vào thư mục frontend
cd frontend

# Bước 2: Build với API URL (thay YOUR_BACKEND_URL)
docker build \
  --build-arg VITE_API_BASE_URL=https://YOUR_BACKEND_URL \
  -t gcr.io/YOUR_PROJECT_ID/sqltuner-frontend:latest \
  -f Dockerfile.prod \
  .

# Bước 3: Push image
docker push gcr.io/YOUR_PROJECT_ID/sqltuner-frontend:latest

# Bước 4: Deploy phiên bản mới
gcloud run deploy sqltuner-frontend \
  --image gcr.io/YOUR_PROJECT_ID/sqltuner-frontend:latest \
  --region asia-southeast1

# Bước 5: Xác minh deployment
gcloud run services describe sqltuner-frontend \
  --region asia-southeast1 \
  --format 'value(status.url)'
```

### 3.3. Rollback Phiên Bản

```bash
# Xem lịch sử revisions
gcloud run revisions list \
  --service sqltuner-backend \
  --region asia-southeast1

# Rollback về revision trước đó
gcloud run services update-traffic sqltuner-backend \
  --to-revisions REVISION_NAME=100 \
  --region asia-southeast1
```

### 3.4. Monitoring và Logs

```bash
# Xem logs realtime
gcloud run services logs read sqltuner-backend \
  --region asia-southeast1 \
  --follow

# Xem metrics
gcloud run services describe sqltuner-backend \
  --region asia-southeast1
```

### 3.5. Xóa Services (Cleanup)

```bash
# Xóa backend service
gcloud run services delete sqltuner-backend \
  --region asia-southeast1

# Xóa frontend service
gcloud run services delete sqltuner-frontend \
  --region asia-southeast1

# Xóa images từ GCR
gcloud container images delete gcr.io/YOUR_PROJECT_ID/sqltuner-backend:latest
gcloud container images delete gcr.io/YOUR_PROJECT_ID/sqltuner-frontend:latest
```

---

## 4. Tối Ưu Chi Phí (Free Tier)

Cloud Run Free Tier bao gồm:
- 2 triệu requests/tháng
- 360,000 GB-seconds
- 180,000 vCPU-seconds

### Chiến Lược Tối Ưu:

1. **Giảm min-instances về 0:** Không tốn phí khi không có traffic
2. **Giảm memory allocation:** 256Mi cho frontend, 512Mi cho backend
3. **Sử dụng concurrency cao:** Mặc định 80 requests/container
4. **Cache static assets:** Giảm số lượng requests

```bash
# Deploy với cấu hình tối ưu chi phí
gcloud run deploy SERVICE_NAME \
  --min-instances 0 \
  --max-instances 3 \
  --memory 256Mi \
  --cpu 1 \
  --concurrency 80 \
  --cpu-throttling \
  --region asia-southeast1
```

---

## 5. Troubleshooting

### Backend không khởi động

```bash
# Kiểm tra logs
gcloud run services logs read sqltuner-backend \
  --region asia-southeast1 \
  --limit 50

# Kiểm tra biến môi trường
gcloud run services describe sqltuner-backend \
  --region asia-southeast1 \
  --format 'value(spec.template.spec.containers[0].env)'
```

### Frontend không kết nối được Backend

1. Kiểm tra CORS settings trong backend
2. Xác minh VITE_API_BASE_URL đã được build đúng
3. Kiểm tra network policies

### Container Exit Code 1

- Kiểm tra Dockerfile CMD/ENTRYPOINT
- Xác minh PORT environment variable được sử dụng đúng
- Kiểm tra permissions của non-root user

---

## 6. Best Practices

1. **Sử dụng healthcheck endpoints** cho monitoring
2. **Implement graceful shutdown** trong application
3. **Set resource limits** phù hợp với workload
4. **Sử dụng Cloud Build triggers** cho CI/CD tự động
5. **Enable Cloud Logging** và **Cloud Monitoring**
6. **Implement circuit breakers** khi gọi external services
7. **Sử dụng secrets management** (Secret Manager) cho sensitive data

### Sử dụng Secret Manager

```bash
# Tạo secret
echo -n "postgresql://user:pass@host:5432/db" | \
  gcloud secrets create database-url --data-file=-

# Deploy với secret
gcloud run deploy sqltuner-backend \
  --image gcr.io/YOUR_PROJECT_ID/sqltuner-backend:latest \
  --region asia-southeast1 \
  --update-secrets DATABASE_URL=database-url:latest
```

---

## 7. CI/CD với Cloud Build

Tạo file `cloudbuild.yaml` trong root project:

```yaml
steps:
  # Build Backend
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/sqltuner-backend:$COMMIT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/sqltuner-backend:latest'
      - '-f'
      - 'backend/Dockerfile.prod'
      - './backend'
    id: 'build-backend'

  # Build Frontend
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'VITE_API_BASE_URL=${_BACKEND_URL}'
      - '-t'
      - 'gcr.io/$PROJECT_ID/sqltuner-frontend:$COMMIT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/sqltuner-frontend:latest'
      - '-f'
      - 'frontend/Dockerfile.prod'
      - './frontend'
    id: 'build-frontend'

  # Deploy Backend
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'sqltuner-backend'
      - '--image'
      - 'gcr.io/$PROJECT_ID/sqltuner-backend:$COMMIT_SHA'
      - '--region'
      - 'asia-southeast1'
      - '--platform'
      - 'managed'
    id: 'deploy-backend'
    waitFor: ['build-backend']

  # Deploy Frontend
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'sqltuner-frontend'
      - '--image'
      - 'gcr.io/$PROJECT_ID/sqltuner-frontend:$COMMIT_SHA'
      - '--region'
      - 'asia-southeast1'
      - '--platform'
      - 'managed'
    id: 'deploy-frontend'
    waitFor: ['build-frontend']

images:
  - 'gcr.io/$PROJECT_ID/sqltuner-backend:$COMMIT_SHA'
  - 'gcr.io/$PROJECT_ID/sqltuner-backend:latest'
  - 'gcr.io/$PROJECT_ID/sqltuner-frontend:$COMMIT_SHA'
  - 'gcr.io/$PROJECT_ID/sqltuner-frontend:latest'

substitutions:
  _BACKEND_URL: 'https://sqltuner-backend-xxxxx.run.app'

options:
  machineType: 'N1_HIGHCPU_8'
```

Thiết lập trigger:

```bash
gcloud builds triggers create github \
  --repo-name=sqltuner \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

---

## Kết Luận

Bạn đã hoàn thành việc triển khai SQLTuner lên Google Cloud Run. Kiến trúc serverless này cho phép:

- Tự động scale từ 0 đến N instances
- Chỉ trả tiền khi có traffic
- Quản lý đơn giản, không cần lo lắng về infrastructure
- HTTPS tự động với managed certificates
- Global CDN tích hợp sẵn

Để được hỗ trợ thêm, tham khảo:
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Best Practices for Cloud Run](https://cloud.google.com/run/docs/tips)
