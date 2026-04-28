#!/usr/bin/env bash
set -euo pipefail

STANDARDS_REPO="${STANDARDS_REPO:-Eleven-Brands/eleven-brands-engineering-standards}"
STANDARDS_REF="${STANDARDS_REF:-main}"

echo "Syncing engineering standards from ${STANDARDS_REPO}@${STANDARDS_REF}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

git clone \
  --depth 1 \
  --branch "$STANDARDS_REF" \
  "https://x-access-token:${GITHUB_TOKEN}@github.com/${STANDARDS_REPO}.git" \
  "$tmp_dir/standards"

# ---- Copy Markdown standards files ----
cp -f "$tmp_dir/standards/CODE_OF_CONDUCT.md" .
cp -f "$tmp_dir/standards/CONTRIBUTING.md" .
cp -f "$tmp_dir/standards/LICENSE" .
cp -f "$tmp_dir/standards/setup_gcp.md" .
cp -f "$tmp_dir/standards/setup_local_development.md" .

# ---- Enforce .github conventions (selective — preserves consumer workflows) ----
if [ -d "$tmp_dir/standards/.github/ISSUE_TEMPLATE" ]; then
  mkdir -p .github/ISSUE_TEMPLATE
  rsync -a --delete "$tmp_dir/standards/.github/ISSUE_TEMPLATE/" .github/ISSUE_TEMPLATE/
fi

if [ -f "$tmp_dir/standards/.github/CODEOWNERS" ]; then
  mkdir -p .github
  cp -f "$tmp_dir/standards/.github/CODEOWNERS" .github/CODEOWNERS
fi

echo "Sync complete."
