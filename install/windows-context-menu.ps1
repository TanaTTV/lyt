# Adds (or removes) right-click menu entries so a non-technical user can:
#   1. Copy a YouTube link (Ctrl+C).
#   2. Right-click inside the folder where they want the file.
#   3. Choose "Download audio here" or "Download video here".
#
# The download uses whatever URL is on the clipboard and saves into that folder.
# Multiple copied lines (several URLs) are all downloaded.
#
# Requires the yt3 / yt4 commands on PATH first (run install\install.ps1).
# Writes only to HKEY_CURRENT_USER, so no administrator rights are needed.
#
# Install:  powershell -ExecutionPolicy Bypass -File .\install\windows-context-menu.ps1
# Remove:   powershell -ExecutionPolicy Bypass -File .\install\windows-context-menu.ps1 -Remove

param([switch]$Remove)

$ErrorActionPreference = "Stop"

# "Background" is the empty space inside a folder, i.e. "download into here".
$base = "HKCU:\Software\Classes\Directory\Background\shell"

$entries = @(
    @{ Key = "ytgrab_audio"; Label = "Download audio here (yt3)"; Command = "yt3" },
    @{ Key = "ytgrab_video"; Label = "Download video here (yt4)"; Command = "yt4" }
)

if ($Remove) {
    foreach ($entry in $entries) {
        Remove-Item -Path "$base\$($entry.Key)" -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Removed ytgrab right-click menu entries." -ForegroundColor Green
    return
}

if (-not (Get-Command yt3 -ErrorAction SilentlyContinue)) {
    Write-Warning "yt3 was not found on PATH. Run install\install.ps1 first; the menu entries call yt3/yt4."
}

foreach ($entry in $entries) {
    $key = "$base\$($entry.Key)"
    New-Item -Path $key -Force | Out-Null
    Set-ItemProperty -Path $key -Name "(default)" -Value $entry.Label

    New-Item -Path "$key\command" -Force | Out-Null
    # %V is the folder that was right-clicked. -NoExit keeps the window open so
    # progress and any errors stay visible.
    $command = 'powershell.exe -NoExit -Command "Set-Location -LiteralPath ''%V''; ' +
        $entry.Command + ' (Get-Clipboard)"'
    Set-ItemProperty -Path "$key\command" -Name "(default)" -Value $command
}

Write-Host "Added right-click menu entries." -ForegroundColor Green
Write-Host "Copy a YouTube link, right-click inside any folder, and pick 'Download audio/video here'."
