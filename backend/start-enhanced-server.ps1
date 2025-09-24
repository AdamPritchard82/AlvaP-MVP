# Enhanced CV Parser Server Startup Script
Write-Host "Starting Enhanced CV Parser Server..." -ForegroundColor Green

# Set environment variables
$env:ENABLE_OCR = "true"
$env:LOG_LEVEL = "debug"
$env:PORT = "3001"

# Start the server
Write-Host "Environment configured:" -ForegroundColor Yellow
Write-Host "  OCR Enabled: $env:ENABLE_OCR" -ForegroundColor Cyan
Write-Host "  Log Level: $env:LOG_LEVEL" -ForegroundColor Cyan
Write-Host "  Port: $env:PORT" -ForegroundColor Cyan
Write-Host ""

try {
    node enhanced-cv-server.js
} catch {
    Write-Host "Error starting server: $_" -ForegroundColor Red
    Read-Host "Press Enter to continue"
}



