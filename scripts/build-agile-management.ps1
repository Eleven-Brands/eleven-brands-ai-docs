$SKILL = "agile-management"
$ROOT = Split-Path -Parent $PSScriptRoot
$DIST_PATH = Join-Path $ROOT "dist"

New-Item -ItemType Directory -Force -Path $DIST_PATH | Out-Null
tar -C "$ROOT\skills" -acf "$DIST_PATH\$SKILL.zip" $SKILL

# Sync to Claude Code global commands (strip YAML frontmatter)
$COMMANDS_PATH = Join-Path $HOME ".claude\commands"
New-Item -ItemType Directory -Force -Path $COMMANDS_PATH | Out-Null
$skillContent = Get-Content "$ROOT\skills\$SKILL\SKILL.md" -Raw
$skillContent = $skillContent -replace '(?s)^---.*?---\r?\n', ''
$skillContent | Set-Content "$COMMANDS_PATH\$SKILL.md" -NoNewline
Write-Host "SYNCED --> ~/.claude/commands/$SKILL.md"

Write-Host "DONE! --> $SKILL.zip built > dist/$SKILL.zip"