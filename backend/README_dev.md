# Door 10 MVP - Development Testing

## Quick Start

### Option 1: Batch Files (Windows)
1. **Double-click `start-backend.bat`** - starts backend on http://localhost:3001
2. **Double-click `start-frontend.bat`** - starts frontend on http://localhost:3000

### Option 2: Manual Commands
1. Start the backend server:
   ```bash
   cd backend
   npm install
   node src/server.js
   ```

2. Start the frontend (in another terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Quick Test
1. **Double-click `start-backend.bat`**
2. **Visit http://localhost:3001/health** → should return `{ ok: true }`
3. **In another terminal:**
   ```bash
   cd backend
   node tests/post-file.js tests/sample-text.txt
   node tests/post-file.js tests/sample-docx.txt
   node tests/post-file.js tests/sample-pdf.txt
   ```
4. **Expected:** JSON with firstName/lastName/email, skills, experience[], and "source" showing extractor used.

## Testing CV Parsing

### Sample CVs
Test files are available in `backend/tests/`:
- `sample-cv-1.txt` - Communications professional
- `sample-cv-2.txt` - Campaigns specialist  
- `sample-cv-3.txt` - Policy advisor

### cURL Examples

Test CV parsing endpoint:
```bash
# Test with sample files
curl -F "file=@tests/sample.txt" http://localhost:3002/api/candidates/parse-cv
curl -F "file=@tests/sample.pdf" http://localhost:3002/api/candidates/parse-cv
curl -F "file=@tests/sample-docx.txt" http://localhost:3002/api/candidates/parse-cv

# Test with your own files
curl -F "file=@path/to/your/cv.pdf" http://localhost:3002/api/candidates/parse-cv
curl -F "file=@path/to/your/cv.docx" http://localhost:3002/api/candidates/parse-cv
```

### Expected Response Format
```json
{
  "success": true,
  "data": {
    "firstName": "John",
    "lastName": "Smith",
    "email": "john.smith@example.com",
    "phone": "+44 7700 900123",
    "skills": {
      "communications": true,
      "campaigns": false,
      "policy": true,
      "publicAffairs": true
    },
    "experience": [
      {
        "employer": "Policy Solutions Ltd",
        "title": "Senior Communications Manager",
        "startDate": "2020",
        "endDate": "Present"
      }
    ],
    "notes": "Experienced communications professional with over 8 years...",
    "source": "fs",
    "confidence": 0.85
  }
}
```

## API Endpoints

### Health Check
```bash
curl http://localhost:3001/health
```

### Candidates
```bash
# List candidates
curl http://localhost:3001/api/candidates

# Get specific candidate
curl http://localhost:3001/api/candidates/{id}

# Create candidate
curl -X POST http://localhost:3001/api/candidates \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","email":"john@example.com"}'

# Update candidate
curl -X PATCH http://localhost:3001/api/candidates/{id} \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","lastName":"Smith"}'

# Delete candidate
curl -X DELETE http://localhost:3001/api/candidates/{id}
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Make sure ports 3000 (frontend) and 3001 (backend) are available
2. **File upload errors**: Check file size limits (20MB max) and supported formats
3. **Database errors**: Ensure SQLite database is properly initialized
4. **CORS issues**: Backend is configured to allow `http://localhost:3000`

### Logs
- Backend logs are printed to console
- Look for `=== CV PARSE START ===` and `=== CV PARSE OK ===` messages
- Check for error messages in the console output

### File Support
- **PDF**: Uses `pdf-parse` with `textract` fallback
- **DOCX**: Uses `mammoth` with `textract` fallback  
- **TXT**: Direct file reading
- **Other formats**: Attempts `textract` extraction

## Development Notes

- CV parsing is currently unauthenticated in development
- File uploads are stored in `../data/uploads/` (relative to backend)
- Database is SQLite at `../data/door10.sqlite`
- All timestamps are in ISO format
- Skills are stored as boolean values (true/false)

