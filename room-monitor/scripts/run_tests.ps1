$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $venvPython)) {
    throw "가상환경이 없습니다. 먼저 scripts\setup_windows.ps1을 실행하세요."
}

Set-Location $projectRoot
& $venvPython -m pytest -q

