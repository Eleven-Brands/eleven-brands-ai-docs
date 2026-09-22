"""Builds the EU Inventory Check .xlsx report from a captured BigQuery row set.

Battle-tested, exact-structure build script for the inventory-check-eu skill. Do not
rewrite or reshape this logic inline in a one-off script -- if something about the
output needs to change, fix it here and re-run, the same way presentation-creator's
slide-templates.js is treated.

Usage inside the claude.ai sandbox:
    1. Write the captured row data (list of dicts, one per result row, keys matching
       HEADER below) to /home/claude/rows.json
    2. Copy this file to /home/claude/build_report.py
    3. Run: python /home/claude/build_report.py
    4. The output lands at /mnt/user-data/outputs/eu_inventory_check_<today>.xlsx
"""

import json
from datetime import date
from pathlib import Path

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

ROWS_PATH = Path("/home/claude/rows.json")
OUTPUT_DIR = Path("/mnt/user-data/outputs")

# Exact header row -- order is locked, matches the team's reference template
# (eu_inventory_check.xlsx) column-for-column. Never reorder without an explicit
# requester override.
HEADER = [
    "asin", "sku", "sku_type", "eu_inventory", "gb_inventory",
    "GB", "DE", "ES", "FR", "IT", "NL", "BE", "IE", "PL", "SE", "TR",
]

# Country columns start at F (index 6, 1-based) and end at P (index 16).
COUNTRY_COL_START = 6
COUNTRY_COL_END = 16

COUNTRY_COLUMN_WIDTH = 18
ROW_HEIGHT = 21
THIN_BORDER = Border(
    left=Side(style="thin"), right=Side(style="thin"),
    top=Side(style="thin"), bottom=Side(style="thin"),
)
HEADER_FONT = Font(bold=True)

# Vertical middle for the whole table. Horizontal: eu_inventory/gb_inventory
# centered, country columns (F:P) right-aligned, everything else left/default.
ALIGN_DEFAULT = Alignment(vertical="center")
ALIGN_CENTER = Alignment(horizontal="center", vertical="center")
ALIGN_RIGHT = Alignment(horizontal="right", vertical="center")
CENTERED_COLUMNS = {"eu_inventory", "gb_inventory"}

# Fixed widths for the non-country columns (A-E). Country columns (F-P) all
# use COUNTRY_COLUMN_WIDTH instead.
COLUMN_WIDTHS = {
    "asin": 15,
    "sku": 40,
    "sku_type": 15,
    "eu_inventory": 15,
    "gb_inventory": 15,
}


def build(rows: list[dict]) -> Path:
    wb = Workbook()
    ws = wb.active
    ws.title = "main"

    ws.append(HEADER)
    for row in rows:
        ws.append([row.get(col) for col in HEADER])

    last_row = len(rows) + 1  # +1 for the header row
    country_range = f"F2:P{last_row}"

    for name, width in COLUMN_WIDTHS.items():
        col = HEADER.index(name) + 1
        ws.column_dimensions[ws.cell(row=1, column=col).column_letter].width = width

    for col in range(COUNTRY_COL_START, COUNTRY_COL_END + 1):
        ws.column_dimensions[ws.cell(row=1, column=col).column_letter].width = COUNTRY_COLUMN_WIDTH

    for r in range(1, last_row + 1):
        ws.row_dimensions[r].height = ROW_HEIGHT
        for c in range(1, len(HEADER) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = THIN_BORDER
            if c >= COUNTRY_COL_START:
                cell.alignment = ALIGN_RIGHT
            elif HEADER[c - 1] in CENTERED_COLUMNS:
                cell.alignment = ALIGN_CENTER
            else:
                cell.alignment = ALIGN_DEFAULT

    for c in range(1, len(HEADER) + 1):
        ws.cell(row=1, column=c).font = HEADER_FONT

    sku_col = HEADER.index("sku") + 1
    for r in range(1, last_row + 1):
        ws.cell(row=r, column=sku_col).font = HEADER_FONT

    # Applied last so it overrides the per-column alignment above: every
    # header cell is centered both horizontally and vertically, regardless
    # of what its column's data rows use.
    for c in range(1, len(HEADER) + 1):
        ws.cell(row=1, column=c).alignment = ALIGN_CENTER

    # Freeze row 1 so it stays visible when scrolling, and add filter
    # dropdown arrows on the header row (equivalent to Ctrl+Shift+L).
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:P{last_row}"

    # Rule 1: literal 0 -> red font on red fill
    ws.conditional_formatting.add(
        country_range,
        CellIsRule(
            operator="equal",
            formula=["0"],
            font=Font(color="FF9C0006"),
            fill=PatternFill(bgColor="FFC00000"),
        ),
    )

    # Rule 2: contains "Inactive" -> yellow fill
    ws.conditional_formatting.add(
        country_range,
        FormulaRule(
            formula=['NOT(ISERROR(SEARCH("Inactive",F2)))'],
            fill=PatternFill(bgColor="FFFFFF00"),
        ),
    )

    # Rule 3: contains "Active" -> green fill
    ws.conditional_formatting.add(
        country_range,
        FormulaRule(
            formula=['NOT(ISERROR(SEARCH("Active",F2)))'],
            fill=PatternFill(bgColor="FF00B050"),
        ),
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"eu_inventory_check_{date.today().isoformat()}.xlsx"
    wb.save(output_path)
    return output_path


if __name__ == "__main__":
    rows = json.loads(ROWS_PATH.read_text(encoding="utf-8"))
    path = build(rows)
    print(f"Wrote {len(rows)} rows to {path}")
