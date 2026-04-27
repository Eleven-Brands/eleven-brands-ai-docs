/**
 * slide-templates.js
 * Eleven Brands — Presentation Creator
 *
 * Canonical PptxGenJS templates for all mandatory slides.
 * Extracted from the original working build-pptx.js (claude-intro-team presentation).
 *
 * Claude must:
 *   1. Copy this file to /home/claude/slide-templates.js at build time
 *   2. require() it in build-pptx.js
 *   3. Call these functions verbatim — never rewrite or inline their logic
 *   4. If a layout looks wrong after QA, fix it here and re-run, not in build-pptx.js
 *
 * All exported slide functions are async (icon rendering requires sharp).
 *
 * MULTI-COLUMN CARD LAYOUT RULE (applies to ALL enumerated card grids you build):
 *   Default iteration fills ROW-BY-ROW (left → right, top → bottom).
 *   Items 1,2 → row 1; Items 3,4 → row 2; etc.
 *   For column-first layout (items numbered top-to-bottom per column), do NOT use
 *   addAgendaSlide() — write a custom slide in build-pptx.js with two separate
 *   forEach loops driven by a shared ROW_GAP from the longer column.
 */

'use strict';

const React           = require('react');
const ReactDOMServer  = require('react-dom/server');
const sharp           = require('sharp');
const { FaBrain }     = require('react-icons/fa');

// ─── Color Palette ───────────────────────────────────────────────────────────
// All hex values omit the leading '#' (PptxGenJS requirement — '#' causes file corruption).
const C = {
  darkBg:    '1A1F2E',  // slide backgrounds
  midBg:     '232B3E',  // card backgrounds
  sage:      '68907E',  // Dark Sage Green — primary institutional accent
  sageLight: '8FAF9A',  // Light Green
  blue:      '668197',  // Muted Blue
  terra:     'C68065',  // Soft Terracotta
  graphite:  '47515A',  // Warm Graphite
  teal:      '7A95A3',  // Light Teal Blue (official palette name — priority 4)
  white:     'FFFFFF',
  offWhite:  'E8ECF0',  // body text on dark backgrounds
  muted:     '9AA0A6',  // secondary/supporting text
  positive:  '4CAF7A',
  warning:   'E3A008',
  negative:  'D64545',
};

// ─── Layout Constants ─────────────────────────────────────────────────────────
const SLIDE_H    = 5.625;
const FOOTER_Y   = 5.3;
const FOOTER_H   = 0.325;

// ─── Shadow Factory ───────────────────────────────────────────────────────────
// Never reuse shadow objects — PptxGenJS mutates them.
const mkShadow = () => ({ type: 'outer', color: '000000', blur: 8, offset: 3, angle: 135, opacity: 0.18 });

// ─── Icon Helper ─────────────────────────────────────────────────────────────
async function renderIcon(IconComp, color = '#FFFFFF', size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComp, { color, size: String(size) })
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}

// ─── Card Helper ─────────────────────────────────────────────────────────────
// pres is the pptxgen instance (needed for pres.shapes.RECTANGLE).
function addCard(pres, slide, x, y, w, h, opts = {}) {
  const { fill = C.midBg, accent = null, radius = false } = opts;
  slide.addShape(radius ? 'roundRect' : pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: fill },
    shadow: mkShadow(),
    rectRadius: radius ? 0.08 : undefined,
    line: { color: accent || fill, width: 0 },
  });
  if (accent) {
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.06, h,
      fill: { color: accent },
      line: { type: 'none' },
    });
  }
}

// ─── Eyebrow Helper ───────────────────────────────────────────────────────────
function addEyebrow(slide, text, x = 0.5, y = 0.28, color = C.sage) {
  slide.addText(text.toUpperCase(), {
    x, y, w: 9, h: 0.22,
    fontSize: 9, bold: true, charSpacing: 4,
    color, margin: 0,
  });
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
/**
 * addFooter(pres, slide, label)
 * Call on every content slide. Never call on Cover, Agenda, or Closing slides —
 * those handle their own bottom area.
 *
 * @param {object} pres   - pptxgen instance
 * @param {object} slide  - slide object
 * @param {string} label  - section label shown after the separator (can be empty)
 */
function addFooter(pres, slide, label = '') {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: FOOTER_Y, w: 10, h: FOOTER_H,
    fill: { color: C.darkBg },
    line: { color: C.darkBg },
  });
  slide.addText([
    { text: 'Eleven Brands', options: { color: C.muted, fontSize: 9 } },
    ...(label ? [{ text: `   |   ${label}`, options: { color: C.sage, fontSize: 9, bold: true } }] : []),
  ], {
    x: 0.4, y: 5.32, w: 9.2, h: 0.28,
    align: 'left', valign: 'middle', margin: 0,
  });
}

