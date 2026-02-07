# Deploy Frontend to Google Cloud Run with Artifact Registry
# Usage: .\deploy-frontend.ps1

$PROJECT_ID = "sqltuner"
$REGION = "asia-southeast1"
$REPOSITORY = "sqltuner"
$SERVICE_NAME = "sqltuner-frontend"
$IMAGE_NAME = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:latest"
$BACKEND_URL = "https://sqltuner-backend-834344415984.asia-southeast1.run.app"
$FRONTEND_URL = "https://sqltuner-frontend-834344415984.asia-southeast1.run.app"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DEPLOYING FRONTEND" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Navigate to frontend directory
Set-Location ../frontend

# Clean .env files to avoid conflicts
Write-Host "`n[1/5] Cleaning .env files..." -ForegroundColor Yellow
Remove-Item .env -ErrorAction SilentlyContinue
Remove-Item .env.production -ErrorAction SilentlyContinue

Write-Host "`n[2/5] Building Docker image..." -ForegroundColor Yellow
docker build `
    --no-cache `
    --build-arg VITE_API_URL="${BACKEND_URL}/api/v1" `
    -t ${SERVICE_NAME}:latest `
    -f Dockerfile.prod .

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    Set-Location ../deployment
    exit 1
}

Write-Host "`n[3/5] Tagging image for Artifact Registry..." -ForegroundColor Yellow
docker tag ${SERVICE_NAME}:latest $IMAGE_NAME

Write-Host "`n[4/5] Pushing to Artifact Registry..." -ForegroundColor Yellow
docker push $IMAGE_NAME

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nPush failed!" -ForegroundColor Red
    Set-Location ../deployment
    exit 1
}

Write-Host "`n[5/5] Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $SERVICE_NAME `
    --image $IMAGE_NAME `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --memory 256Mi `
    --cpu 1 `
    --port 8080

# Restore .env files for local development
Write-Host "`nRestoring .env files for local development..." -ForegroundColor Gray
New-Item -Path .env -ItemType File -Force -Value "VITE_API_URL=http://localhost:8000/api/v1" | Out-Null
New-Item -Path .env.production -ItemType File -Force -Value "VITE_API_URL=${BACKEND_URL}/api/v1" | Out-Null

Set-Location ../deployment

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "FRONTEND DEPLOYED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nService URL: ${FRONTEND_URL}" -ForegroundColor Cyan
} else {
    Write-Host "`n========================================" -ForegroundColor Red
    Write-Host "DEPLOYMENT FAILED!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}
