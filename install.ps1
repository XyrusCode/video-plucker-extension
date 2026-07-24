Write-Host "==========================================="
Write-Host "  Xyrus' Youtube Plucker - Setup"
Write-Host "==========================================="
Write-Host ""

# Check Python
try {
    $pyVersion = python --version 2>&1
    Write-Host "✓ $pyVersion"
} catch {
    Write-Host "Error: Python 3 not found. Please install Python 3.8+ first."
    exit 1
}

$pyVerMatch = [regex]::Match($pyVersion, '(\d+)\.(\d+)')
if (-not $pyVerMatch.Success) {
    Write-Host "Error: Could not parse Python version."
    exit 1
}

$pyMajor = [int]$pyVerMatch.Groups[1].Value
$pyMinor = [int]$pyVerMatch.Groups[2].Value

if ($pyMajor -lt 3 -or ($pyMajor -eq 3 -and $pyMinor -lt 8)) {
    Write-Host "Error: Python 3.8+ required (found $pyMajor.$pyMinor)"
    exit 1
}

# Navigate to backend
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$ScriptDir\backend"

# Create virtual environment
if (-not (Test-Path "venv")) {
    Write-Host ""
    Write-Host "Creating virtual environment..."
    python -m venv venv
}

Write-Host "Activating virtual environment..."
& .\venv\Scripts\Activate.ps1

Write-Host "Installing dependencies..."
pip install -r requirements.txt

Write-Host ""
Write-Host "==========================================="
Write-Host "  Setup Complete!"
Write-Host "==========================================="
Write-Host ""
Write-Host "  To start the backend server:"
Write-Host "    cd .\backend; .\run.ps1"
Write-Host ""
Write-Host "  Then load the extension in Chrome:"
Write-Host "    1. Open chrome://extensions"
Write-Host "    2. Enable 'Developer mode' (top right)"
Write-Host "    3. Click 'Load unpacked'"
Write-Host "    4. Select the 'extension' folder"
Write-Host ""
Write-Host "  Default backend URL: http://localhost:8000"
Write-Host "  (Configure in extension Options page)"
Write-Host ""
