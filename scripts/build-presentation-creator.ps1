$SKILL = "presentation-creator"
$ROOT = Split-Path -Parent $PSScriptRoot

# Paths
$DIST_PATH = Join-Path $ROOT "dist"
$DEST_REFS_PATH = Join-Path $ROOT "skills\$SKILL\references"

# Create folders if they don't exist
New-Item -ItemType Directory -Force -Path $DIST_PATH | Out-Null
New-Item -ItemType Directory -Force -Path $DEST_REFS_PATH | Out-Null

# Copy shared references
Copy-Item "$ROOT\references\*" -Destination $DEST_REFS_PATH -Force

# Zip the skill
tar -C "$ROOT\skills" -acf "$DIST_PATH\$SKILL.zip" $SKILL

# Clean up injected references
Remove-Item $DEST_REFS_PATH -Recurse -Force

Write-Host "DONE! --> $SKILL.zip built > dist/$SKILL.zip"
