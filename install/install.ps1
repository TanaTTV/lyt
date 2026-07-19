# Installs the lyt commands (lyt, yt3, yt4) onto PATH and verifies the local
# media toolchain. WinGet is preferred; lyt's checksum-verified managed binaries
# are used as the per-user fallback.
#
# Safe to re-run: every step is skipped when it is already done.
#
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File .\install\install.ps1

#Requires -Version 5
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

function Refresh-SessionPath {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    $seen = [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::OrdinalIgnoreCase
    )
    $merged = foreach ($pathValue in @($env:Path, $machine, $user)) {
        foreach ($segment in ($pathValue -split ";")) {
            $clean = $segment.Trim()
            if ($clean -and $seen.Add($clean)) { $clean }
        }
    }
    $env:Path = $merged -join ";"
}

Write-Host "Installing lyt commands (lyt, yt3, yt4)..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js 20 or newer is required. Install the current LTS release first."
}

$nodeVersion = node -p "process.versions.node"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Could not determine the installed Node.js version."
}
$nodeMajor = [int]($nodeVersion -split "\.")[0]
if ($nodeMajor -lt 20) {
    Write-Error "Node.js 20 or newer is required; found $nodeVersion."
}

Push-Location $root
try {
    npm install -g .
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install -g . failed (exit code $LASTEXITCODE)."
    }
} finally {
    Pop-Location
}

$tools = @(
    @{ Name = "yt-dlp"; WingetId = "yt-dlp.yt-dlp" },
    @{ Name = "ffmpeg"; WingetId = "Gyan.FFmpeg" }
)

$haveWinget = [bool](Get-Command winget -ErrorAction SilentlyContinue)
$needManaged = $false

foreach ($tool in $tools) {
    if (Get-Command $tool.Name -ErrorAction SilentlyContinue) {
        Write-Host "$($tool.Name) is already installed." -ForegroundColor Green
        continue
    }

    if ($haveWinget) {
        Write-Host "Installing $($tool.Name) with winget..." -ForegroundColor Cyan
        try {
            winget install --id $tool.WingetId -e --accept-source-agreements --accept-package-agreements
        } catch {
            Write-Warning "winget install of $($tool.Name) failed: $_"
        }
        Refresh-SessionPath
        if (Get-Command $tool.Name -ErrorAction SilentlyContinue) {
            continue
        }
    }

    $needManaged = $true
}

if ($needManaged) {
    Write-Host "Falling back to lyt's verified managed downloads (per-user, no admin)..." -ForegroundColor Cyan
    node "$root\bin\lyt.js" doctor --fix

    $managedBin = Join-Path $env:LOCALAPPDATA "lyt\bin"
    if (Test-Path $managedBin) {
        $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if (($userPath -split ";") -notcontains $managedBin) {
            $newUserPath = if ($userPath) { "$userPath;$managedBin" } else { $managedBin }
            [Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
            Write-Host "Added $managedBin to your user PATH." -ForegroundColor Green
        }
        Refresh-SessionPath
    }
}

Write-Host ""
Write-Host "Verifying installed versions:" -ForegroundColor Cyan
Write-Host "  node    $nodeVersion"

foreach ($tool in $tools) {
    $resolved = Get-Command $tool.Name -ErrorAction SilentlyContinue
    $exe = if ($resolved) { $tool.Name } else {
        $candidate = Join-Path $env:LOCALAPPDATA "lyt\bin\$($tool.Name).exe"
        if (Test-Path $candidate) { $candidate } else { $null }
    }

    if ($exe) {
        $versionFlag = if ($tool.Name -eq "ffmpeg") { "-version" } else { "--version" }
        $version = (& $exe $versionFlag 2>$null | Select-Object -First 1)
        if ($tool.Name -eq "ffmpeg") {
            $version = ($version -replace "^ffmpeg version\s+", "") -split " " | Select-Object -First 1
        }
        Write-Host "  $($tool.Name.PadRight(7)) $version"
    } else {
        Write-Warning "$($tool.Name) is still missing. Run: lyt doctor --fix"
    }
}

Write-Host ""
Write-Host "Done. Try:" -ForegroundColor Green
Write-Host '  yt3 "https://www.youtube.com/watch?v=VIDEO_ID"   # native audio'
Write-Host '  yt4 "https://www.youtube.com/watch?v=VIDEO_ID"   # video'
Write-Host '  yt3 --paste                                       # download from clipboard'
Write-Host ""
Write-Host "Optional: add right-click menu entries with:" -ForegroundColor Green
Write-Host "  powershell -ExecutionPolicy Bypass -File .\install\windows-context-menu.ps1"
