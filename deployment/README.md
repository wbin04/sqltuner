# SQLTuner Deployment Scripts

Scripts để deploy SQLTuner lên Google Cloud Run với Artifact Registry.

## 📁 Files

- **deploy-all.ps1** / **deploy-all.cmd** - Deploy cả backend và frontend
- **deploy-backend.ps1** / **deploy-backend.cmd** - Deploy riêng backend
- **deploy-frontend.ps1** / **deploy-frontend.cmd** - Deploy riêng frontend

## 🚀 Usage

### Option 1: Click đúp file .cmd
```
deploy-all.cmd       → Deploy cả 2 services
deploy-backend.cmd   → Deploy backend only
deploy-frontend.cmd  → Deploy frontend only
```

### Option 2: Chạy trong PowerShell
```powershell
.\deploy-all.ps1
.\deploy-backend.ps1
.\deploy-frontend.ps1
```

### Option 3: Chạy trong CMD
```cmd
.\deploy-all.cmd
.\deploy-backend.cmd
.\deploy-frontend.cmd
```

## ⚙️ Configuration

Scripts sử dụng các giá trị sau:
- **Project ID**: sqltuner
- **Region**: asia-southeast1
- **Repository**: sqltuner
- **Backend URL**: https://sqltuner-backend-834344415984.asia-southeast1.run.app
- **Frontend URL**: https://sqltuner-frontend-834344415984.asia-southeast1.run.app

Nếu cần thay đổi, edit trong từng file .ps1.

## 📝 Notes

- **Backend**: Tự động set env vars cho CORS và Cookie security
- **Frontend**: Tự động clean .env files trước build để tránh conflict
- **All**: Deploy backend trước, sau đó frontend
- Sau deploy, nhớ clear browser cache nếu cần

## 🔧 Requirements

- Google Cloud SDK (gcloud CLI)
- Docker Desktop
- Artifact Registry đã được setup (chạy setup-artifact-registry.ps1 ở root)
- PowerShell 5.1+

## 📊 Deployment Flow

### Backend
1. Build Docker image
2. Tag image cho Artifact Registry
3. Push image lên registry
4. Deploy lên Cloud Run với env vars

### Frontend
1. Clean .env files
2. Build Docker image với VITE_API_URL
3. Tag image cho Artifact Registry
4. Push image lên registry
5. Deploy lên Cloud Run
6. Restore .env files cho local dev

### All
1. Deploy backend
2. Nếu thành công → Deploy frontend
3. Hiển thị summary
