# Test .NET Parser Directly
$parserUrl = "https://positive-bravery-production.up.railway.app"

Write-Host "=== Testing .NET Parser Directly ===" -ForegroundColor Green
Write-Host ""

# Test with a simple text file first
$testContent = @"
Name: Adam Pritchard
Email: adam@door10.co.uk
Phone: +44 1234 567890
Job Title: Director
Company: Door 10 Software
"@

$tempFile = "test-cv.txt"
$testContent | Out-File -FilePath $tempFile -Encoding UTF8

try {
    Write-Host "Testing .NET parser with text file..." -ForegroundColor Yellow
    
    # Create multipart form data
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    
    $fileBytes = [System.IO.File]::ReadAllBytes($tempFile)
    $fileContent = [System.Text.Encoding]::UTF8.GetString($fileBytes)
    
    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$tempFile`"",
        "Content-Type: text/plain",
        "",
        $fileContent,
        "--$boundary--",
        ""
    ) -join $LF
    
    $result = Invoke-RestMethod -Uri "$parserUrl/api/documentparser/parse" -Method POST -Body $bodyLines -ContentType "multipart/form-data; boundary=$boundary"
    
    Write-Host "✅ .NET Parser Response:" -ForegroundColor Green
    $result | ConvertTo-Json -Depth 10 | Write-Host
    
} catch {
    Write-Host "❌ .NET Parser failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
} finally {
    # Clean up
    if (Test-Path $tempFile) {
        Remove-Item $tempFile
    }
}

Write-Host ""
Write-Host "=== Testing Backend CV Parsing ===" -ForegroundColor Green

# Test backend CV parsing
try {
    Write-Host "Testing backend CV parsing..." -ForegroundColor Yellow
    
    $testContent2 = @"
Name: John Smith
Email: john@example.com
Phone: +44 9876 543210
Job Title: Software Engineer
Company: Tech Corp
"@

    $tempFile2 = "test-cv2.txt"
    $testContent2 | Out-File -FilePath $tempFile2 -Encoding UTF8
    
    $boundary2 = [System.Guid]::NewGuid().ToString()
    $fileBytes2 = [System.IO.File]::ReadAllBytes($tempFile2)
    $fileContent2 = [System.Text.Encoding]::UTF8.GetString($fileBytes2)
    
    $bodyLines2 = (
        "--$boundary2",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$tempFile2`"",
        "Content-Type: text/plain",
        "",
        $fileContent2,
        "--$boundary2--",
        ""
    ) -join $LF
    
    $backendResult = Invoke-RestMethod -Uri "https://natural-kindness-production.up.railway.app/api/candidates/parse-cv" -Method POST -Body $bodyLines2 -ContentType "multipart/form-data; boundary=$boundary2"
    
    Write-Host "✅ Backend CV Parsing Response:" -ForegroundColor Green
    $backendResult | ConvertTo-Json -Depth 10 | Write-Host
    
} catch {
    Write-Host "❌ Backend CV Parsing failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
} finally {
    # Clean up
    if (Test-Path $tempFile2) {
        Remove-Item $tempFile2
    }
}
