# Watches the clipboard for YouTube links and downloads audio automatically.
# Copy a link anywhere, and yt3 grabs it — no browser download UI needed.
#
# Requires yt3 on PATH (run install\install.ps1 first).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\install\clipboard-watcher.ps1
#   powershell -ExecutionPolicy Bypass -File .\install\clipboard-watcher.ps1 -OutputDir "$env:USERPROFILE\Music" -Mp3
#
# Press Ctrl+C to stop.

param(
    [string]$OutputDir = (Get-Location).Path,
    [switch]$Mp3,
    [int]$PollSeconds = 2
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command yt3 -ErrorAction SilentlyContinue)) {
    Write-Error "yt3 was not found on PATH. Run install\install.ps1 first."
}

$youtubePattern = 'https?://[^\s''"]*(?:youtube\.com|youtu\.be)[^\s''"]*'
$seen = [System.Collections.Generic.HashSet[string]]::new()

Write-Host "Clipboard watcher started." -ForegroundColor Cyan
Write-Host "Output: $OutputDir"
Write-Host "Copy a YouTube link to download. Ctrl+C to stop."
Write-Host ""

while ($true) {
    $clip = Get-Clipboard -Raw -ErrorAction SilentlyContinue

    if ($clip) {
        $matches = [regex]::Matches($clip, $youtubePattern)

        foreach ($match in $matches) {
            $url = $match.Value.TrimEnd('.', ',', ';')

            if ($seen.Add($url)) {
                Write-Host "Found: $url" -ForegroundColor Green
                $args = @("-o", $OutputDir)

                if ($Mp3) {
                    $args += "--mp3"
                }

                $args += $url
                & yt3 @args

                if ($LASTEXITCODE -ne 0) {
                    Write-Warning "Download failed for $url (exit $LASTEXITCODE)"
                    [void]$seen.Remove($url)
                }
            }
        }
    }

    Start-Sleep -Seconds $PollSeconds
}
