$ErrorActionPreference = "Stop"

function ConvertTo-CppString {
    param([string]$Value)
    return $Value.Replace("\", "\\").Replace('"', '\"')
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$secretHeader = Join-Path $projectRoot "firmware\room_monitor\arduino_secrets.h"

if (-not (Test-Path -LiteralPath $secretHeader)) {
    throw "Arduino 비밀 설정 파일을 찾지 못했습니다: $secretHeader"
}

$ssid = Read-Host "2.4GHz Wi-Fi name (SSID)"
$securePassword = Read-Host "Wi-Fi password (hidden)" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
    $securePassword
)

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
        $passwordPointer
    )
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}

if ([string]::IsNullOrWhiteSpace($ssid)) {
    throw "Wi-Fi 이름은 비워 둘 수 없습니다."
}
if ([string]::IsNullOrEmpty($plainPassword)) {
    throw "Wi-Fi 비밀번호는 비워 둘 수 없습니다."
}

$escapedSsid = ConvertTo-CppString $ssid
$escapedPassword = ConvertTo-CppString $plainPassword
$content = Get-Content -LiteralPath $secretHeader -Raw
$content = $content -replace '#define WIFI_SSID ".*"', "#define WIFI_SSID `"$escapedSsid`""
$content = $content -replace '#define WIFI_PASSWORD ".*"', "#define WIFI_PASSWORD `"$escapedPassword`""

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($secretHeader, $content, $utf8WithoutBom)

$plainPassword = $null
Write-Host "Wi-Fi settings saved. The password was not displayed."
