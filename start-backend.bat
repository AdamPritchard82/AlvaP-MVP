@echo off
cd /d "%~dp0backend"
set PORT=3001
echo Starting backend on http://localhost:%PORT%
npm run dev