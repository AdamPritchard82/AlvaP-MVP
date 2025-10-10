@echo off
echo Starting Enhanced CV Parser Server...
cd /d "%~dp0"
set ENABLE_OCR=true
set LOG_LEVEL=debug
set PORT=3001
node enhanced-cv-server.js
pause













