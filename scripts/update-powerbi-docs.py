"""
update-powerbi-docs.py
Parses TMDL SemanticModel files and updates Power BI reference docs with:
  - DAX formulas and dependencies (## Medidas DAX)
  - Table sources, modes, and columns (## Fontes das Tabelas)

Zero token cost — pure Python.

Usage:
    python update-powerbi-docs.py
    python update-powerbi-docs.py --dashboard base-tables
    python update-powerbi-docs.py --dashboard operations
    python update-powerbi-docs.py --dashboard profitability
"""

import re
import argparse
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent

DASHBOARDS = {
    "base-tables": {
        "tables_dir": Path(r"G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\Dashboards\OrganiHaus - Base Tables\OrganiHaus - Base Tables.SemanticModel\definition\tables"),
        "ref":        REPO_ROOT / "references" / "power-bi" / "organihaus-base-tables.md",
        "measure_file":           "Measurement Table.tmdl",
        "measures_title_prefix":  "Medidas DAX — Measurement Table",
        "measures_marker":        "## Medidas DAX",
        "tables_marker":          "## Fontes das Tabelas",
    },
    "operations": {
        "tables_dir": Path(r"G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\Dashboards\OrganiHaus - Operations\OrganiHaus - Operations.SemanticModel\definition\tables"),
        "ref":        REPO_ROOT / "references" / "power-bi" / "organihaus-operations.md",
        "measure_file":           "_Operations Metrics.tmdl",
        "measures_title_prefix":  "Medidas DAX — _Operations Metrics",
        "measures_marker":        "## Medidas DAX",
        "tables_marker":          "## Fontes das Tabelas",
    },
    "profitability": {
        "tables_dir": Path(r"G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\Dashboards\Organihaus - Profitability\OrganiHaus - Profitability.SemanticModel\definition\tables"),
        "ref":        REPO_ROOT / "references" / "power-bi" / "organihaus-profitability.md",
        "measure_file":           "medidas.tmdl",
        "measures_title_prefix":  "Medidas DAX — medidas",
        "measures_marker":        "## Medidas DAX",
        "tables_marker":          "## Fontes das Tabelas",
    },
}

# These table files contain only measures — skip them in the table parser
MEASURE_TABLE_NAMES = {"Measurement Table", "_Operations Metrics", "medidas"}

METADATA_RE = re.compile(
    r"^\t+(formatString|displayFolder|lineageTag|annotation|description"
    r"|isHidden|changedProperty|summarizeBy|dataType|column|hierarchy"
    r"|partition|measure)\b"
)


# ─────────────────────────────────────────────
#  MEASURES PARSER
# ─────────────────────────────────────────────

def parse_tmdl_measures(filepath: Path) -> list[dict]:
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    measures = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^(\t+)measure\s+(.*?)\s*=\s*(.*)", line)
        if not m:
            i += 1
            continue

        indent = m.group(1)
        raw_name = m.group(2).strip().strip("'")
        rest = m.group(3).strip()
        formula_lines: list[str] = []
        display_folder = ""

        if rest.startswith("```"):
            rest_after = rest[3:]
            if rest_after.strip():
                formula_lines.append(rest_after)
            i += 1
            while i < len(lines):
                if "```" in lines[i]:
                    before_end = lines[i][: lines[i].index("```")]
                    if before_end.strip():
                        formula_lines.append(before_end)
                    i += 1
                    break
                formula_lines.append(lines[i].rstrip("\n"))
                i += 1
        elif rest:
            formula_lines.append(rest)
            i += 1
        else:
            i += 1
            while i < len(lines):
                nl = lines[i]
                if METADATA_RE.match(nl):
                    break
                if re.match(r"^" + re.escape(indent) + r"measure\b", nl):
                    break
                if re.match(r"^[^\t]", nl) and nl.strip():
                    break
                formula_lines.append(nl.rstrip("\n"))
                i += 1

        j = i
        while j < len(lines) and j < i + 15:
            df_m = re.match(r"^\t+displayFolder:\s*(.+)", lines[j])
            if df_m:
                display_folder = df_m.group(1).strip()
                break
            if re.match(r"^\t+measure\b", lines[j]) or re.match(r"^table\b", lines[j]):
                break
            j += 1

        formula = _clean_indent(formula_lines)

        col_pm = re.findall(r"'([^']+)'\[([^\]]+)\]", formula)
        col_deps = set(f"'{t}'[{c}]" for t, c in col_pm)
        bare = re.findall(r"(?<!\')([a-zA-Z_][\w ]*)\[([^\]]+)\]", formula)
        for tbl, col in bare:
            tbl = tbl.strip()
            if tbl and not tbl.startswith("//"):
                col_deps.add(f"{tbl}[{col}]")
        col_deps_sorted = sorted(col_deps)
        col_names = {c for _, c in col_pm} | {col for _, col in bare}
        all_b = re.findall(r"(?<![\'\"a-zA-Z0-9_])\[([^\]]+)\]", formula)
        measure_deps = sorted(set(all_b) - col_names)

        measures.append({
            "name": raw_name,
            "formula": formula,
            "display_folder": display_folder or "(sem pasta)",
            "measure_deps": measure_deps,
            "col_deps": col_deps_sorted,
        })

    return measures


