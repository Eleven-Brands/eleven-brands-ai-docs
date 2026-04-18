# Color Palette Reference — Eleven Brands Dashboards

**Eleven Brands | Power BI Dashboards**
This document describes the official color system of Eleven Brands for use in Power BI dashboards. Its purpose is to ensure **visual consistency, fast reading, and unambiguous data interpretation** across all brands in the portfolio.

---

## Quick Reference — Master Color Index

A complete index of all colors, their names, hex codes, and roles. This is the primary lookup table for any agent or human working with this system.

### Institutional Colors
| Role | Name | Hex |
|---|---|---|
| Primary | Dark Sage Green | `#68907E` |
| Secondary | Warm Graphite | `#47515A` |

### Categorical Colors (in application order)
| Priority | Name | Hex |
|---|---|---|
| 1 | Dark Sage Green | `#68907E` |
| 2 | Muted Blue | `#668197` |
| 3 | Soft Terracotta | `#C68065` |
| 4 | Light Teal Blue | `#7A95A3` |
| 5 | Light Green | `#8FAF9A` |
| 6 | Medium Gray | `#A1A9B3` |
| 7 | Light Taupe | `#CEBDB0` |
| 8 | Warm Graphite | `#47515A` |

### Sentiment Colors
| State | Name | Hex |
|---|---|---|
| Positive | Positive Green | `#4CAF7A` |
| Negative | Negative Red | `#D64545` |
| Warning | Warning Yellow | `#E3A008` |
| Neutral | Neutral Gray | `#9AA0A6` |

### Structural Colors
| Element | Name | Hex |
|---|---|---|
| Page background | Page Background | `#F4F5F3` |
| Visual background | Visual Background | `#FFFFFF` |
| Visual border | Visual Border | `#DADDDD` |
| Title text | Title Text | `#1F2427` |
| Label / axis text | Label Text | `#47515A` |

---

## 1. Design Philosophy

### Why this palette exists
The Eleven Brands color system was built to **represent all brands within the Eleven Brands portfolio simultaneously**, without competing with any individual brand identity.

- **OrganiHaus** operates on clarity, order, and visual rationality. Cool, neutral, and controlled tones belong to its territory.
- **MillHouse** carries warmth, materiality, and a sense of home. Organic and earthy tones are natural to the brand.
- **Angélique** works with expression, delicacy, and aesthetic softness — desaturated and sensory colors.

The holding's challenge is **not to choose one of these axes**, but to create a point of intersection between all three.

**Dark Sage Green (`#68907E`)** fulfills this role:
- Rational enough for OrganiHaus
- Organic enough for MillHouse
- Soft enough for Angélique

This is why it acts as the **institutional color**, while the remaining colors orbit in controlled neutrality.

The system deliberately avoids:
- Dominant emotional colors
- Aggressive contrasts
- Direct associations with any single brand

Color communicates **governance, stability, and executive readability** — not consumer branding.

### Core principle
Colors are **not decorative**. Each color group has a fixed functional role:

| Group | Role |
|---|---|
| Categorical colors | Differentiate categories |
| Sentiment colors | Indicate state or performance |
| Structural colors | Ensure readability, contrast, and hierarchy |

**Mixing roles is not permitted.**

### When in doubt
If a use case is not explicitly covered by this document, apply the following fallback rules in order:
1. Use the primary institutional color (Dark Sage Green `#68907E`) for positive emphasis or neutral highlights
2. Use structural colors for backgrounds and text
3. Do not introduce new colors — flag the gap and request a governance decision

---

## 2. Typography

Typography is treated as **reading infrastructure**, not as an aesthetic element. The objective is to ensure visual predictability, good rendering on both TV and laptop screens, and clear information hierarchy.

### Standard font
- **Segoe UI** (Power BI native)

### Usage by element
| Element | Style |
|---|---|
| Titles / KPIs / Headers | Segoe UI **Semibold** |
| Labels / axes / tables | Segoe UI **Regular** |
| Supporting text | Segoe UI Regular (smaller size) |

### Rules
- Do not use external fonts
- Do not mix font families
- Do not use italics
- CAPS LOCK only for acronyms

---

## 3. Institutional Colors

### Primary — Dark Sage Green `#68907E`
**Use for:**
- Institutional highlights
- Active / selected states
- Positive emphasis when there is no direct comparison

**Restrictions:**
- Do not use as a dominant background
- Do not use for alerts

### Secondary — Warm Graphite `#47515A`
**Use for:**
- Headers
- Primary KPIs
- High-hierarchy text

---

## 4. Categorical Colors

Used **exclusively** to differentiate categories (brand, channel, country, product line, etc.).

### Official application order
The order defines **visual priority** in Power BI and must not be changed:

| Priority | Name | Hex |
|---|---|---|
| 1 | Dark Sage Green | `#68907E` |
| 2 | Muted Blue | `#668197` |
| 3 | Soft Terracotta | `#C68065` |
| 4 | Light Teal Blue | `#7A95A3` |
| 5 | Light Green | `#8FAF9A` |
| 6 | Medium Gray | `#A1A9B3` |
| 7 | Light Taupe | `#CEBDB0` |
| 8 | Warm Graphite | `#47515A` |

### Mandatory rules
- The same category must maintain the **same color across all pages**
- Do not create colors outside the theme
- Do not reorder colors manually

### Light Green `#8FAF9A` — specific use
- Use only as a secondary category, "Others", or comparative baseline
- Do not use as a primary category
- Do not use alongside the primary color in the same visual

### Soft Terracotta `#C68065` — specific use
- **Narrative highlight color**
- Indicated for storytelling (key brand, focus country, strategic channel)
- Do not use as an operational default

---

## 5. Sentiment Colors

These colors **are not part of the categorical palette** and must never be used for categories.

| State | Name | Hex | Meaning |
|---|---|---|---|
| Positive | Positive Green | `#4CAF7A` | Performance above expectations |
| Negative | Negative Red | `#D64545` | Requires immediate action |
| Warning | Warning Yellow | `#E3A008` | Risk or attention required |
| Neutral | Neutral Gray | `#9AA0A6` | Neutrality or absence of variation |

### Rules
- Red demands action
- Green indicates above-expected performance
- Yellow indicates risk or attention
- Gray indicates neutrality or absence of variation

---

## 6. Structural Colors

Used to ensure readability, contrast, and visual hierarchy across all dashboards.

### Backgrounds
| Element | Hex |
|---|---|
| Page background | `#F4F5F3` |
| Visual background | `#FFFFFF` |
| Visual border | `#DADDDD` |

**Rules:**
- Do not use colored backgrounds in visuals
- Do not remove borders for aesthetic purposes

### Text
| Element | Hex |
|---|---|
| Titles | `#1F2427` |
| Labels / axes | `#47515A` |

**Rule:** Contrast takes priority over aesthetics.

---

## 7. Best Practices

- If a visual is confusing, reduce categories before adding colors
- Visual hierarchy follows this order: **position → size → color**
- If everything is colorful, nothing is important

---

## 8. Prohibitions

- Gradients
- Shadows
- Rainbow palettes
- Saturated colors without a functional role
- A chart with a different palette from the rest of the dashboard

---

## 9. Governance

Every published dashboard must use the **official theme**.

Exceptions are only permitted when there is a **clear functional justification**.

Consistency of the system is more important than individual preference.
