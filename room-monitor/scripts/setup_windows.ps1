$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"

Set-Location $projectRoot

if (-not (Test-Path -LiteralPath $venvPython)) {
    Write-Host "[1/3] Python 가상환경을 만듭니다."
    python -m venv .venv
}

Write-Host "[2/3] 서버와 테스트 패키지를 설치합니다."
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r server\requirements-dev.txt

if (-not (Test-Path -LiteralPath ".env")) {
    Copy-Item -LiteralPath ".env.example" -Destination ".env"
}

Write-Host "[3/3] 준비가 끝났습니다."
Write-Host "서버 실행: powershell -ExecutionPolicy Bypass -File .\scripts\run_local.ps1"