def generate_measures_section(measures: list[dict], title: str) -> str:
    by_folder: dict[str, list] = defaultdict(list)
    for m in measures:
        by_folder[m["display_folder"]].append(m)

    lines = [f"## {title}\n"]
    for folder in sorted(by_folder.keys()):
        lines.append(f"\n### {folder}\n")
        for m in by_folder[folder]:
            lines.append(f"#### `{m['name']}`\n")
            if m["measure_deps"]:
                lines.append(
                    "**Depende de medidas:** "
                    + ", ".join(f"`[{d}]`" for d in m["measure_deps"])
                    + "  "
                )
            if m["col_deps"]:
                lines.append(
                    "**Depende de colunas:** "
                    + ", ".join(f"`{c}`" for c in m["col_deps"])
                    + "  "
                )
            lines.append("```dax")
            lines.append(m["formula"])
            lines.append("```\n")

    return "\n".join(lines)


# ─────────────────────────────────────────────
#  TABLE SOURCES PARSER
# ─────────────────────────────────────────────

def _clean_indent(raw_lines: list[str]) -> str:
    expanded = [l.expandtabs(4) for l in raw_lines]
    non_empty = [l for l in expanded if l.strip()]
    if not non_empty:
        return ""
    min_ind = min(len(l) - len(l.lstrip()) for l in non_empty)
    return "\n".join(
        l[min_ind:] if len(l) >= min_ind else l.lstrip() for l in expanded
    ).strip()


def _unescape_pq(text: str) -> str:
    return text.replace("#(lf)", "\n").replace("#(tab)", "\t").replace("#(cr)", "")


def _detect_lang(source: str) -> str:
    stripped = source.lstrip()
    if re.match(r"(?i)(select|with|insert|update|delete)\b", stripped):
        return "sql"
    return "powerquery"


def parse_tmdl_table_source(filepath: Path) -> dict | None:
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    if not lines:
        return None

    # Table name from first line
    m = re.match(r"^table\s+'?(.*?)'?\s*$", lines[0].rstrip())
    if not m:
        return None
    table_name = m.group(1).strip()

    # Columns
    columns: list[str] = []
    i = 0
    while i < len(lines):
        cm = re.match(r"^\t+column\s+'?(.*?)'?\s*$", lines[i].rstrip())
        if cm:
            col_name = cm.group(1).strip()
            data_type = ""
            for j in range(i + 1, min(i + 6, len(lines))):
                dt = re.match(r"^\t+dataType:\s*(.+)", lines[j])
                if dt:
                    data_type = dt.group(1).strip()
                    break
                if re.match(r"^\t+column\b|\t+partition\b|\t+measure\b", lines[j]):
                    break
            columns.append(f"`{col_name}` {data_type}" if data_type else f"`{col_name}`")
        i += 1

    # Find partition block and extract mode + source
    mode = ""
    query_group = ""
    source = ""
    lang = "powerquery"

    for i, line in enumerate(lines):
        if not re.match(r"^\t+partition\b", line):
            continue

        # Read mode and queryGroup
        for j in range(i + 1, min(i + 6, len(lines))):
            mm = re.match(r"^\t+mode:\s*(.+)", lines[j])
            qg = re.match(r"^\t+queryGroup:\s*(.+)", lines[j])
            if mm:
                mode = mm.group(1).strip()
            if qg:
                query_group = qg.group(1).strip()
            if re.match(r"^\t+source\b", lines[j]):
                break

        # Find source line
        for j in range(i, len(lines)):
            sm = re.match(r"^(\t+)source\s*=\s*(.*)", lines[j])
            if not sm:
                continue

            src_indent = sm.group(1)
            rest = sm.group(2).strip()

            if rest.startswith("```"):
                # Backtick multiline
                src_lines: list[str] = []
                rest_after = rest[3:]
                if rest_after.strip():
                    src_lines.append(rest_after)
                k = j + 1
                while k < len(lines):
                    if "```" in lines[k]:
                        break
                    src_lines.append(lines[k].rstrip("\n"))
                    k += 1
                source = _clean_indent(src_lines)
            elif rest:
                # Single-line source (usually a long M string with #(lf))
                source = rest
            else:
                # Multiline without backticks: read until indentation drops
                src_lines = []
                src_indent_len = len(src_indent)
                k = j + 1
                while k < len(lines):
                    nl = lines[k]
                    stripped = nl.rstrip("\n")
                    indent_len = len(stripped) - len(stripped.lstrip())
                    if stripped.strip() and indent_len <= src_indent_len:
                        break
                    src_lines.append(stripped)
                    k += 1
                source = _clean_indent(src_lines)

            source = _unescape_pq(source)
            lang = _detect_lang(source)
            break

        break  # Only first partition

    return {
        "name": table_name,
        "mode": mode,
        "query_group": query_group,
        "columns": columns,
        "source": source,
        "lang": lang,
    }


