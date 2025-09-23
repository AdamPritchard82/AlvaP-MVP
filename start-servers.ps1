# Start both backend and frontend servers
Write-Host "Starting Door 10 MVP servers..."

# Start backend in background
Write-Host "Starting backend server..."
Start-Process -FilePath "cmd" -ArgumentList "/c", "cd backend && npm start" -WindowStyle Hidden

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start frontend in background  
Write-Host "Starting frontend server..."
Start-Process -FilePath "cmd" -ArgumentList "/c", "cd frontend && npm run dev" -WindowStyle Hidden

Write-Host "Both servers should now be starting..."
Write-Host "Backend: http://localhost:3001"
Write-Host "Frontend: http://localhost:5173"
Write-Host "Press any key to stop servers..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")




