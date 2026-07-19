param(
  [string]$Output = "website/public/demo/lyt-agent-demo.mp4"
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$ffmpeg = Join-Path $env:LOCALAPPDATA "lyt/bin/ffmpeg.exe"
if (-not (Test-Path -LiteralPath $ffmpeg)) {
  $ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source
}

$logo = Join-Path $repoRoot "app/brand/lyt-red-logo-master.png"
$source = Join-Path $repoRoot "website/public/demo/lyt-permitted-source.mp4"
$subtitles = Join-Path $PSScriptRoot "launch-demo.ass"
$outputPath = Join-Path $repoRoot $Output
$posterPath = [System.IO.Path]::ChangeExtension($outputPath, ".png")
$subtitleFilterPath = $subtitles.ToString().Replace("\", "/").Replace(":", "\:")

$filter = @"
[0:v]drawbox=x=0:y=0:w=1280:h=9:color=0xFF1F3D:t=fill,
drawbox=x=58:y=78:w=1164:h=564:color=0x11131A@0.72:t=fill,
drawbox=x=58:y=78:w=7:h=564:color=0xFF1F3D:t=fill[panel];
[1:v]split=2[logo-small-source][logo-large-source];
[logo-small-source]scale=70:70[logo];
[panel][logo]overlay=x=1130:y=34[brand];
[2:v]scale=420:236[src];
[brand][src]overlay=x=760:y=355:enable='between(t,23.2,27.1)'[withsrc];
[logo-large-source]scale=240:240[logo-large];
[withsrc][logo-large]overlay=x=900:y=245:enable='between(t,27.1,30)'[withcta];
[withcta]subtitles='$subtitleFilterPath'[video]
"@ -replace "`r?`n", ""

& $ffmpeg -hide_banner -loglevel warning -y `
  -f lavfi -i "color=c=0x08090D:s=1280x720:d=30:r=30" `
  -loop 1 -i $logo `
  -stream_loop -1 -i $source `
  -filter_complex $filter `
  -map "[video]" `
  -t 30 -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p `
  -an -movflags +faststart $outputPath

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& $ffmpeg -hide_banner -loglevel warning -y -ss 27.6 -i $outputPath -frames:v 1 -update 1 $posterPath
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Output "Built $outputPath"
Write-Output "Built $posterPath"
