# Railway Deployment Fix Guide

## 🚨 **ISSUE IDENTIFIED**
Railway is currently serving the frontend as a static site instead of running the Node.js backend server.

## ✅ **FIXES APPLIED**

### 1. **Updated Package.json Scripts**
```json
{
  "scripts": {
    "start": "node server-working.js",
    "start:server": "node server-working.js"
  }
}
```

### 2. **Updated Railway Configuration Files**
- **railway.json**: Changed startCommand to `npm run start:server`
- **Procfile**: Changed to `web: npm run start:server`
- **nixpacks.toml**: Changed start command to `npm run start:server`

### 3. **Enhanced Server Configuration**
- Added environment variable loading with `dotenv`
- Enhanced health check endpoint with detailed environment info
- Added proper logging for debugging

## 🔧 **VERIFICATION STEPS**

### Step 1: Test Locally
```bash
# Test the server locally
npm run start:server

# In another terminal, test the endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api/jobs
```

### Step 2: Deploy to Railway
```bash
# Commit and push changes
git add .
git commit -m "Fix Railway deployment: Use npm run start:server"
git push origin main
```

### Step 3: Verify Deployment
```bash
# Run verification script
node verify-deployment.js
```

## 📋 **EXPECTED RESULTS**

### Backend Health Check Response
```json
{
  "ok": true,
  "message": "Working combined server running",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "environment": {
    "nodeEnv": "production",
    "port": 3001,
    "databaseUrl": "Set",
    "frontendUrl": "Set"
  },
  "jobsLoaded": 3,
  "uptime": 123.45,
  "memory": {...}
}
```

### API Endpoints Working
- ✅ `GET /health` - Health check
- ✅ `GET /api/jobs` - Jobs list
- ✅ `POST /api/jobs` - Create job
- ✅ `PATCH /api/jobs/:id/status` - Update job status
- ✅ `GET /api/pipeline-stages` - Pipeline stages

## 🚨 **TROUBLESHOOTING**

### If Backend Still Not Working

1. **Check Railway Logs**
   ```bash
   # In Railway dashboard, check the backend service logs
   # Look for errors in the startup process
   ```

2. **Verify Environment Variables**
   - `PORT`: Should be set by Railway (usually 3001)
   - `DATABASE_URL`: Should be set for PostgreSQL connection
   - `NODE_ENV`: Should be 'production'

3. **Test Server File Directly**
   ```bash
   # Test if server-working.js runs without errors
   node server-working.js
   ```

### If Frontend Not Connecting to Backend

1. **Check CORS Configuration**
   - Backend should allow requests from frontend domain
   - Check `Access-Control-Allow-Origin` headers

2. **Verify API Base URL**
   - Frontend should have correct `VITE_API_BASE` environment variable
   - Should point to backend Railway URL

3. **Check Network Connectivity**
   ```bash
   # Test if frontend can reach backend
   curl https://alvap-mvp-production.up.railway.app/api/jobs
   ```

## 📊 **SUCCESS CRITERIA**

### Must Have
- [ ] Backend health check returns 200 OK
- [ ] Jobs API returns job data
- [ ] Frontend loads without errors
- [ ] Frontend can create/update jobs
- [ ] No 500 errors in Railway logs

### Nice to Have
- [ ] Response times < 2 seconds
- [ ] All API endpoints working
- [ ] Frontend-backend integration smooth
- [ ] Error handling working properly

## 🔄 **ROLLBACK PLAN**

If the fix doesn't work:

1. **Revert to Previous Configuration**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Use Alternative Server File**
   ```bash
   # Change railway.json to use a different server file
   "startCommand": "node server-combined.js"
   ```

3. **Check Railway Service Configuration**
   - Ensure the correct service is set as the main service
   - Verify the root directory is set correctly

## 📞 **NEXT STEPS**

1. **Deploy the fixes** to Railway
2. **Run verification script** to confirm everything works
3. **Test all functionality** end-to-end
4. **Monitor logs** for any issues
5. **Update deployment status** once confirmed working

---

**Status**: ✅ **FIXES APPLIED - READY FOR DEPLOYMENT**
**Next Action**: Deploy to Railway and verify functionality
