# Door 10 MVP - Development Guide

## Quick Start

1. Start backend: `cd backend && node src/server.js`
2. Start frontend: `cd frontend && npm run dev`
3. Access: http://localhost:3000

## Health Check

```bash
curl http://localhost:3001/health
```

## CV Parsing Test

Test the CV parsing endpoint with sample files:

```bash
# Test with sample CV
curl -F "file=@backend/tests/sample-cv.txt" http://localhost:3001/api/candidates/parse-cv

# Test with PDF (if you have one)
curl -F "file=@path/to/your/cv.pdf" http://localhost:3001/api/candidates/parse-cv

# Test with DOCX (if you have one)
curl -F "file=@path/to/your/cv.docx" http://localhost:3001/api/candidates/parse-cv
```

## Sample CV Files

Located in `backend/tests/`:
- `sample-cv.txt` - Communications professional
- `sample-cv-2.txt` - Campaigns professional  
- `sample-cv-3.txt` - Policy professional

## API Endpoints

### CV Parsing
- `POST /api/candidates/parse-cv` - Parse CV file (no auth required in dev)
- Field name: `file`
- Supported types: PDF, DOCX, TXT
- Max size: 20MB

### Health
- `GET /health` - Health check

## Troubleshooting

1. **Port conflicts**: Kill all Node processes with `taskkill /F /IM node.exe`
2. **CV parsing fails**: Check backend logs for detailed error messages
3. **File upload issues**: Verify file type and size limits

## Development Notes

- CV parsing endpoint is public in development (no auth required)
- All file uploads are validated for type and size
- Parsed data includes confidence scoring
- Error responses follow consistent format with error codes



