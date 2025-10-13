# Test PDF Parsing
$parserUrl = "https://positive-bravery-production.up.railway.app"
$backendUrl = "https://natural-kindness-production.up.railway.app"
$pdfFile = "backend/tests/sample.pdf"

Write-Host "=== Testing PDF Parsing ===" -ForegroundColor Green
Write-Host ""

if (-not (Test-Path $pdfFile)) {
    Write-Host "❌ PDF file not found: $pdfFile" -ForegroundColor Red
    exit 1
}

Write-Host "Using PDF file: $pdfFile" -ForegroundColor Cyan
Write-Host "File size: $((Get-Item $pdfFile).Length) bytes" -ForegroundColor Cyan
Write-Host ""

# Test .NET Parser directly with PDF
try {
    Write-Host "Testing .NET parser with PDF..." -ForegroundColor Yellow
    
    $file = Get-Item $pdfFile
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    
    $fileBytes = [System.IO.File]::ReadAllBytes($file.FullName)
    
    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$($file.Name)`"",
        "Content-Type: application/pdf",
        "",
        [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($fileBytes),
        "--$boundary--",
        ""
    ) -join $LF
    
    $result = Invoke-RestMethod -Uri "$parserUrl/api/documentparser/parse" -Method POST -Body $bodyLines -ContentType "multipart/form-data; boundary=$boundary"
    
    Write-Host "✅ .NET Parser Response:" -ForegroundColor Green
    $result | ConvertTo-Json -Depth 10 | Write-Host
    
} catch {
    Write-Host "❌ .NET Parser failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $response = $_.Exception.Response
        Write-Host "Status: $($response.StatusCode)" -ForegroundColor Red
        Write-Host "Status Description: $($response.StatusDescription)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Testing Backend with PDF ===" -ForegroundColor Green

# Test backend with PDF
try {
    Write-Host "Testing backend with PDF..." -ForegroundColor Yellow
    
    $file = Get-Item $pdfFile
    $boundary2 = [System.Guid]::NewGuid().ToString()
    
    $fileBytes2 = [System.IO.File]::ReadAllBytes($file.FullName)
    
    $bodyLines2 = (
        "--$boundary2",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$($file.Name)`"",
        "Content-Type: application/pdf",
        "",
        [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($fileBytes2),
        "--$boundary2--",
        ""
    ) -join $LF
    
    $backendResult = Invoke-RestMethod -Uri "$backendUrl/api/candidates/parse-cv" -Method POST -Body $bodyLines2 -ContentType "multipart/form-data; boundary=$boundary2"
    
    Write-Host "✅ Backend Response:" -ForegroundColor Green
    $backendResult | ConvertTo-Json -Depth 10 | Write-Host
    
} catch {
    Write-Host "❌ Backend failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $response = $_.Exception.Response
        Write-Host "Status: $($response.StatusCode)" -ForegroundColor Red
        Write-Host "Status Description: $($response.StatusDescription)" -ForegroundColor Red
    }
}
