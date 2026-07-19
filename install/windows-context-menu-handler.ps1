# Stable handler for the Explorer integration. Dynamic paths arrive only as
# native process arguments; no folder name is ever parsed as PowerShell source.

param(
    [Parameter(Mandatory)]
    [string]$ToolPath,
    [Parameter(Mandatory)]
    [string]$TargetPath
)

$ErrorActionPreference = "Stop"

if (-not (Split-Path -Path $ToolPath -IsAbsolute) -or
    -not (Test-Path -LiteralPath $ToolPath -PathType Leaf)) {
    throw "The configured lyt command must be an existing absolute file path."
}

if ([string]::IsNullOrWhiteSpace($TargetPath) -or
    -not (Test-Path -LiteralPath $TargetPath -PathType Container)) {
    throw "The lyt context-menu target must be an existing folder."
}

Set-Location -LiteralPath $TargetPath
& $ToolPath --paste
