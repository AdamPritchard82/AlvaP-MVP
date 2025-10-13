Param(
  [string]$Api    = "https://natural-kindness-production.up.railway.app",
  [string]$Parser = "https://positive-bravery-production.up.railway.app",
  [string]$CvPath = ".\tests\sample.pdf"
)

Write-Host "=== AlvaP CV Parser Smoke Test ===" -ForegroundColor Green
Write-Host ""

Write-Host "-- Testing parser health..." -ForegroundColor Yellow
try {
  $parserHealth = Invoke-WebRequest "$Parser/healthz" -UseBasicParsing
  Write-Host "✅ Parser health check passed" -ForegroundColor Green
} catch {
  Write-Host "❌ Parser health check failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "-- Testing backend version endpoint..." -ForegroundColor Yellow
try {
  $version = Invoke-RestMethod "$Api/meta/version"
  Write-Host "✅ Backend version endpoint working" -ForegroundColor Green
  Write-Host "   Git SHA: $($version.gitSha)" -ForegroundColor Cyan
  Write-Host "   Build Time: $($version.buildTime)" -ForegroundColor Cyan
  Write-Host "   .NET URL: $($version.dotnetUrl)" -ForegroundColor Cyan
  Write-Host "   Node Version: $($version.nodeVersion)" -ForegroundColor Cyan
} catch {
  Write-Host "❌ Backend version endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "-- Testing direct parser..." -ForegroundColor Yellow
if (-not (Test-Path $CvPath)) {
  Write-Host "❌ CV file not found: $CvPath" -ForegroundColor Red
  Write-Host "   Please provide a valid CV file path" -ForegroundColor Yellow
  exit 1
}

try {
  $parserResult = curl -s -F "file=@$CvPath" "$Parser/parse" | ConvertFrom-Json
  if (-not $parserResult.success) {
    throw "Parser returned success=false: $($parserResult.message)"
  }
  
  $data = $parserResult.data
  Write-Host "✅ Direct parser test passed" -ForegroundColor Green
  Write-Host "   Name: $($data.personalInfo.name)" -ForegroundColor Cyan
  Write-Host "   Email: $($data.personalInfo.email)" -ForegroundColor Cyan
  Write-Host "   Phone: $($data.personalInfo.phone)" -ForegroundColor Cyan
  
  # Check for required fields
  if ([string]::IsNullOrWhiteSpace($data.personalInfo.phone)) {
    Write-Host "⚠️  Warning: Phone number is empty" -ForegroundColor Yellow
  }
  if ($data.workExperience.Count -eq 0) {
    Write-Host "⚠️  Warning: No work experience found" -ForegroundColor Yellow
  } else {
    $firstJob = $data.workExperience[0]
    Write-Host "   Job Title: $($firstJob.jobTitle)" -ForegroundColor Cyan
    Write-Host "   Company: $($firstJob.company)" -ForegroundColor Cyan
    if ([string]::IsNullOrWhiteSpace($firstJob.jobTitle)) {
      Write-Host "⚠️  Warning: Job title is empty" -ForegroundColor Yellow
    }
    if ([string]::IsNullOrWhiteSpace($firstJob.company)) {
      Write-Host "⚠️  Warning: Company name is empty" -ForegroundColor Yellow
    }
  }
} catch {
  Write-Host "❌ Direct parser test failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "-- Testing end-to-end via backend..." -ForegroundColor Yellow
try {
  $backendResult = curl -s -F "file=@$CvPath" "$Api/api/candidates/parse-cv" | ConvertFrom-Json
  if (-not $backendResult.success) {
    throw "Backend returned success=false: $($backendResult.error)"
  }
  
  $data = $backendResult.data
  Write-Host "✅ End-to-end test passed" -ForegroundColor Green
  Write-Host "   Name: $($data.firstName) $($data.lastName)" -ForegroundColor Cyan
  Write-Host "   Email: $($data.email)" -ForegroundColor Cyan
  Write-Host "   Phone: $($data.phone)" -ForegroundColor Cyan
  Write-Host "   Current Title: $($data.currentTitle)" -ForegroundColor Cyan
  Write-Host "   Current Employer: $($data.currentEmployer)" -ForegroundColor Cyan
  
  # Check for required fields
  if ([string]::IsNullOrWhiteSpace($data.phone)) {
    Write-Host "⚠️  Warning: Phone number is empty" -ForegroundColor Yellow
  }
  if ([string]::IsNullOrWhiteSpace($data.currentTitle)) {
    Write-Host "⚠️  Warning: Current job title is empty" -ForegroundColor Yellow
  }
  if ([string]::IsNullOrWhiteSpace($data.currentEmployer)) {
    Write-Host "⚠️  Warning: Current employer is empty" -ForegroundColor Yellow
  }
} catch {
  Write-Host "❌ End-to-end test failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "🎉 All smoke tests passed! ✅" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  - Parser health: ✅" -ForegroundColor Green
Write-Host "  - Backend version: ✅" -ForegroundColor Green
Write-Host "  - Direct parser: ✅" -ForegroundColor Green
Write-Host "  - End-to-end: ✅" -ForegroundColor Green
