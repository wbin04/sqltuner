# Hướng Dẫn Setup Google Cloud Tasks cho SQLTuner

Tài liệu này hướng dẫn cấu hình Google Cloud Tasks để xử lý bất đồng bộ cho SQLTuner backend.

## Tổng Quan Kiến Trúc

```
Client Request → FastAPI (Cloud Run)
                    ↓
              Enqueue Task
                    ↓
          Google Cloud Tasks Queue
                    ↓
Cloud Tasks → POST /api/v1/internal/worker (OIDC Auth)
                    ↓
            Worker Process Task
                    ↓
          Update DB với Result/Error
```

## Prerequisites

- Google Cloud Project đã được setup
- `gcloud` CLI đã được cài đặt và authenticated
- Cloud Run service đã deploy (backend)
- Quyền admin trên GCP project

## Bước 1: Enable Required APIs

```bash
# Enable Cloud Tasks API
gcloud services enable cloudtasks.googleapis.com

# Enable Cloud Run API (nếu chưa enable)
gcloud services enable run.googleapis.com

# Enable IAM API
gcloud services enable iam.googleapis.com
```

## Bước 2: Tạo Cloud Tasks Queue

```bash
# Set biến môi trường
export PROJECT_ID="<YOUR_PROJECT_ID>"
export LOCATION="asia-southeast1"
export QUEUE_NAME="sqltuner-queue"

# Tạo queue
gcloud tasks queues create $QUEUE_NAME \
  --location=$LOCATION \
  --max-concurrent-dispatches=10 \
  --max-attempts=3 \
  --max-retry-duration=600s
```

**Giải thích tham số:**
- `max-concurrent-dispatches`: Số task tối đa chạy đồng thời (10)
- `max-attempts`: Số lần retry tối đa nếu task fail (3)
- `max-retry-duration`: Thời gian tối đa để retry (10 phút)

## Bước 3: Tạo Service Account cho Cloud Tasks

```bash
# Tên service account
export SA_NAME="cloud-tasks-invoker"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Tạo service account
gcloud iam service-accounts create $SA_NAME \
  --display-name="Cloud Tasks Invoker Service Account" \
  --description="Service account để Cloud Tasks gọi Cloud Run"
```

## Bước 4: Grant Quyền Invoke Cloud Run

```bash
# Tên Cloud Run service (thay đổi nếu khác)
export SERVICE_NAME="sqltuner-backend"

# Grant quyền run.invoker cho service account
gcloud run services add-iam-policy-binding $SERVICE_NAME \
  --location=$LOCATION \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker"
```

## Bước 5: Verify Setup

```bash
# Kiểm tra queue đã được tạo
gcloud tasks queues describe $QUEUE_NAME --location=$LOCATION

# Kiểm tra service account
gcloud iam service-accounts describe $SA_EMAIL

# Kiểm tra IAM bindings của Cloud Run
gcloud run services get-iam-policy $SERVICE_NAME --location=$LOCATION
```

## Bước 6: Cấu Hình Environment Variables cho Backend

Cập nhật các biến môi trường sau trong Cloud Run:

```bash
# Lấy URL của Cloud Run service
export BACKEND_URL=$(gcloud run services describe $SERVICE_NAME \
  --location=$LOCATION \
  --format='value(status.url)')

# Update Cloud Run environment variables
gcloud run services update $SERVICE_NAME \
  --location=$LOCATION \
  --set-env-vars="ENVIRONMENT=production" \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID}" \
  --set-env-vars="GCP_LOCATION=${LOCATION}" \
  --set-env-vars="CLOUD_TASKS_QUEUE=${QUEUE_NAME}" \
  --set-env-vars="BACKEND_URL=${BACKEND_URL}" \
  --set-env-vars="SERVICE_ACCOUNT_EMAIL=${SA_EMAIL}"
```

**Hoặc update trong file `.env` (nếu deploy từ source):**

```env
ENVIRONMENT=production
GCP_PROJECT_ID=<YOUR_PROJECT_ID>
GCP_LOCATION=asia-southeast1
CLOUD_TASKS_QUEUE=sqltuner-queue
BACKEND_URL=<YOUR_CLOUD_RUN_URL>
SERVICE_ACCOUNT_EMAIL=cloud-tasks-invoker@<PROJECT_ID>.iam.gserviceaccount.com
```

## Bước 7: Test Cloud Tasks

### 7.1. Chạy Database Migration

```bash
# SSH vào Cloud Run hoặc run local với production DB
alembic upgrade head
```

### 7.2. Test Enqueue Task (từ Python)

