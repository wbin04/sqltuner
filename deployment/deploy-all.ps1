# Deploy both Backend and Frontend to Google Cloud Run
# Usage: .\deploy-all.ps1

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "          SQLTuner - Full Deployment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$startTime = Get-Date

# Deploy Backend
Write-Host "`n[STEP 1/2] Deploying Backend..." -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Gray
.\deploy-backend.ps1

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n================================================" -ForegroundColor Red
    Write-Host "Backend deployment failed! Stopping..." -ForegroundColor Red
    Write-Host "================================================" -ForegroundColor Red
    exit 1
}

Write-Host "`n`n"

# Deploy Frontend
Write-Host "[STEP 2/2] Deploying Frontend..." -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Gray
.\deploy-frontend.ps1

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n================================================" -ForegroundColor Red
    Write-Host "Frontend deployment failed!" -ForegroundColor Red
    Write-Host "================================================" -ForegroundColor Red
    exit 1
}

$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host "`n`n"
Write-Host "================================================" -ForegroundColor Green
Write-Host "     ALL SERVICES DEPLOYED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Deployment Summary:" -ForegroundColor Cyan
Write-Host "  Backend:  https://sqltuner-backend-834344415984.asia-southeast1.run.app" -ForegroundColor White
Write-Host "  Frontend: https://sqltuner-frontend-834344415984.asia-southeast1.run.app" -ForegroundColor White
Write-Host ""
Write-Host "Total time: $($duration.Minutes)m $($duration.Seconds)s" -ForegroundColor Gray
Write-Host ""
Write-Host "Remember to clear browser cache if needed!" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Green
