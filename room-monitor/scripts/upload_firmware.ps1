param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern("^COM\d+$")]
    [string]$Port
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$cliPath = Join-Path $projectRoot ".tools\arduino-cli\arduino-cli.exe"

if (-not (Test-Path -LiteralPath $cliPath)) {
    throw "Arduino CLI가 없습니다. 먼저 scripts\setup_arduino.ps1을 실행하세요."
}

& $cliPath compile `
    --upload `
    --port $Port `
    --fqbn arduino:renesas_uno:unor4wifi `
    (Join-Path $projectRoot "firmware\room_monitor")

