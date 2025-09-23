@echo off
cd /d "%~dp0frontend"
set PORT=3000
echo Starting frontend on http://localhost:%PORT%
npm start