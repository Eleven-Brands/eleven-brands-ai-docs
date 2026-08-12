# build-log-impacto.ps1
# Sincroniza o comando /log-impacto para ~/.claude/commands/

$skillDir   = "$PSScriptRoot\..\skills\log-impacto"
$commandsDir = "$env:USERPROFILE\.claude\commands"
$outputFile  = "$commandsDir\log-impacto.md"

# Garante que o diretório de commands existe
if (-not (Test-Path $commandsDir)) {
    New-Item -ItemType Directory -Path $commandsDir -Force | Out-Null
}

# Copia SKILL.md para ~/.claude/commands/log-impacto.md
Copy-Item "$skillDir\SKILL.md" $outputFile -Force

Write-Host "✅ /log-impacto sincronizado em $outputFile"
