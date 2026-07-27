param(
    [string]$PublicHost = "134-185-118-90.sslip.io",
    [string]$CredentialPath = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $CredentialPath) {
    $CredentialPath = Join-Path $projectRoot "deploy\credentials.txt"
}
$secretHeader = Join-Path $projectRoot "firmware\room_monitor\arduino_secrets.h"

if (-not (Test-Path -LiteralPath $CredentialPath)) {
    throw "배포 자격정보 파일을 찾지 못했습니다: $CredentialPath"
}
if (-not (Test-Path -LiteralPath $secretHeader)) {
    throw "Arduino 비밀 설정 파일을 찾지 못했습니다: $secretHeader"
}

$apiKeyLine = Get-Content -LiteralPath $CredentialPath |
    Where-Object { $_ -like "Device API key:*" } |
    Select-Object -First 1

if (-not $apiKeyLine) {
    throw "배포 자격정보에서 Device API key를 찾지 못했습니다."
}

$apiKey = $apiKeyLine.Substring($apiKeyLine.IndexOf(":") + 1).Trim()
$content = Get-Content -LiteralPath $secretHeader -Raw
$content = $content -replace '#define SERVER_HOST ".*"', "#define SERVER_HOST `"$PublicHost`""
$content = $content -replace '#define SERVER_PORT \d+', "#define SERVER_PORT 443"
$content = $content -replace '#define SERVER_USE_TLS \d+', "#define SERVER_USE_TLS 1"
$content = $content -replace '#define DEVICE_API_KEY ".*"', "#define DEVICE_API_KEY `"$apiKey`""

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($secretHeader, $content, $utf8WithoutBom)

Write-Host "Arduino의 Oracle HTTPS 대상과 장치 API 키를 설정했습니다."
Write-Host "Wi-Fi 이름과 비밀번호는 사용자가 직접 입력해야 합니다."
