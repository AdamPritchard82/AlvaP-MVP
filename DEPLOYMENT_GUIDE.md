# AlvaP Deployment Guide

## 🚀 Short-Term Improvements (Next 1-2 Weeks)

This guide covers the implementation of email integration, security hardening, and monitoring features.

## 📧 Email & Communications Integration

### 1. Email Provider Setup

Choose one of the following email providers:

#### Option A: Resend (Recommended)
```bash
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_your_resend_api_key
FROM_EMAIL=noreply@yourdomain.com
```

#### Option B: Mailgun
```bash
EMAIL_PROVIDER=mailgun
EMAIL_API_KEY=your_mailgun_api_key
FROM_EMAIL=noreply@yourdomain.com
```

#### Option C: SendGrid
```bash
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@yourdomain.com
```

### 2. Welcome Email Features

- ✅ **Automatic sending** when candidates are created
- ✅ **Rich HTML templates** with candidate details
- ✅ **Skills and salary display**
- ✅ **Unsubscribe links** with unique tokens
- ✅ **Bounce/OOO webhook support**

### 3. Webhook Configuration

Configure your email provider to send webhooks to:
- **Bounce webhook**: `https://your-backend.up.railway.app/webhooks/email/bounce`
- **Out-of-office webhook**: `https://your-backend.up.railway.app/webhooks/email/out-of-office`

## 🔐 Security & Stability

### 1. JWT Authentication

Set a secure JWT secret:
```bash
JWT_SECRET=your-super-secure-random-string-here
JWT_EXPIRY=7d
```

**⚠️ Important**: Generate a strong, random JWT secret for production!

### 2. Rate Limiting

Rate limits are automatically applied:
- **General API**: 100 requests per 15 minutes
- **File uploads**: 20 uploads per hour
- **Authentication**: 5 attempts per 15 minutes
- **Sensitive endpoints**: 10 requests per 15 minutes

### 3. CORS Hardening

CORS is now restricted to specific domains:
- Your frontend domain
- Localhost for development
- Environment variable `FRONTEND_URL`

## 🗃️ Backups & Storage

### 1. Railway Database Backups

1. Go to your Railway project dashboard
2. Navigate to your PostgreSQL service
3. Click "Settings" tab
4. Enable "Automatic Backups"
5. Set retention period (7-30 days recommended)

### 2. File Storage Configuration

#### Option A: Local Storage (Default)
```bash
FILE_STORAGE=local
UPLOAD_DIR=/data
```

#### Option B: Cloudflare R2
```bash
FILE_STORAGE=r2
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=your_bucket_name
```

#### Option C: AWS S3
```bash
FILE_STORAGE=s3
AWS_ENDPOINT=https://s3.amazonaws.com
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET=your_bucket_name
AWS_REGION=us-east-1
```

### 3. Railway Volume (Alternative to R2)

1. Add Railway Volume service to your project
2. Mount it to your backend service at `/data`
3. Set environment variables:
   ```bash
   FILE_STORAGE=local
   UPLOAD_DIR=/data
   ```

## 📊 Monitoring & Health Checks

### 1. Health Check Endpoints

- **Basic health**: `GET /health`
- **Detailed health**: `GET /health/detailed`

### 2. Uptime Monitoring

Set up external monitoring:
```bash
UPTIME_PING_URL=https://your-monitoring-service.com/ping
UPTIME_PING_INTERVAL=300000
```

### 3. Railway Health Checks

Configure Railway to use:
- **Health check path**: `/health`
- **Health check timeout**: 150 seconds

## 🚀 Deployment Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Database Migrations
```bash
npm run migrate
```

### 3. Set Environment Variables

Add these to your Railway backend service:

```bash
# Required
JWT_SECRET=your-super-secure-jwt-secret
EMAIL_PROVIDER=resend
EMAIL_API_KEY=your-email-api-key
FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=https://your-frontend.up.railway.app

# Optional
FILE_STORAGE=r2
R2_ACCESS_KEY_ID=your-r2-key
R2_SECRET_ACCESS_KEY=your-r2-secret
R2_BUCKET=your-bucket
UPTIME_PING_URL=https://your-monitoring.com/ping
```

### 4. Deploy to Railway

Your existing deployment will automatically include all new features.

## 🔍 Validation Checklist

### Email Integration
- [ ] Email provider configured
- [ ] Welcome emails sent to new candidates
- [ ] Unsubscribe links work
- [ ] Webhook endpoints respond correctly

### Security
- [ ] JWT_SECRET is set and secure
- [ ] Rate limiting is active
- [ ] CORS only allows frontend domain
- [ ] Health checks return proper status

### Storage
- [ ] Files persist between deployments
- [ ] Storage type matches configuration
- [ ] Upload/download works correctly

### Monitoring
- [ ] Health endpoints return detailed info
- [ ] Uptime monitoring is active (if configured)
- [ ] Database migrations completed successfully

## 🆘 Troubleshooting

### Email Issues
- Check `EMAIL_API_KEY` is correct
- Verify `FROM_EMAIL` domain is authorized
- Check webhook URLs are accessible

### Storage Issues
- Verify cloud storage credentials
- Check file permissions
- Ensure storage service is accessible

### Rate Limiting Issues
- Check if IP is being rate limited
- Verify rate limit headers in response
- Adjust limits if needed

### Database Issues
- Run migrations: `npm run migrate`
- Check database connection
- Verify indexes were created

## 📈 Performance Benefits

With these improvements, you'll see:

- **Faster candidate search** with database indexes
- **Secure authentication** with JWT
- **Protected API** with rate limiting
- **Reliable email delivery** with bounce handling
- **Persistent file storage** across deployments
- **Comprehensive monitoring** and health checks

All existing functionality remains intact while adding these production-ready features! 🎉
