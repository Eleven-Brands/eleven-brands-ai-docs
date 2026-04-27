$SKILL = "documentation-editor"
$ROOT = Split-Path -Parent $PSScriptRoot

# Source Paths
$SRC_REFS_PATH = Join-Path $ROOT "references"
$SRC_ASTS_PATH = Join-Path $ROOT "docs\11_brands\assets"
$SRC_COLOR_PATH = Join-Path $ROOT "docs\11_brands\dados-analytics"

# Destination Paths
$DEST_DIST_PATH = Join-Path $ROOT "dist"
$DEST_REFS_PATH = Join-Path $ROOT "skills\$SKILL\references"
$DEST_ASTS_PATH = Join-Path $ROOT "skills\$SKILL\assets"

# Create folders if they don't exist
New-Item -ItemType Directory -Force -Path $DEST_DIST_PATH | Out-Null
New-Item -ItemType Directory -Force -Path $DEST_REFS_PATH | Out-Null
New-Item -ItemType Directory -Force -Path $DEST_ASTS_PATH | Out-Null

# Copy Refs and Assets
Copy-Item "$SRC_REFS_PATH\*" -Destination $DEST_REFS_PATH -Force
Copy-Item "$SRC_COLOR_PATH\color_palette.html" -Destination $DEST_ASTS_PATH -Force
Copy-Item "$SRC_ASTS_PATH\nav.js" -Destination $DEST_ASTS_PATH -Force
Copy-Item "$SRC_ASTS_PATH\style.css" -Destination $DEST_ASTS_PATH -Force

# Zip Files
tar -C "$ROOT\skills" -acf "$DEST_DIST_PATH\$SKILL.zip" $SKILL

# Remove Duplicated Folders from Skills
Remove-Item $DEST_REFS_PATH -Recurse -Force
Remove-Item $DEST_ASTS_PATH -Recurse -Force

# Sync to Claude Code global commands (strip YAML frontmatter)
$COMMANDS_PATH = Join-Path $HOME ".claude\commands"
New-Item -ItemType Directory -Force -Path $COMMANDS_PATH | Out-Null
$skillContent = Get-Content "$ROOT\skills\$SKILL\SKILL.md" -Raw
$skillContent = $skillContent -replace '(?s)^---.*?---\r?\n', ''
$skillContent | Set-Content "$COMMANDS_PATH\$SKILL.md" -NoNewline
Write-Host "SYNCED --> ~/.claude/commands/$SKILL.md"

Write-Host "DONE! --> $SKILL.zip built > dist/$SKILL.zip"
