param(
    [double]$Temperature = 24.8,
    [double]$Humidity = 57.0,
    [string]$ApiKey = "local-development-key",
    [string]$ServerUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"

$body = @{
    device_id = "room-uno-r4"
    temperature = $Temperature
    humidity = $Humidity
    motion = $false
} | ConvertTo-Json

$result = Invoke-RestMethod `
    -Method Post `
    -Uri "$ServerUrl/api/v1/readings" `
    -Headers @{"X-API-Key" = $ApiKey} `
    -ContentType "application/json" `
    -Body $body

$result | Format-List

