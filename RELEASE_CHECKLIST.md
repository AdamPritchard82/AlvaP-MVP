# Release Checklist - Door 10 MVP v2.0

## 🚀 Pre-Deployment Checklist

### Code Quality
- [ ] All unit tests passing (`npm run test:unit`)
- [ ] No linting errors in critical files
- [ ] Package.json dependencies up to date
- [ ] No console.log statements in production code

### Environment Setup
- [ ] `DATABASE_URL` configured in Railway
- [ ] `FRONTEND_URL` set for CORS
- [ ] `NODE_ENV=production` confirmed
- [ ] All required environment variables present

### Database
- [ ] PostgreSQL connection string valid
- [ ] Database migrations applied (if any)
- [ ] Backup of existing data (if applicable)
- [ ] Schema validation completed

### Dependencies
- [ ] `package-lock.json` committed
- [ ] No security vulnerabilities (`npm audit`)
- [ ] All dependencies compatible
- [ ] No unnecessary packages

## 🚀 Deployment Steps

### 1. Railway Deployment
```bash
# Push to main branch
git add .
git commit -m "Release v2.0: Library feature, enhanced parsing, performance improvements"
git push origin main

# Railway will auto-deploy from main branch
```

### 2. Verify Deployment
- [ ] Railway deployment completes successfully
- [ ] No build errors in Railway logs
- [ ] Server starts without crashes
- [ ] Health check responds

## 🔍 Post-Deployment Verification

### Health Checks
- [ ] **Backend Health**: `GET https://natural-kindness-production.up.railway.app/health`
  - Status: 200 OK
  - Database: Connected
  - All subsystems: OK

- [ ] **Frontend Health**: `GET https://alvap-mvp-production.up.railway.app`
  - Page loads without errors
  - No console errors
  - All assets load correctly

### Core Functionality Tests

#### 1. Library Feature
- [ ] **Skills Grid**: Navigate to `/candidates`
  - 4 skill tiles visible (Public Affairs, Communications, Policy, Campaigns)
  - Each tile shows candidate count
  - Tiles are clickable

- [ ] **Salary Bands**: Click on a skill tile
  - Band list loads (e.g., £80,000, £90,000)
  - Each band shows candidate count
  - Bands are clickable

- [ ] **Candidate Lists**: Click on a band
  - Candidate list loads with pagination
  - Each candidate shows: name, title, employer, salary
  - Search and filter options work

#### 2. Candidate Management
- [ ] **Create Candidate**: Test candidate creation
  - Form validation works
  - All fields save correctly
  - Skills and salary banding applied
  - Success message displayed

- [ ] **CV Parsing**: Test CV upload
  - File upload works
  - Parsing extracts: name, email, phone, skills
  - Salary information captured
  - Candidate created successfully

#### 3. Search & Export
- [ ] **Search Functionality**: Test search bar
  - Search returns relevant results
  - Results load quickly (< 2 seconds)
  - No errors on empty search

- [ ] **Export Features**: Test export functionality
  - CSV export works
  - PDF export works (basic format)
  - Filtered exports work
  - Files download successfully

### Performance Verification
- [ ] **Page Load Times**: All pages load < 3 seconds
- [ ] **Search Speed**: Search results < 2 seconds
- [ ] **Library Navigation**: Skill/band transitions < 1 second
- [ ] **Export Speed**: Small exports (< 100 records) < 5 seconds

### Error Handling
- [ ] **Invalid Data**: Test with malformed inputs
  - Consistent JSON error responses
  - No server crashes
  - User-friendly error messages

- [ ] **Rate Limiting**: Test rate limits
  - Friendly error messages
  - Proper headers included
  - Retry guidance provided

## 🔄 Rollback Plan

### If Issues Detected
1. **Immediate Rollback**:
   ```bash
   # Revert to previous commit
   git revert HEAD
   git push origin main
   ```

2. **Previous Version Tag**: `v1.9` (if tagged)
   ```bash
   # Deploy previous version
   git checkout v1.9
   git push origin main --force
   ```

3. **Database Rollback** (if needed):
   - Restore from backup
   - Revert schema changes
   - Verify data integrity

### Rollback Verification
- [ ] Previous version deploys successfully
- [ ] All core functionality works
- [ ] No data loss
- [ ] Performance restored

## 📊 Railway Verification Guide

### Backend Service (`natural-kindness`)
1. **Health Check**: 
   - URL: `https://natural-kindness-production.up.railway.app/health`
   - Expected: `{"ok":true,"timestamp":"...","subsystems":{...}}`

2. **Key Endpoints**:
   - `GET /api/candidates` - Should return candidate list
   - `GET /api/skills/counts` - Should return skill counts
   - `GET /api/skills/bands` - Should return salary bands
   - `POST /api/candidates` - Should create new candidate

3. **Performance Checks**:
   - Response times < 2 seconds
   - No 500 errors
   - Rate limiting headers present

### Frontend Service (`alvap-mvp`)
1. **Main Page**: 
   - URL: `https://alvap-mvp-production.up.railway.app`
   - Should load without errors

2. **Library Navigation**:
   - Navigate to `/candidates`
   - Should show 4 skill tiles
   - Click through: Skills → Bands → Candidates

3. **Search & Create**:
   - Test search functionality
   - Test candidate creation
   - Test CV upload and parsing

### Database Verification
1. **Connection**: Check Railway logs for database connection
2. **Data Persistence**: Create candidate, refresh page, verify it persists
3. **Library Updates**: Verify skill counts update after creating candidates

## 🚨 Troubleshooting

### Common Issues
- **CORS Errors**: Check `FRONTEND_URL` environment variable
- **Database Errors**: Verify `DATABASE_URL` is set correctly
- **Rate Limiting**: Check if hitting rate limits (429 errors)
- **Parsing Errors**: Verify CV file format and size limits

### Monitoring
- **Railway Logs**: Check for errors in deployment logs
- **Health Endpoint**: Monitor `/health` for subsystem status
- **Performance**: Watch response times in Railway metrics

## ✅ Success Criteria

### Must Have
- [ ] All health checks pass
- [ ] Library navigation works end-to-end
- [ ] Candidate creation and listing works
- [ ] Search functionality works
- [ ] Export features work
- [ ] No critical errors in logs

### Nice to Have
- [ ] Response times < 2 seconds
- [ ] All tests passing
- [ ] No rate limiting issues
- [ ] Smooth user experience

---

**Deployment Date**: ___________  
**Deployed By**: ___________  
**Rollback Commit**: ___________  
**Verification Status**: ___________
