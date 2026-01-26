$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

if (-not (Test-Path ".venv\Scripts\python.exe")) {
  throw ".venv not found. Run .\\setup_venv.ps1 first."
}

# For manual testing; Rust spawns this automatically.
.\.venv\Scripts\python ml_server.py
