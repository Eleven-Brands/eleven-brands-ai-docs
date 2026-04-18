$SKILL = "task-organizer"
$ROOT = Split-Path -Parent $PSScriptRoot
$DIST_PATH = Join-Path $ROOT "dist"

New-Item -ItemType Directory -Force -Path $DIST_PATH | Out-Null
tar -C "$ROOT\skills" -acf "$DIST_PATH\$SKILL.zip" $SKILL

Write-Host "DONE! --> $SKILL.zip built > dist/$SKILL.zip"
