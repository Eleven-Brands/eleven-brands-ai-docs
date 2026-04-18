# eleven-brands-ai-docs

Centralized AI knowledge base for Eleven Brands. This repo holds Claude skill packages, shared reference knowledge, and the internal HTML documentation site.

## What's in here

| Directory | Purpose |
|---|---|
| `skills/` | Claude skill packages — one folder per skill, each with a `SKILL.md` |
| `references/` | Shared knowledge injected into skills at build time |
| `scripts/` | PowerShell build scripts that package skills into ZIPs |
| `docs/` | HTML documentation site for internal company knowledge |
| `dist/` | Generated ZIPs (gitignored) — output of build scripts |

## Skills

| Skill | Purpose |
|---|---|
| `agile-management` | Sprint planning, OKRs, backlog, meeting analysis |
| `documentation-editor` | HTML documentation creation and editing |
| `presentation-creator` | PowerPoint/Google Slides presentation creation |
| `task-organizer` | ClickUp task creation and organization |
| `skills-creator` | Creates and reviews skill files following this standard |

## Building and deploying skills

Package a single skill:
```powershell
.\scripts\build-[skill-name].ps1
```

Package all skills at once:
```powershell
.\scripts\build-all.ps1
```

ZIPs are written to `dist/`. Upload them at `claude.ai/customize/skills`.

## Docs site

The documentation site lives in `docs/`. Open `docs/index.html` in a browser to browse all internal knowledge base pages. Pages are organized by area:

- `dados-analytics/` — Data & analytics
- `lideranca/` — Leadership
- `operacional/` — Operations

Shared assets (navigation, base styles) live in `docs/11_brands/assets/`.

## Contributing

Follow the skill standard defined in `skills/skills-creator/SKILL.md` before creating or editing any skill. Every skill needs a `SKILL.md`, a corresponding build script, and an entry in `build-all.ps1`.