// ─── SLIDE 1: Cover ───────────────────────────────────────────────────────────
/**
 * addCoverSlide(pres, pptx, opts)
 * @param {object} pres
 * @param {object} pptx
 * @param {object} opts
 *   @param {string}  opts.title      - main title (large, bold)
 *   @param {string}  opts.subtitle   - line below title (Calibri Light, 22pt)
 *   @param {string}  [opts.tagline]  - smaller muted line below the terra divider
 *   @param {string}  [opts.date]     - bottom-left year/date label
 *
 * ⚠️  Title renders at 72pt inside h: 1.3. Multi-line titles (containing \n) will
 *     overflow and collide with the subtitle. Keep titles to a SINGLE LINE.
 *     If a two-line title is truly needed, reduce fontSize in build-pptx.js by
 *     passing a modified title text box after calling this function — do not edit
 *     this template to accommodate it.
 */
async function addCoverSlide(pres, pptx, { title, subtitle = '', tagline = '', date = '' }) {
  const s = pptx.addSlide();
  s.background = { color: C.darkBg };

  // Left sage accent bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.45, h: SLIDE_H,
    fill: { color: C.sage },
    line: { color: C.sage },
  });

  // Decorative circles — right half
  s.addShape(pres.shapes.OVAL, {
    x: 6.2, y: -1.0, w: 5.5, h: 5.5,
    fill: { color: C.midBg, transparency: 0 },
    line: { color: C.midBg },
  });
  s.addShape(pres.shapes.OVAL, {
    x: 7.0, y: -0.3, w: 3.8, h: 3.8,
    fill: { color: C.sage, transparency: 80 },
    line: { color: C.sage, transparency: 80 },
  });

  // Brain icon
  const brainIcon = await renderIcon(FaBrain, '#' + C.sageLight, 512);
  s.addImage({ data: brainIcon, x: 7.6, y: 0.5, w: 1.8, h: 1.8 });

  // Eyebrow brand label
  s.addText('ELEVEN BRANDS', {
    x: 0.8, y: 1.1, w: 6, h: 0.3,
    fontSize: 10, bold: true, charSpacing: 4,
    color: C.sageLight, margin: 0,
  });

  // Main title
  s.addText(title, {
    x: 0.8, y: 1.55, w: 6.5, h: 1.3,
    fontSize: 72, bold: true,
    color: C.white, fontFace: 'Calibri', margin: 0,
  });

  // Subtitle
  if (subtitle) {
    s.addText(subtitle, {
      x: 0.8, y: 2.85, w: 6.5, h: 0.5,
      fontSize: 22, color: C.offWhite, fontFace: 'Calibri Light', margin: 0,
    });
  }

  // Terra divider line
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 3.55, w: 2.2, h: 0.04,
    fill: { color: C.terra },
    line: { color: C.terra },
  });

  // Tagline (muted, below divider)
  if (tagline) {
    s.addText(tagline, {
      x: 0.8, y: 3.75, w: 7, h: 0.35,
      fontSize: 13, color: C.muted, fontFace: 'Calibri Light', margin: 0,
    });
  }

  // Date / year
  if (date) {
    s.addText(date, {
      x: 0.8, y: 5.05, w: 2, h: 0.3,
      fontSize: 11, color: C.graphite, margin: 0,
    });
  }

  return s;
}

// ─── SLIDE 2: Agenda ──────────────────────────────────────────────────────────
/**
 * addAgendaSlide(pres, pptx, opts)
 * Always slide 2. Layout is locked — 2-column card grid, 4 rows max (8 items).
 * Each item has a number, a title, and an optional description.
 *
 * LAYOUT: fills ROW-BY-ROW (left → right, top → bottom).
 *   Item 1 = col1 row1, Item 2 = col2 row1, Item 3 = col1 row2, etc.
 *   Numbers will read: 1 3 5 / 2 4 6 vertically if you expect column-first.
 *
 * ⚠️  For COLUMN-FIRST layout (items numbered top-to-bottom within each column),
 *     do NOT use this function — write a custom agenda slide directly in
 *     build-pptx.js using the same CARD_W, CARD_H, COLS_X, and a shared ROW_GAP
 *     driven by the longer column so both columns align horizontally.
 *
 * @param {object} pres
 * @param {object} pptx
 * @param {object} opts
 *   @param {string}   opts.title  - section header (e.g. "O que vamos ver hoje")
 *   @param {Array<{num:string, title:string, desc?:string}>} opts.items
 *     num:   zero-padded string, e.g. "01"
 *     title: card title
 *     desc:  optional subtitle line (muted, smaller)
 */
