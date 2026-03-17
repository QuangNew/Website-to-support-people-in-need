param(
    [switch]$Install
)

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$clientPath = Join-Path $root 'client'
$apiPath = Join-Path $root 'src\ReliefConnect.API'

if (-not (Test-Path $clientPath)) {
    throw "Khong tim thay thu muc frontend: $clientPath"
}

if (-not (Test-Path $apiPath)) {
    throw "Khong tim thay thu muc backend: $apiPath"
}

$requiredCommands = @('node', 'pnpm', 'dotnet')
foreach ($cmd in $requiredCommands) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "Thieu lenh '$cmd'. Vui long cai dat truoc khi chay script."
    }
}

if ($Install) {
    Write-Host '[1/2] Cai dependencies frontend (pnpm install)...' -ForegroundColor Cyan
    Push-Location $clientPath
    try {
        pnpm install
    }
    finally {
        Pop-Location
    }

    Write-Host '[2/2] Restore backend (.NET)...' -ForegroundColor Cyan
    Push-Location $apiPath
    try {
        dotnet restore
    }
    finally {
        Pop-Location
    }
}

Write-Host 'Khoi dong backend: http://localhost:5164' -ForegroundColor Green
Start-Process powershell -WorkingDirectory $apiPath -ArgumentList @(
    '-NoExit',
    '-Command',
    'dotnet run'
)

Write-Host 'Khoi dong frontend: http://localhost:5173' -ForegroundColor Green
Start-Process powershell -WorkingDirectory $clientPath -ArgumentList @(
    '-NoExit',
    '-Command',
    'if (-not (Test-Path ''.\node_modules'')) { pnpm install }; pnpm dev'
)

Write-Host 'Da mo 2 terminal rieng cho backend/frontend.' -ForegroundColor Yellow
Write-Host 'Dung Ctrl+C trong tung terminal de dung dich vu.' -ForegroundColor Yellow
