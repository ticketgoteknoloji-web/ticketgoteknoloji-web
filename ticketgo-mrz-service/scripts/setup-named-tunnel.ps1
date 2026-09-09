# Cloudflare Named Tunnel setup helper for TicketGo MRZ.
# Does not print secrets. Stops when interactive Cloudflare login is required.

param(
    [string]$Hostname = "mrz.ticketgoteknoloji.com",
    [string]$TunnelName = "ticketgo-mrz",
    [string]$Origin = "http://127.0.0.1:8091"
)

$ErrorActionPreference = "Stop"
$cloudflared = Join-Path $env:LOCALAPPDATA "cloudflared\cloudflared.exe"
if (-not (Test-Path $cloudflared)) {
    Write-Output "STATUS=MISSING_CLOUDFLARED"
    Write-Output "ACTION=Install cloudflared, then re-run this script."
    exit 2
}

$cert = Join-Path $env:USERPROFILE ".cloudflared\cert.pem"
if (-not (Test-Path $cert)) {
    Write-Output "STATUS=NOT_AUTHENTICATED"
    Write-Output "HOSTNAME=$Hostname"
    Write-Output "TUNNEL_NAME=$TunnelName"
    Write-Output "ORIGIN=$Origin"
    Write-Output "ACTION=Run: `"$cloudflared`" tunnel login"
    Write-Output "ACTION_DETAIL=Browser opens; select the Cloudflare account that owns ticketgoteknoloji.com, then authorize."
    Write-Output "NEXT_AFTER_LOGIN=Re-run this script to create named tunnel + DNS route."
    exit 3
}

Write-Output "STATUS=AUTHENTICATED"
Write-Output "Creating or reusing named tunnel (name only, no secrets printed)..."

# Create tunnel if missing
$list = & $cloudflared tunnel list 2>&1 | Out-String
if ($list -notmatch [regex]::Escape($TunnelName)) {
    & $cloudflared tunnel create $TunnelName | Out-Null
}

# Resolve tunnel id without dumping credential files
$json = & $cloudflared tunnel list --output json 2>$null
$tunnelId = $null
if ($json) {
    try {
        $arr = $json | ConvertFrom-Json
        $match = $arr | Where-Object { $_.name -eq $TunnelName } | Select-Object -First 1
        if ($match) { $tunnelId = [string]$match.id }
    } catch { }
}
if (-not $tunnelId) {
    Write-Output "STATUS=TUNNEL_ID_UNRESOLVED"
    Write-Output "ACTION=Run: cloudflared tunnel list   then set tunnel id in config.yml manually from example."
    exit 4
}

$configDir = Join-Path $env:USERPROFILE ".cloudflared"
$configPath = Join-Path $configDir "config.yml"
$credPath = Join-Path $configDir "$tunnelId.json"

@"
tunnel: $tunnelId
credentials-file: $credPath

ingress:
  - hostname: $Hostname
    service: $Origin
  - service: http_status:404
"@ | Set-Content -Path $configPath -Encoding utf8

Write-Output "CONFIG_WRITTEN=$configPath"
Write-Output "Routing DNS (CNAME) for $Hostname -> tunnel..."
& $cloudflared tunnel route dns $TunnelName $Hostname
if ($LASTEXITCODE -ne 0) {
    Write-Output "STATUS=DNS_ROUTE_FAILED"
    Write-Output "ACTION=In Cloudflare Dashboard: DNS -> add CNAME $Hostname pointing to <tunnel-id>.cfargotunnel.com (Proxied)."
    exit 5
}

Write-Output "STATUS=READY_TO_RUN"
Write-Output "HOSTNAME=$Hostname"
Write-Output "ACTION=Start tunnel: `"$cloudflared`" tunnel run $TunnelName"
Write-Output "ACTION_VERIFY=curl https://$Hostname/health"
Write-Output "NOTE=Keep Bearer auth. Do not open 8091 publicly. Do not activate n8n until hostname returns 200."
exit 0