function addAgendaSlide(pres, pptx, { title = 'O que vamos ver hoje', items = [] }) {
  const s = pptx.addSlide();
  s.background = { color: C.darkBg };
  addEyebrow(s, 'Agenda');

  s.addText(title, {
    x: 0.5, y: 0.52, w: 9, h: 0.55,
    fontSize: 28, bold: true,
    color: C.white, fontFace: 'Calibri', margin: 0,
  });

  const COLS    = [0.4, 5.15];
  const CARD_W  = 4.5;
  const CARD_H  = 0.78;
  const START_Y = 1.15;
  const ROWS    = Math.ceil(items.length / 2) || 4;
  const ROW_GAP = (5.05 - START_Y) / ROWS;

  items.forEach((item, i) => {
    const col = i % 2 === 0 ? COLS[0] : COLS[1];
    const row = Math.floor(i / 2);
    const y   = START_Y + row * ROW_GAP;

    addCard(pres, s, col, y, CARD_W, CARD_H, { fill: C.midBg, accent: C.sage });

    // Number
    s.addText(item.num, {
      x: col + 0.18, y: y + 0.09, w: 0.42, h: 0.2,
      fontSize: 9, bold: true, color: C.sage, charSpacing: 1, margin: 0,
    });

    // Title
    s.addText(item.title, {
      x: col + 0.64, y: y + 0.07, w: CARD_W - 0.76, h: 0.3,
      fontSize: 12, bold: true, color: C.white, valign: 'middle', margin: 0,
    });

    // Description (optional)
    if (item.desc) {
      s.addText(item.desc, {
        x: col + 0.18, y: y + 0.47, w: CARD_W - 0.28, h: 0.24,
        fontSize: 9.5, color: C.muted, margin: 0,
      });
    }
  });

  addFooter(pres, s);
  return s;
}

// ─── CLOSING: Next Steps ──────────────────────────────────────────────────────
/**
 * addNextStepsSlide(pres, pptx, opts)
 * @param {object} pres
 * @param {object} pptx
 * @param {object} opts
 *   @param {string}  opts.title   - section title
 *   @param {Array<{num:string, title:string, desc?:string}>} opts.steps
 *
 * ⚠️  Maximum 5 steps. With CARD_H (0.72) + GAP (0.14), a 6th step starts at
 *     y ≈ 5.22, which overflows below the slide boundary. If more than 5 steps
 *     are needed, split into two slides or reduce CARD_H in this file.
 */
function addNextStepsSlide(pres, pptx, { title = 'Próximos Passos', steps = [] }) {
  const s = pptx.addSlide();
  s.background = { color: C.darkBg };

  // Left sage accent bar (mirrors cover)
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.45, h: SLIDE_H,
    fill: { color: C.sage },
    line: { color: C.sage },
  });

  addEyebrow(s, 'Próximos Passos', 0.8);

  s.addText(title, {
    x: 0.8, y: 0.55, w: 8.5, h: 0.65,
    fontSize: 28, bold: true,
    color: C.white, fontFace: 'Calibri', margin: 0,
  });

  // Terra divider
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 1.18, w: 2.2, h: 0.04,
    fill: { color: C.terra },
    line: { color: C.terra },
  });

  const CARD_W  = 8.5;
  const CARD_H  = 0.72;
  const START_Y = 1.38;
  const GAP     = 0.14;

  steps.forEach((step, i) => {
    const y = START_Y + i * (CARD_H + GAP);
    addCard(pres, s, 0.8, y, CARD_W, CARD_H, { fill: C.midBg, accent: C.sage });

    s.addText(step.num || String(i + 1).padStart(2, '0'), {
      x: 1.04, y: y + 0.1, w: 0.4, h: 0.2,
      fontSize: 9, bold: true, color: C.sage, charSpacing: 1, margin: 0,
    });
    s.addText(step.title, {
      x: 1.5, y: y + 0.08, w: CARD_W - 1.1, h: 0.3,
      fontSize: 13, bold: true, color: C.white, valign: 'middle', margin: 0,
    });
    if (step.desc) {
      s.addText(step.desc, {
        x: 1.04, y: y + 0.44, w: CARD_W - 0.65, h: 0.22,
        fontSize: 10, color: C.muted, margin: 0,
      });
    }
  });

  return s;
}

// ─── CLOSING: Thank You ───────────────────────────────────────────────────────
/**
 * addThankYouSlide(pres, pptx, opts)
 * @param {object} pres
 * @param {object} pptx
 * @param {object} opts
 *   @param {string} opts.headline     - large closing message (e.g. "Obrigado.")
 *   @param {string} [opts.subtitle]   - supporting line below headline
 *   @param {string} [opts.tagline]    - smaller muted closing line
 */