def parse_all_table_sources(tables_dir: Path) -> list[dict]:
    results = []
    for tmdl_file in sorted(tables_dir.glob("*.tmdl")):
        stem = tmdl_file.stem
        if stem in MEASURE_TABLE_NAMES:
            continue
        result = parse_tmdl_table_source(tmdl_file)
        if result:
            results.append(result)
    return results


def generate_table_sources_section(tables: list[dict], title: str) -> str:
    lines = [f"## {title}\n"]
    for t in tables:
        lines.append(f"\n### `{t['name']}`\n")
        meta_parts = []
        if t["mode"]:
            meta_parts.append(f"**Modo:** `{t['mode']}`")
        if t["query_group"]:
            meta_parts.append(f"**Grupo:** `{t['query_group']}`")
        if meta_parts:
            lines.append("  ".join(meta_parts) + "  ")
        if t["columns"]:
            lines.append("**Colunas:** " + ", ".join(t["columns"]) + "  ")
        if t["source"]:
            lines.append(f"```{t['lang']}")
            lines.append(t["source"])
            lines.append("```\n")
    return "\n".join(lines)


# ─────────────────────────────────────────────
#  REFERENCE FILE UPDATER
# ─────────────────────────────────────────────

def _replace_section(file_lines: list[str], marker: str, new_section: str) -> list[str]:
    """Replace everything from marker to the next ## heading (or EOF) with new_section."""
    start = None
    for i, line in enumerate(file_lines):
        if line.startswith(marker):
            start = i
            break

    if start is None:
        # Append at end
        return file_lines + ["\n---\n\n" + new_section + "\n"]

    # Find next ## heading after start
    end = len(file_lines)
    for i in range(start + 1, len(file_lines)):
        if file_lines[i].startswith("## ") and not file_lines[i].startswith(marker):
            end = i
            break

    return file_lines[:start] + [new_section + "\n\n"] + file_lines[end:]


def update_reference_file(cfg: dict) -> None:
    tables_dir: Path = cfg["tables_dir"]
    ref_path: Path   = cfg["ref"]

    if not tables_dir.exists():
        print(f"  [SKIP] Pasta TMDL nao encontrada: {tables_dir}")
        return

    # ── 1. Measures ───────────────────────────
    measure_file = tables_dir / cfg["measure_file"]
    if measure_file.exists():
        print(f"  Medidas: parsing {measure_file.name}...", end=" ", flush=True)
        measures = parse_tmdl_measures(measure_file)
        print(f"{len(measures)} medidas")
        measures_section = generate_measures_section(
            measures,
            f"{cfg['measures_title_prefix']} ({len(measures)} medidas)"
        )
    else:
        print(f"  [SKIP] Arquivo de medidas nao encontrado: {measure_file.name}")
        measures_section = None

    # ── 2. Table sources ──────────────────────
    print(f"  Tabelas: parsing {tables_dir.name}/...", end=" ", flush=True)
    tables = parse_all_table_sources(tables_dir)
    print(f"{len(tables)} tabelas")
    tables_section = generate_table_sources_section(
        tables,
        f"Fontes das Tabelas ({len(tables)} tabelas)"
    )

    # ── 3. Write ──────────────────────────────
    with open(ref_path, "r", encoding="utf-8") as f:
        file_lines = f.readlines()

    if measures_section:
        file_lines = _replace_section(file_lines, cfg["measures_marker"], measures_section)
    file_lines = _replace_section(file_lines, cfg["tables_marker"], tables_section)

    with open(ref_path, "w", encoding="utf-8") as f:
        f.writelines(file_lines)

    kb = sum(len(l) for l in file_lines) // 1024
    print(f"  OK --> {ref_path.name} ({kb}KB)")


# ─────────────────────────────────────────────
#  ENTRY POINT
# ─────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Atualiza documentacao Power BI a partir dos arquivos TMDL"
    )
    parser.add_argument(
        "--dashboard",
        choices=list(DASHBOARDS.keys()) + ["all"],
        default="all",
    )
    args = parser.parse_args()

    targets = list(DASHBOARDS.keys()) if args.dashboard == "all" else [args.dashboard]
    print(f"Atualizando referencias Power BI: {', '.join(targets)}\n")

    for name in targets:
        print(f"[{name}]")
        update_reference_file(DASHBOARDS[name])
        print()

    print("Concluido!")


if __name__ == "__main__":
    main()
