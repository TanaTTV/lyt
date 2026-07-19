param(
  [Parameter(Mandatory = $true)]
  [string]$Url,

  [string]$OutputDirectory,

  [switch]$IHavePermission
)

if (-not $IHavePermission) {
  throw "Pass -IHavePermission only for media you own or are permitted to download."
}

$lytArguments = @("--video", "--max-filesize", "2G", "--json")
if ($OutputDirectory) {
  $lytArguments += @("-o", $OutputDirectory)
}
$lytArguments += $Url

$json = & lyt @lytArguments
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$result = $json | ConvertFrom-Json
if (-not $result.ok) {
  throw "lyt returned an unsuccessful result."
}

$files = @($result.results | ForEach-Object { $_.files } | Where-Object { $_ })
if ($files.Count -eq 0) {
  throw "lyt completed without reporting a final file path."
}

Write-Host "Final file path:" -ForegroundColor Red
$files | ForEach-Object { Write-Host $_ }
