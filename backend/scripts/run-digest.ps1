$ErrorActionPreference = "Stop"
Push-Location "$PSScriptRoot\.."
try {
  node .\src\tasks\runDigest.js
} finally {
  Pop-Location
}












