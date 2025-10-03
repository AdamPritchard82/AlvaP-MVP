# .NET CV Parser Integration Guide

This guide covers the complete integration of the .NET CV Parser API with your existing Node.js backend and frontend.

## Overview

The .NET CV Parser API provides advanced CV parsing capabilities that complement your existing Node.js parsers. It supports PDF, DOCX, and DOC files with structured data extraction.

## Architecture

```
Frontend (React) 
    ↓
Node.js Backend (Proxy)
    ↓
.NET CV Parser API (Railway)
```

## Step 1: Deploy .NET API to Railway

### Option A: Railway CLI (Recommended)

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Navigate to .NET project**:
   ```bash
   cd CVDocumentParser.API
   ```

4. **Initialize Railway project**:
   ```bash
   railway init
   ```

5. **Deploy**:
   ```bash
   railway up
   ```

6. **Get the deployment URL**:
   ```bash
   railway domain
   ```

### Option B: GitHub Integration

1. **Push to GitHub**:
   ```bash
   git add CVDocumentParser.API/
   git commit -m "Add .NET CV Parser API"
   git push origin main
   ```

2. **Connect to Railway**:
   - Go to [Railway Dashboard](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will auto-detect the .NET project

3. **Configure Environment**:
   - Set `ASPNETCORE_ENVIRONMENT=Production`
   - Set `ASPNETCORE_URLS=http://+:8080`

### Option C: Manual Upload

1. **Create Railway Project**:
   - Go to Railway Dashboard
   - Click "New Project" → "Empty Project"

2. **Upload Files**:
   - Upload the entire `CVDocumentParser.API` folder
   - Railway will auto-detect and build

## Step 2: Configure Backend Integration

### 1. Update Environment Variables

Add to your `backend/.env` file:

```bash
# .NET CV Parser Configuration
ENABLE_DOTNET_PARSER=true
DOTNET_CV_API_URL=https://your-dotnet-api.up.railway.app
```

### 2. Install Required Dependencies

```bash
cd backend
npm install axios form-data
```

### 3. Test the Integration

Start your backend server:

```bash
cd backend
node enhanced-cv-server.js
```

Test the health check:

```bash
curl http://localhost:3001/api/cv-parser/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "services": {
    "local": {
      "status": "available",
      "adapters": ["pdf-parse", "mammoth", "text", "textract", "tesseract-ocr"]
    },
    "dotnet": {
      "status": "available",
      "url": "https://your-dotnet-api.up.railway.app",
      "supportedFormats": [".pdf", ".docx", ".doc"]
    }
  }
}
```

## Step 3: Test CV Parsing

### Test with a Sample File

```bash
curl -X POST http://localhost:3001/api/candidates/parse-cv \
  -F "file=@path/to/sample-cv.pdf"
```

### Expected Response

```json
{
  "success": true,
  "data": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@email.com",
    "phone": "+1-555-123-4567",
    "skills": {
      "communications": true,
      "campaigns": false,
      "policy": true,
      "publicAffairs": false
    },
    "experience": [
      {
        "employer": "Tech Corp",
        "title": "Software Engineer",
        "startDate": "2020-01",
        "endDate": "2023-12",
        "description": "Developed web applications"
      }
    ],
    "notes": "Experienced software engineer with expertise in...",
    "confidence": 0.85,
    "source": "dotnet-api",
    "parseConfidence": 0.85,
    "textLength": 1250,
    "duration": 1200,
    "metadata": {
      "originalFileName": "sample-cv.pdf",
      "documentType": "application/pdf",
      "parsedAt": "2024-01-15T10:30:45.123Z",
      "skills": ["C#", "JavaScript", "React"],
      "languages": ["English"],
      "certifications": [],
      "education": []
    },
    "allResults": [],
    "errors": []
  }
}
```

## Step 4: Frontend Integration

The frontend integration remains unchanged. Your existing `api.parseCV()` method will automatically use the new .NET parser when enabled.

### Test in Frontend

1. **Start the frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Upload a CV file** in the candidate creation form
3. **Check the browser console** for parsing logs
4. **Verify the parsed data** appears correctly in the form

## Step 5: Monitoring and Troubleshooting

### Health Monitoring

Check the health of all parsing services:

```bash
curl http://localhost:3001/api/cv-parser/health
```

### Logs

Check backend logs for parsing activity:

```bash
# In backend directory
tail -f logs/cv-parser.log
```

### Common Issues

1. **Connection Refused**:
   - Check if .NET API is deployed and running
   - Verify the `DOTNET_CV_API_URL` environment variable

2. **Timeout Errors**:
   - Increase timeout in `dotnetCvParser.js`
   - Check Railway service performance

3. **File Format Not Supported**:
   - Verify file type is supported by .NET API
   - Check file size limits (10MB max)

4. **CORS Issues**:
   - .NET API has CORS configured for all origins
   - Check if Railway is properly exposing the service

### Performance Tuning

1. **Adjust Confidence Thresholds**:
   ```bash
   # In backend/.env
   CONFIDENCE_THRESHOLD=0.6  # Lower = more likely to use .NET parser
   ```

2. **Enable/Disable .NET Parser**:
   ```bash
   # In backend/.env
   ENABLE_DOTNET_PARSER=false  # Disable to use only local parsers
   ```

3. **Monitor Performance**:
   - Check parsing duration in logs
   - Compare .NET vs local parser results
   - Adjust thresholds based on performance

## Step 6: Production Deployment

### Railway Production Settings

1. **Environment Variables**:
   ```bash
   ASPNETCORE_ENVIRONMENT=Production
   ASPNETCORE_URLS=http://+:8080
   ```

2. **Resource Limits**:
   - Railway will auto-scale based on usage
   - Monitor usage in Railway dashboard

3. **Custom Domain** (Optional):
   ```bash
   railway domain add your-cv-parser.com
   ```

### Backend Production Settings

1. **Update Environment**:
   ```bash
   # In production environment
   ENABLE_DOTNET_PARSER=true
   DOTNET_CV_API_URL=https://your-production-url.up.railway.app
   ```

2. **Monitoring**:
   - Set up health check monitoring
   - Configure alerting for service failures
   - Monitor parsing success rates

## API Reference

### .NET API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documentparser/parse` | POST | Parse CV file |
| `/api/documentparser/health` | GET | Health check |
| `/api/documentparser/supported-formats` | GET | Supported file formats |
| `/swagger` | GET | API documentation |

### Node.js Backend Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/candidates/parse-cv` | POST | Parse CV (with .NET integration) |
| `/api/cv-parser/health` | GET | Health check for all parsers |
| `/health` | GET | Basic health check |

## Data Flow

1. **Frontend** uploads file to `/api/candidates/parse-cv`
2. **Node.js Backend** receives file and checks if .NET parser should be used
3. **If .NET parser enabled** and file type supported:
   - File sent to .NET API at `/api/documentparser/parse`
   - .NET API parses file and returns structured data
   - Node.js transforms data to match existing format
4. **If .NET parser fails or disabled**:
   - Falls back to local parsers (pdf-parse, mammoth, etc.)
5. **Node.js Backend** returns unified response to frontend

## Benefits of This Integration

1. **Enhanced Parsing**: .NET API provides more accurate structured data extraction
2. **Fallback Support**: Local parsers ensure service availability
3. **Unified Interface**: Frontend code remains unchanged
4. **Scalability**: .NET API can be scaled independently
5. **Monitoring**: Comprehensive health checks and logging
6. **Flexibility**: Easy to enable/disable .NET parser

## Next Steps

1. **Deploy the .NET API** to Railway
2. **Update your backend** environment variables
3. **Test the integration** with sample files
4. **Monitor performance** and adjust thresholds
5. **Deploy to production** when ready

## Support

For issues with:
- **Railway deployment**: Check Railway documentation
- **.NET API**: Check the API's Swagger documentation
- **Integration**: Check backend logs and health endpoints
- **Frontend**: Verify API calls and response handling