async function addThankYouSlide(pres, pptx, { headline = 'Obrigado.', subtitle = '', tagline = '' }) {
  const s = pptx.addSlide();
  s.background = { color: C.darkBg };

  // Left sage accent bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.45, h: SLIDE_H,
    fill: { color: C.sage },
    line: { color: C.sage },
  });

  // Decorative circles — bottom right (mirrors cover)
  s.addShape(pres.shapes.OVAL, {
    x: 6.5, y: 2.5, w: 5.0, h: 5.0,
    fill: { color: C.midBg },
    line: { color: C.midBg },
  });
  s.addShape(pres.shapes.OVAL, {
    x: 7.5, y: 3.0, w: 3.0, h: 3.0,
    fill: { color: C.sage, transparency: 82 },
    line: { color: C.sage, transparency: 82 },
  });

  // Brain icon
  const brainIcon = await renderIcon(FaBrain, '#' + C.sageLight, 512);
  s.addImage({ data: brainIcon, x: 7.9, y: 3.2, w: 2.0, h: 2.0 });

  // Eyebrow brand label
  s.addText('ELEVEN BRANDS', {
    x: 0.8, y: 1.4, w: 6, h: 0.3,
    fontSize: 10, bold: true, charSpacing: 4,
    color: C.sageLight, margin: 0,
  });

  // Main headline
  s.addText(headline, {
    x: 0.8, y: 1.85, w: 6.5, h: 1.5,
    fontSize: 34, bold: true,
    color: C.white, fontFace: 'Calibri', lineSpacingMultiple: 1.2, margin: 0,
  });

  // Terra divider
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 3.52, w: 2.2, h: 0.04,
    fill: { color: C.terra },
    line: { color: C.terra },
  });

  // Subtitle
  if (subtitle) {
    s.addText(subtitle, {
      x: 0.8, y: 3.72, w: 6.5, h: 0.35,
      fontSize: 14, color: C.muted, fontFace: 'Calibri Light', margin: 0,
    });
  }

  // Tagline
  if (tagline) {
    s.addText(tagline, {
      x: 0.8, y: 4.15, w: 6.5, h: 0.3,
      fontSize: 12, color: C.graphite, fontFace: 'Calibri Light', margin: 0,
    });
  }

  return s;
}

// ─── CLOSING: Motivational Quote ─────────────────────────────────────────────
/**
 * addMotivationalQuoteSlide(pres, pptx, opts)
 * @param {object} pres
 * @param {object} pptx
 * @param {object} opts
 *   @param {string} opts.quote   - the quote text (required)
 *   @param {string} [opts.author] - attribution
 */
function addMotivationalQuoteSlide(pres, pptx, { quote, author = '' }) {
  const s = pptx.addSlide();
  s.background = { color: C.darkBg };

  // Left sage accent bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.45, h: SLIDE_H,
    fill: { color: C.sage },
    line: { color: C.sage },
  });

  // Decorative circles — bottom right
  s.addShape(pres.shapes.OVAL, {
    x: 6.5, y: 2.5, w: 5.0, h: 5.0,
    fill: { color: C.midBg },
    line: { color: C.midBg },
  });
  s.addShape(pres.shapes.OVAL, {
    x: 7.5, y: 3.0, w: 3.0, h: 3.0,
    fill: { color: C.sage, transparency: 82 },
    line: { color: C.sage, transparency: 82 },
  });

  // Large decorative opening quote mark
  s.addText('\u201C', {
    x: 0.7, y: 0.4, w: 1.4, h: 1.4,
    fontFace: 'Calibri', fontSize: 110, bold: true,
    color: C.sage, transparency: 40, margin: 0,
  });

  // Quote text
  s.addText(quote, {
    x: 0.9, y: 1.3, w: 7.8, h: 2.4,
    fontFace: 'Calibri', fontSize: 24, bold: false,
    color: C.white, align: 'left', valign: 'middle',
    wrap: true, italic: true, margin: 0,
  });

  // Terra divider
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.9, y: 3.88, w: 2.2, h: 0.04,
    fill: { color: C.terra },
    line: { color: C.terra },
  });

  // Author
  if (author) {
    s.addText('\u2014 ' + author, {
      x: 0.9, y: 4.02, w: 7, h: 0.3,
      fontSize: 13, color: C.sage, fontFace: 'Calibri Light', margin: 0,
    });
  }

  // Brand mark
  s.addText('ELEVEN BRANDS', {
    x: 0.8, y: 5.08, w: 3, h: 0.22,
    fontSize: 8, bold: true, charSpacing: 4,
    color: C.graphite, margin: 0,
  });

  return s;
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  C,                          // palette — use for content slide colors
  mkShadow,                   // shadow factory — never reuse objects
  addCard,                    // card helper — use for content slide cards
  addEyebrow,                 // eyebrow helper — use for content slides
  addFooter,                  // footer — call on every content slide
  addCoverSlide,              // async — slide 1
  addAgendaSlide,             // slide 2
  addNextStepsSlide,          // closing option A
  addThankYouSlide,           // async — closing option B
  addMotivationalQuoteSlide,  // closing option C
};
