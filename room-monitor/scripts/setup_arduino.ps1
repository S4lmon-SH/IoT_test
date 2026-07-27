$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$toolDirectory = Join-Path $projectRoot ".tools\arduino-cli"
$cliPath = Join-Path $toolDirectory "arduino-cli.exe"
$cliVersion = "1.5.1"

if (-not (Test-Path -LiteralPath $cliPath)) {
    New-Item -ItemType Directory -Force -Path $toolDirectory | Out-Null
    $archivePath = Join-Path $toolDirectory "arduino-cli.zip"
    $downloadUrl = "https://github.com/arduino/arduino-cli/releases/download/v$cliVersion/arduino-cli_$($cliVersion)_Windows_64bit.zip"

    Write-Host "[1/4] Arduino CLI를 내려받습니다."
    Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath
    Expand-Archive -LiteralPath $archivePath -DestinationPath $toolDirectory -Force
} else {
    Write-Host "[1/4] Arduino CLI가 이미 설치되어 있습니다."
}

Write-Host "[2/4] Arduino 패키지 목록을 갱신합니다."
& $cliPath core update-index

Write-Host "[3/4] UNO R4 보드 패키지를 설치합니다."
& $cliPath core install arduino:renesas_uno

Write-Host "[4/4] DHT11 라이브러리를 설치합니다."
& $cliPath lib install "DHT sensor library" "Adafruit Unified Sensor"

Write-Host "Arduino 개발 환경 준비가 끝났습니다."
& $cliPath version

