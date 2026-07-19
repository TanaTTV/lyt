# Adds (or removes) right-click menu entries so a user can:
#   1. Copy one or more YouTube links.
#   2. Right-click inside the destination folder.
#   3. Choose "Download audio here" or "Download video here".
#
# The menu delegates clipboard parsing to lyt's --paste implementation instead
# of passing arbitrary clipboard text as a raw command-line argument.
#
# Requires yt3 / yt4 on PATH first (run install\install.ps1).
# Writes only to HKEY_CURRENT_USER, so no administrator rights are needed.
#
# Install:  powershell -ExecutionPolicy Bypass -File .\install\windows-context-menu.ps1
# Remove:   powershell -ExecutionPolicy Bypass -File .\install\windows-context-menu.ps1 -Remove

param([switch]$Remove)

$ErrorActionPreference = "Stop"
$base = "HKCU:\Software\Classes\Directory\Background\shell"
$handlerDir = Join-Path $env:LOCALAPPDATA "lyt"
$handlerPath = Join-Path $handlerDir "windows-context-menu-handler.ps1"

$entries = @(
    @{ Key = "lyt_audio"; Label = "Download audio here (yt3)"; Command = "yt3" },
    @{ Key = "lyt_video"; Label = "Download video here (yt4)"; Command = "yt4" }
)

if ($Remove) {
    foreach ($entry in $entries) {
        Remove-Item -Path "$base\$($entry.Key)" -Recurse -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $handlerPath -Force -ErrorAction SilentlyContinue
    Write-Host "Removed lyt right-click menu entries." -ForegroundColor Green
    return
}

if (-not (Get-Command yt3 -ErrorAction SilentlyContinue)) {
    Write-Warning "yt3 was not found on PATH. Run install\install.ps1 first; the menu entries call yt3/yt4."
}

New-Item -ItemType Directory -Path $handlerDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "windows-context-menu-handler.ps1") `
    -Destination $handlerPath -Force

$hostPath = (Get-Process -Id $PID).Path

foreach ($entry in $entries) {
    $toolPath = (Get-Command $entry.Command -CommandType Application -ErrorAction Stop).Source
    $key = "$base\$($entry.Key)"
    New-Item -Path $key -Force | Out-Null
    Set-ItemProperty -Path $key -Name "(default)" -Value $entry.Label

    New-Item -Path "$key\command" -Force | Out-Null
    # Keep %V as a native process argument. Embedding it in PowerShell source
    # would let a quote in a folder name terminate the path literal.
    $command = '"' + $hostPath + '" -NoExit -ExecutionPolicy Bypass -File "' +
        $handlerPath + '" -ToolPath "' + $toolPath + '" -TargetPath "%V"'
    Set-ItemProperty -Path "$key\command" -Name "(default)" -Value $command
}

Write-Host "Added right-click menu entries." -ForegroundColor Green
Write-Host "Copy a YouTube link, right-click inside a folder, and choose the lyt action." -ForegroundColor Green
