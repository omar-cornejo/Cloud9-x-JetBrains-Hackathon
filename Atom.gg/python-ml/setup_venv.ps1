$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw "python not found on PATH. Install Python 3.10+ and try again."
}

if (-not (Test-Path ".venv")) {
  python -m venv .venv
}

.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -r requirements-venv.txt

Write-Host "Done. To run the ML server:" 
Write-Host "  .\\.venv\\Scripts\\python ml_server.py" 
