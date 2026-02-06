# Hướng dẫn sử dụng Supabase với SQLTuner

## Vấn đề

Khi chuyển từ Postgres local sang Supabase, bạn gặp lỗi khi run query:
- Failed to decrypt password
- Connection errors
- SSL/TLS issues

## Nguyên nhân

1. **Password encryption key khác nhau**: Connection được tạo với ENCRYPTION_KEY cũ
2. **SSL required**: Supabase yêu cầu SSL connection
3. **Host resolution**: Supabase là cloud service, không cần resolve sang `host.docker.internal`

## Giải pháp đã fix

### 1. SSL Support cho Supabase

Code đã được cập nhật để tự động thêm `?sslmode=require` cho:
- Connections có host chứa "supabase"
- Connections không phải localhost

**Files đã sửa:**
- `backend/app/api/v1/endpoints/sql.py`
- `backend/app/services/optimization_service.py`
- `backend/app/services/inspector_service.py`
- `backend/app/services/schema_service.py`

### 2. Better Error Handling ✅

Thay vì crash, giờ sẽ show error message rõ ràng khi:
- Password decryption fails
- Connection fails
- SSL errors

### 3. Improved Logging ✅

Thêm logging để debug:
- Password decryption status
- Connection string (hidden password)
- SSL mode
- Host resolution

## Cách sử dụng

### Option 1: Recreate Connection (Recommended)

1. **Check ENCRYPTION_KEY**
   ```bash
   python fix_encryption.py
   ```

2. **Delete old connection** trong UI (nếu có)

3. **Create new connection** với thông tin Supabase:
   - Type: `POSTGRES`
   - Host: `db.xxxxx.supabase.co` (từ Supabase dashboard)
   - Port: `5432`
   - Username: `postgres`
   - Password: (nhập plain password)
   - Database: `postgres`

4. **Test connection** bằng cách sync schema

5. **Run query** - Should work now!

### Option 2: Test Connection First

```bash
# Test Supabase connection trước
python test_supabase.py
```

Script này sẽ:
- Test direct connection tới Supabase
- Verify SSL works
- Test password encryption
- Show encrypted password để debug

### Option 3: Use SIMULATION (No real DB needed)

Nếu chỉ cần test SQL optimization (không execute):
1. Create connection với type `SIMULATION`
2. Sync schema một lần (cần real connection)
3. Sau đó có thể optimize SQL without connecting

## Kiểm tra Backend Logs

Khi run query, check terminal uvicorn xem logs:

```
[SQL] Successfully decrypted password for connection xxx
[SQL] Building connection string for postgres at db.xxx.supabase.co:5432
[LIVE] Creating engine for postgres database: db.xxx.supabase.co:5432/postgres
[LIVE] Running query on real database...
[LIVE] Query executed in 123.45ms
```

Nếu thấy error:
```
[SQL] Password decryption failed for connection xxx: ...
```

→ Xóa connection và tạo lại

## Common Issues & Solutions

### Issue 1: "Failed to decrypt password"
**Solution**: Delete connection and recreate it

### Issue 2: "SSL required"
**Solution**: Fixed! Code tự động thêm `?sslmode=require`

### Issue 3: "Connection timeout"
**Solution**: 
- Check Supabase dashboard → Settings → Database
- Add your IP to allowed list
- Or enable "Allow all connections" (not recommended for production)

### Issue 4: "Invalid credentials"
**Solution**:
- Double check username/password từ Supabase dashboard
- Password là database password, không phải Supabase account password

## Testing

1. **Test Supabase connection**:
   ```bash
   python test_supabase.py
   ```

2. **Test inference API**:
   ```bash
   python test_inference_api.py
   ```

3. **Test encryption**:
   ```bash
   python fix_encryption.py
   ```

## Architecture Changes

### Before (Local Postgres)
```
Frontend → Backend → SQLite Sandbox (SIMULATION)
Frontend → Backend → Local Postgres (execute)
```

### After (Supabase)
```
Frontend → Backend → SQLite Sandbox (SIMULATION) ← Still works!
Frontend → Backend → Supabase Postgres (execute with SSL) ← Now works!
```

## Notes

- SIMULATION mode vẫn hoạt động bình thường
- Có thể mix SIMULATION và real connections
- SSL được tự động thêm cho cloud providers
- Password encryption được handle gracefully
- Localhost connections vẫn work như cũ

## Troubleshooting Commands

```bash
# 1. Check encryption key
python fix_encryption.py

# 2. Test Supabase connection
python test_supabase.py

# 3. Check backend logs
# In terminal running uvicorn, look for [SQL], [LIVE], [OPTIMIZE] logs

# 4. Restart backend after .env changes
# Ctrl+C in uvicorn terminal, then:
cd backend
python run.py
```

## Need More Help?

1. Check backend logs (uvicorn terminal)
2. Run test scripts above
3. Verify Supabase credentials in dashboard
4. Make sure ENCRYPTION_KEY is consistent in .env
