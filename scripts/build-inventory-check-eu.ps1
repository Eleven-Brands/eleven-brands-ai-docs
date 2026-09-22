$SKILL = "inventory-check-eu"
$ROOT = Split-Path -Parent $PSScriptRoot

# Paths
$DIST_PATH = Join-Path $ROOT "dist"

# Create dist folder if it doesn't exist
New-Item -ItemType Directory -Force -Path $DIST_PATH | Out-Null

# Package the skill (no shared references needed)
tar -C "$ROOT\skills" -acf "$DIST_PATH\$SKILL.zip" $SKILL

# Not synced to Claude Code commands -- this skill depends on claude.ai's sandboxed
# code-execution environment (/mnt/skills/public/xlsx, /mnt/user-data/outputs), same
# as presentation-creator, which isn't available in a Claude Code CLI session.

Write-Host "DONE! --> $SKILL.zip built > dist/$SKILL.zip"
