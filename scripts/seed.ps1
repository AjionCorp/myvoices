# Seed 100,000 blocks into SpacetimeDB in batches.
# Usage: .\scripts\seed.ps1 [-Clear] [-AdsOnly] [-BatchSize 5000]
#
# Prerequisites:
#   1. spacetime login          (authenticate with spacetimedb.com)
#   2. Ensure your CLI identity is an admin in the user_profile table.
#      Run:  spacetime sql myvoice "SELECT * FROM user_profile" -s maincloud.spacetimedb.com
#      If not present or not admin, run with -BootstrapAdmin first.

param(
    [switch]$Clear,
    [switch]$AdsOnly,
    [switch]$BootstrapAdmin,
    [int]$BatchSize = 5000,
    [string]$Server = "maincloud.spacetimedb.com",
    [string]$Database = "myvoice"
)

$ErrorActionPreference = "Stop"
$Total = 100000

function Invoke-Reducer {
    param([string]$Name, [string[]]$Args)
    $parts = @($Database, $Name) + $Args
    Write-Host "  spacetime call $Database $Name $($Args -join ' ')" -ForegroundColor DarkGray
    $output = & spacetime call @parts -s $Server -y 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Reducer $Name failed (exit $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "  $output" -ForegroundColor Red
        return $false
    }
    return $true
}

function Invoke-Sql {
    param([string]$Query)
    Write-Host "  SQL: $Query" -ForegroundColor DarkGray
    $output = & spacetime sql $Database $Query -s $Server -y 2>&1
    Write-Host "  $output" -ForegroundColor DarkGray
    return $output
}

if ($BootstrapAdmin) {
    Write-Host "`n=== Bootstrapping admin identity ===" -ForegroundColor Yellow
    $loginOutput = & spacetime login show 2>&1
    $identity = ($loginOutput | Select-String -Pattern '[0-9a-f]{64}').Matches[0].Value
    Write-Host "  CLI identity: $identity" -ForegroundColor White

    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000
    $query = "INSERT INTO user_profile (identity, display_name, email, stripe_account_id, total_earnings, is_admin, created_at) VALUES ('$identity', 'Admin', '', '', 0, true, $now)"
    Invoke-Sql $query
    Write-Host "  Admin user bootstrapped.`n" -ForegroundColor Green
}

if ($Clear) {
    Write-Host "`n=== Clearing all blocks ===" -ForegroundColor Yellow
    $result = Invoke-Reducer "clear_all_blocks"
    if ($result -eq $false) {
        Write-Host "Clear failed. Make sure your identity is an admin (-BootstrapAdmin)." -ForegroundColor Red
        exit 1
    }
    Write-Host "Cleared.`n" -ForegroundColor Green
}

if (-not $AdsOnly) {
    Write-Host "=== Seeding $Total blocks in batches of $BatchSize ===" -ForegroundColor Cyan
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $offset = 0
    while ($offset -lt $Total) {
        $count = [Math]::Min($BatchSize, $Total - $offset)
        $pct = [Math]::Round(($offset / $Total) * 100)
        Write-Host "  [$pct%] Batch $offset..$($offset + $count - 1)..." -ForegroundColor White -NoNewline

        $result = Invoke-Reducer "seed_data" @("$offset", "$count")
        if ($result -eq $false) {
            Write-Host " FAILED" -ForegroundColor Red
            exit 1
        }
        Write-Host " OK" -ForegroundColor Green

        $offset += $BatchSize
    }
    $stopwatch.Stop()
    Write-Host "=== All $Total content blocks seeded in $([Math]::Round($stopwatch.Elapsed.TotalSeconds))s ===" -ForegroundColor Green
}

Write-Host "`n=== Seeding ad placeholders ===" -ForegroundColor Cyan
$result = Invoke-Reducer "seed_ads"
if ($result -eq $false) {
    Write-Host "Ad seeding failed." -ForegroundColor Red
    exit 1
}
Write-Host "=== Ad placeholders seeded ===`n" -ForegroundColor Green

Write-Host "Done! $Total blocks + ad slots are now in $Database on $Server" -ForegroundColor Green