```python
from google.cloud import tasks_v2
import json

client = tasks_v2.CloudTasksClient()

project = 'your-project-id'
location = 'asia-southeast1'
queue = 'sqltuner-queue'

parent = client.queue_path(project, location, queue)

task = {
    'http_request': {
        'http_method': tasks_v2.HttpMethod.POST,
        'url': 'https://your-backend-url.run.app/api/v1/internal/worker',
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'task_id': 'test-task-id',
            'task_type': 'test',
            'payload': {}
        }).encode(),
        'oidc_token': {
            'service_account_email': 'cloud-tasks-invoker@your-project.iam.gserviceaccount.com'
        }
    }
}

response = client.create_task(request={'parent': parent, 'task': task})
print(f'Created task {response.name}')
```

### 7.3. Monitor Tasks

```bash
# Xem danh sách tasks trong queue
gcloud tasks list --queue=$QUEUE_NAME --location=$LOCATION

# Xem logs của Cloud Run
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=$SERVICE_NAME" \
  --limit=50 \
  --format=json
```

## Bước 8: Setup cho Local Development

Khi develop local, Cloud Tasks không thể reach `localhost`. Do đó, code đã implement fallback:

**Trong file `.env` (local):**
```env
ENVIRONMENT=local
# Không cần config Cloud Tasks trong local mode
```

**Behavior:**
- `ENVIRONMENT=local`: Sử dụng FastAPI BackgroundTasks (execute ngay lập tức)
- `ENVIRONMENT=production`: Sử dụng Google Cloud Tasks (enqueue vào queue)

## Troubleshooting

### Lỗi: "Permission denied" khi Cloud Tasks gọi Cloud Run

**Nguyên nhân:** Service account chưa có quyền invoke Cloud Run.

**Giải pháp:**
```bash
gcloud run services add-iam-policy-binding $SERVICE_NAME \
  --location=$LOCATION \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker"
```

### Lỗi: "OIDC token verification failed"

**Nguyên nhân:** 
- `BACKEND_URL` trong env variables không khớp với Cloud Run URL
- `SERVICE_ACCOUNT_EMAIL` sai

**Giải pháp:**
- Verify `BACKEND_URL` phải chính xác là URL của Cloud Run service
- Verify `SERVICE_ACCOUNT_EMAIL` đúng với service account đã tạo

### Task bị retry liên tục

**Nguyên nhân:** Worker endpoint không return 200 OK.

**Giải pháp:**
- Check logs của Cloud Run
- Đảm bảo worker endpoint catch exceptions và return 200 ngay cả khi task fail
- Update task status trong DB trước khi return

### Queue đầy (backlog)

**Nguyên nhân:** Tasks tích tụ nhanh hơn xử lý.

**Giải pháp:**
```bash
# Tăng max concurrent dispatches
gcloud tasks queues update $QUEUE_NAME \
  --location=$LOCATION \
  --max-concurrent-dispatches=50
```

## Best Practices

1. **Rate Limiting:** Cấu hình `max-dispatches-per-second` để tránh overwhelm backend:
   ```bash
   gcloud tasks queues update $QUEUE_NAME \
     --location=$LOCATION \
     --max-dispatches-per-second=100
   ```

2. **Monitoring:** Setup alerting cho queue depth:
   ```bash
   # Tạo alert khi queue depth > 1000
   gcloud alpha monitoring policies create \
     --notification-channels=<CHANNEL_ID> \
     --display-name="Cloud Tasks Queue Depth Alert" \
     --condition-display-name="Queue depth high" \
     --condition-threshold-value=1000 \
     --condition-threshold-duration=300s
   ```

3. **Dead Letter Queue:** Configure DLQ cho failed tasks:
   ```bash
   # Tạo DLQ
   gcloud tasks queues create sqltuner-dlq --location=$LOCATION
   
   # Update main queue
   gcloud tasks queues update $QUEUE_NAME \
     --location=$LOCATION \
     --max-attempts=5 \
     --dead-letter-queue=sqltuner-dlq
   ```

## Cleanup (Nếu cần xóa)

```bash
# Xóa queue
gcloud tasks queues delete $QUEUE_NAME --location=$LOCATION

# Xóa service account
gcloud iam service-accounts delete $SA_EMAIL
```

## Tham Khảo

- [Google Cloud Tasks Documentation](https://cloud.google.com/tasks/docs)
- [Cloud Run Authentication](https://cloud.google.com/run/docs/authenticating/service-to-service)
- [OIDC Tokens](https://cloud.google.com/tasks/docs/creating-http-target-tasks#token)
