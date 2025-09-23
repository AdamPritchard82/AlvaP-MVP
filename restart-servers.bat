@echo off
echo Killing all Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo Starting backend...
cd backend
start "Backend Server" cmd /k "node src/server.js"

echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo Starting frontend...
cd ..\frontend
start "Frontend Server" cmd /k "npm run dev"

echo Both servers should now be starting...
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
pause




