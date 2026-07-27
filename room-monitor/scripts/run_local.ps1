$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $venvPython)) {
    throw "가상환경이 없습니다. 먼저 scripts\setup_windows.ps1을 실행하세요."
}

Set-Location $projectRoot

if (-not $env:API_KEY) {
    $env:API_KEY = "local-development-key"
}

Write-Host "환경 모니터 서버: http://127.0.0.1:8000"
Write-Host "종료하려면 Ctrl+C를 누르세요."
& $venvPython -m uvicorn server.app.main:app --host 0.0.0.0 --port 8000

