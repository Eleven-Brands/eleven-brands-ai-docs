$SKILL = "dashboard-guide"
$ROOT = Split-Path -Parent $PSScriptRoot

# Paths
$DIST_PATH      = Join-Path $ROOT "dist"
$DEST_REFS_PATH = Join-Path $ROOT "skills\$SKILL\references"

# Create folders if they don't exist
New-Item -ItemType Directory -Force -Path $DIST_PATH      | Out-Null
New-Item -ItemType Directory -Force -Path $DEST_REFS_PATH | Out-Null

# Inject Power BI model documentation
Copy-Item "$ROOT\references\power-bi\*" -Destination $DEST_REFS_PATH -Force

# Package the skill
tar -C "$ROOT\skills" -acf "$DIST_PATH\$SKILL.zip" $SKILL

# Clean up injected references
Remove-Item $DEST_REFS_PATH -Recurse -Force

# Sync to Claude Code global commands (strip YAML frontmatter)
$COMMANDS_PATH = Join-Path $HOME ".claude\commands"
New-Item -ItemType Directory -Force -Path $COMMANDS_PATH | Out-Null
$skillContent = Get-Content "$ROOT\skills\$SKILL\SKILL.md" -Raw
$skillContent = $skillContent -replace '(?s)^---.*?---\r?\n', ''
$skillContent | Set-Content "$COMMANDS_PATH\$SKILL.md" -NoNewline
Write-Host "SYNCED --> ~/.claude/commands/$SKILL.md"

Write-Host "DONE! --> $SKILL.zip built > dist/$SKILL.zip"
