# Simple CV Parser Test
$backendUrl = "https://natural-kindness-production.up.railway.app"
$parserUrl = "https://positive-bravery-production.up.railway.app"

Write-Host "=== Simple CV Parser Test ===" -ForegroundColor Green
Write-Host ""

# Test backend health
Write-Host "Testing backend health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod "$backendUrl/health"
    Write-Host "✅ Backend health: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend health failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test parser health
Write-Host "Testing parser health..." -ForegroundColor Yellow
try {
    $parserHealth = Invoke-RestMethod "$parserUrl/api/documentparser/health"
    Write-Host "✅ Parser health: $($parserHealth.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Parser health failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test backend version
Write-Host "Testing backend version..." -ForegroundColor Yellow
try {
    $version = Invoke-RestMethod "$backendUrl/meta/version"
    Write-Host "✅ Backend version endpoint working" -ForegroundColor Green
    Write-Host "   Git SHA: $($version.gitSha)" -ForegroundColor Cyan
    Write-Host "   .NET URL: $($version.dotnetUrl)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Backend version failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 All basic tests passed! ✅" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: Test CV parsing with a real file" -ForegroundColor Cyan
