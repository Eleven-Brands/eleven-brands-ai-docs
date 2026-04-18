# eleven-brands-ai-docs

This repository is the centralized AI knowledge base for Eleven Brands. It contains skill instruction files, shared reference knowledge, build scripts for packaging, and HTML documentation pages.

## Repository Structure

```
eleven-brands-ai-docs/
├── references/          # Shared knowledge consumed by skills at build time
├── skills/              # Skill packages — one folder per skill
│   └── skill-name/
│       └── SKILL.md     # Main skill instructions and YAML frontmatter
├── scripts/             # Build scripts for packaging skills as ZIPs
├── docs/                # HTML documentation site
│   ├── index.html       # Knowledge Base index page
│   └── 11_brands/
│       ├── assets/      # Shared assets: nav.js, style.css (used by all pages)
│       ├── dados-analytics/   # Data & analytics docs
│       ├── lideranca/         # Leadership docs
│       └── operacional/       # Operations docs
├── dist/                # Generated ZIPs — gitignored, never commit
├── CLAUDE.md            # This file
└── README.md            # Human-facing documentation
```

## Standards

Every skill follows the Eleven Brands skill standard defined in `skills/skills-creator/SKILL.md`. When working in this repo, always consult that file before creating or editing any skill.

### Naming conventions
- Skill folder: `lowercase-with-hyphens`
- Skill file: always `SKILL.md`
- The `name` field in YAML frontmatter must exactly match the folder name
- Build script: `scripts/build-[skill-name].ps1`

### Every skill must have
1. `skills/[skill-name]/SKILL.md` — the skill itself
2. `scripts/build-[skill-name].ps1` — packaging script for browser upload
3. A corresponding line in `scripts/build-all.ps1`

## Docs Site

HTML documentation pages live in `docs/11_brands/`. Each page follows this pattern:
- One `.html` file per topic
- One `.css` file alongside it (page-specific styles)
- Shared assets (`nav.js`, `style.css`) live in `docs/11_brands/assets/` and are referenced as `../assets/nav.js`

Do not place shared assets directly inside section folders or alongside individual pages — they belong in `assets/` only.

## References

Files in `references/` are shared knowledge used across multiple skills. They are never committed inside skill folders — they are injected at build time by the packaging scripts and cleaned up afterward.

## Build Scripts

To package a single skill for browser upload:
```powershell
.\scripts\build-[skill-name].ps1
```

To package all skills at once:
```powershell
.\scripts\build-all.ps1
```

Output ZIPs are generated in `dist/`. Upload them at `claude.ai/customize/skills`.

### Special case: documentation-editor

The `documentation-editor` build script injects extra assets beyond `references/` — it also copies `docs/11_brands/assets/nav.js`, `docs/11_brands/assets/style.css`, and `docs/11_brands/dados-analytics/color_palette.html` into a temporary `skills/documentation-editor/assets/` folder before zipping. This gives the skill access to the shared design assets and a reference example page at build time. Both `references/` and `assets/` are cleaned up after zipping.

## Current Skills

| Skill | Purpose |
|---|---|
| `agile-management` | Sprint planning, OKRs, backlog, meeting analysis |
| `documentation-editor` | HTML documentation creation and editing |
| `presentation-creator` | PowerPoint/Google Slides presentation creation |
| `task-organizer` | ClickUp task creation and organization |
| `skills-creator` | Creates and reviews skill files following this standard |
