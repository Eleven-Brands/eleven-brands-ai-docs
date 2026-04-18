Write-Host "Building all Eleven Brands skills..."
Write-Host ""

& "$PSScriptRoot\build-agile-management.ps1"
& "$PSScriptRoot\build-documentation-editor.ps1"
& "$PSScriptRoot\build-task-organizer.ps1"
& "$PSScriptRoot\build-skills-creator.ps1"
& "$PSScriptRoot\build-presentation-creator.ps1"

Write-Host ""
Write-Host "DONE! --> All skills built > dist/"
