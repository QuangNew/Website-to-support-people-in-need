$ErrorActionPreference = 'Stop'

$clientRoot = Split-Path -Parent $PSScriptRoot
$assetRoot = Join-Path $clientRoot 'public\map-styles'
$spriteRoot = Join-Path $assetRoot 'sprites\basics'

New-Item -ItemType Directory -Path $assetRoot -Force | Out-Null
New-Item -ItemType Directory -Path $spriteRoot -Force | Out-Null

$downloads = @(
    @{
        Uri = 'https://vector.openstreetmap.org/styles/shortbread/neutrino.json'
        Target = Join-Path $assetRoot 'shortbread-neutrino.json'
    },
    @{
        Uri = 'https://vector.openstreetmap.org/styles/shortbread/eclipse.json'
        Target = Join-Path $assetRoot 'shortbread-eclipse.json'
    },
    @{
        Uri = 'https://vector.openstreetmap.org/styles/shortbread/sprites/basics/sprites.json'
        Target = Join-Path $spriteRoot 'sprites.json'
    },
    @{
        Uri = 'https://vector.openstreetmap.org/styles/shortbread/sprites/basics/sprites.png'
        Target = Join-Path $spriteRoot 'sprites.png'
    },
    @{
        Uri = 'https://vector.openstreetmap.org/styles/shortbread/sprites/basics/sprites@2x.json'
        Target = Join-Path $spriteRoot 'sprites@2x.json'
    },
    @{
        Uri = 'https://vector.openstreetmap.org/styles/shortbread/sprites/basics/sprites@2x.png'
        Target = Join-Path $spriteRoot 'sprites@2x.png'
    }
)

foreach ($download in $downloads) {
    $resolvedTarget = [System.IO.Path]::GetFullPath($download.Target)
    if (-not $resolvedTarget.StartsWith(
        [System.IO.Path]::GetFullPath($assetRoot),
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw "Refusing to write outside the map asset directory: $resolvedTarget"
    }

    Invoke-WebRequest -Uri $download.Uri -OutFile $resolvedTarget
    Write-Host "Updated $resolvedTarget"
}
