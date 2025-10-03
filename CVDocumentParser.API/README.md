# CV Document Parser API

A .NET 8.0 Web API for parsing CV documents from PDF and Word formats.

## Features

- **PDF Parsing**: Using iText7 for reliable PDF text extraction
- **Word Document Parsing**: Support for .docx and .doc formats using DocumentFormat.OpenXml
- **Structured Data Extraction**: Extracts personal info, work experience, education, skills, and more
- **File Validation**: Comprehensive file type and size validation
- **CORS Support**: Ready for frontend integration
- **Swagger Documentation**: Interactive API documentation

## Supported File Formats

- PDF (.pdf)
- Word 2007+ (.docx)
- Word 97-2003 (.doc)
- Maximum file size: 10MB

## API Endpoints

### Parse CV
```http
POST /api/documentparser/parse
Content-Type: multipart/form-data

file: [CV file]
```

**Response:**
```json
{
  "success": true,
  "message": "CV parsed successfully",
  "data": {
    "personalInfo": {
      "name": "John Doe",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@email.com",
      "phone": "+1-555-123-4567",
      "address": null,
      "linkedIn": "linkedin.com/in/johndoe"
    },
    "workExperience": [
      {
        "jobTitle": "Software Engineer",
        "company": "Tech Corp",
        "startDate": "2020-01",
        "endDate": "2023-12",
        "description": "Developed web applications",
        "responsibilities": [],
        "isCurrentPosition": false
      }
    ],
    "education": [],
    "skills": ["C#", "JavaScript", "React"],
    "languages": ["English", "Spanish"],
    "certifications": [],
    "summary": "Experienced software engineer...",
    "parsedAt": "2024-01-15T10:30:45.123Z",
    "originalFileName": "cv.pdf",
    "documentType": "PDF"
  },
  "errors": [],
  "processedAt": "2024-01-15T10:30:45.123Z"
}
```

### Health Check
```http
GET /api/documentparser/health
```

### Supported Formats
```http
GET /api/documentparser/supported-formats
```

## Local Development

### Prerequisites
- .NET 8.0 SDK
- Visual Studio 2022 or VS Code

### Running Locally
```bash
# Navigate to the project directory
cd CVDocumentParser.API

# Restore dependencies
dotnet restore

# Run the application
dotnet run
```

The API will be available at:
- HTTP: `http://localhost:5000`
- HTTPS: `https://localhost:5001`
- Swagger UI: `http://localhost:5000` (in development)

## Railway Deployment

### Method 1: Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Method 2: GitHub Integration
1. Push this code to a GitHub repository
2. Connect the repository to Railway
3. Railway will auto-detect the .NET project and deploy

### Method 3: Manual Upload
1. Create a new project in Railway dashboard
2. Upload the project files
3. Railway will build and deploy automatically

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ASPNETCORE_ENVIRONMENT` | Environment (Development/Production) | `Production` |
| `ASPNETCORE_URLS` | URLs to bind to | `http://+:8080` |

## Configuration

The API uses `appsettings.json` for configuration. Key settings:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ParsingConfiguration": {
    "MaxFileSize": 10485760,
    "AllowedExtensions": [".pdf", ".docx", ".doc"]
  }
}
```

## Integration with Node.js Backend

This API is designed to be called from your existing Node.js backend. See the integration guide in the main project documentation.

## Error Handling

The API returns structured error responses:

```json
{
  "success": false,
  "message": "File validation failed",
  "errors": ["File size cannot exceed 10MB"],
  "processedAt": "2024-01-15T10:30:45.123Z"
}
```

## Performance Considerations

- File size limit: 10MB
- Request timeout: 30 seconds
- Memory usage: Optimized for large documents
- Concurrent requests: Handled by .NET's built-in thread pool

## Security

- File type validation
- File size limits
- CORS configuration
- Input sanitization
- Error message sanitization

## Monitoring

- Health check endpoint for monitoring
- Structured logging
- Performance metrics
- Error tracking

## License

This project is part of the Door 10 MVP system.