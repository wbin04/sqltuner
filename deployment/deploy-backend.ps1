# Deploy Backend to Google Cloud Run with Artifact Registry
# Usage: .\deploy-backend.ps1

$PROJECT_ID = "sqltuner"
$REGION = "asia-southeast1"
$REPOSITORY = "sqltuner"
$SERVICE_NAME = "sqltuner-backend"
$IMAGE_NAME = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:latest"
$BACKEND_URL = "https://sqltuner-backend-834344415984.asia-southeast1.run.app"
$FRONTEND_URL = "https://sqltuner-frontend-834344415984.asia-southeast1.run.app"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DEPLOYING BACKEND" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Function to parse .env file and return env vars string
function Get-EnvVarsFromFile {
    param (
        [string]$EnvFilePath
    )
    
    if (-not (Test-Path $EnvFilePath)) {
        Write-Host "Warning: .env.prod file not found at $EnvFilePath" -ForegroundColor Yellow
        return @{}
    }
    
    Write-Host "`nLoading environment variables from .env.prod..." -ForegroundColor Gray
    
    $envVarsHash = @{}
    Get-Content $EnvFilePath | ForEach-Object {
        $line = $_.Trim()
        # Skip empty lines and comments
        if ($line -and -not $line.StartsWith("#")) {
            # Parse KEY=VALUE
            if ($line -match '^([^=]+)=(.*)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                
                # Remove quotes if present
                $value = $value -replace '^["'']|["'']$', ''
                
                # Add to hash table
                $envVarsHash[$key] = $value
                Write-Host "Loaded: $key" -ForegroundColor DarkGray
            }
        }
    }
    
    return $envVarsHash
}

# Navigate to backend directory
Set-Location ../backend

# Load environment variables from .env.prod
$envVarsHash = Get-EnvVarsFromFile -EnvFilePath ".env.prod"

# Add/Override production-specific variables only if not already set
if (-not $envVarsHash.ContainsKey("BACKEND_CORS_ORIGINS")) {
    $envVarsHash["BACKEND_CORS_ORIGINS"] = $FRONTEND_URL
}
if (-not $envVarsHash.ContainsKey("FRONTEND_URL")) {
    $envVarsHash["FRONTEND_URL"] = "${FRONTEND_URL}/workspaces"
}
if (-not $envVarsHash.ContainsKey("COOKIE_SECURE")) {
    $envVarsHash["COOKIE_SECURE"] = "true"
}
if (-not $envVarsHash.ContainsKey("COOKIE_SAMESITE")) {
    $envVarsHash["COOKIE_SAMESITE"] = "None"
}

# Convert hash table to comma-separated string
$envVarsArray = @()
foreach ($key in $envVarsHash.Keys) {
    $envVarsArray += "${key}=$($envVarsHash[$key])"
    Write-Host "Setting: $key" -ForegroundColor Cyan
}
$envVarsString = $envVarsArray -join ","

Write-Host "`n[1/4] Building Docker image (no cache)..." -ForegroundColor Yellow
docker build --no-cache -t ${SERVICE_NAME}:latest -f Dockerfile.prod .

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    Set-Location ../deployment
    exit 1
}

Write-Host "`n[2/4] Tagging image for Artifact Registry..." -ForegroundColor Yellow
docker tag ${SERVICE_NAME}:latest $IMAGE_NAME

Write-Host "`n[3/4] Pushing to Artifact Registry..." -ForegroundColor Yellow
docker push $IMAGE_NAME

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nPush failed!" -ForegroundColor Red
    Set-Location ../deployment
    exit 1
}

Write-Host "`n[4/4] Deploying to Cloud Run..." -ForegroundColor Yellow
Write-Host "Setting environment variables from .env.prod..." -ForegroundColor Gray

gcloud run deploy $SERVICE_NAME `
    --image $IMAGE_NAME `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --memory 2Gi `
    --cpu 1 `
    --port 8080 `
    --set-env-vars="$envVarsString"

Set-Location ../deployment

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "BACKEND DEPLOYED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nService URL: ${BACKEND_URL}" -ForegroundColor Cyan
} else {
    Write-Host "`n========================================" -ForegroundColor Red
    Write-Host "DEPLOYMENT FAILED!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}
