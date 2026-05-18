Write-Host "Building all Eleven Brands skills..."
Write-Host ""

# Atualiza documentacao Power BI a partir dos TMDL (zero tokens)
& "$PSScriptRoot\update-powerbi-docs.ps1"
Write-Host ""

& "$PSScriptRoot\build-agile-management.ps1"
& "$PSScriptRoot\build-documentation-editor.ps1"
& "$PSScriptRoot\build-clickup-manager.ps1"
& "$PSScriptRoot\build-skills-creator.ps1"
& "$PSScriptRoot\build-presentation-creator.ps1"
& "$PSScriptRoot\build-ai-setup.ps1"
& "$PSScriptRoot\build-pivot-fields-from-powerbi.ps1"
& "$PSScriptRoot\build-clickup-commenter.ps1"
& "$PSScriptRoot\build-powerbi-query.ps1"
& "$PSScriptRoot\build-dashboard-guide.ps1"
& "$PSScriptRoot\build-token-optimizer.ps1"

# Sync shared references to Claude Code
$REFS_DEST = Join-Path $HOME ".claude\references"
New-Item -ItemType Directory -Force -Path $REFS_DEST | Out-Null
Copy-Item "$PSScriptRoot\..\references\*" -Destination $REFS_DEST -Force
Write-Host "SYNCED --> ~/.claude/references/"

Write-Host ""
Write-Host "DONE! --> All skills built > dist/"
