#!/usr/bin/env python3
"""
Lightweight PDF extractor powered by pdfplumber.
Returns:
{
  "text": "<full document text>",
  "rows": [ { "page": 1, "y": 123.4, "text": "line text", "items": [...] }, ... ],
  "tables": [
    {
      "page": 1,
      "strategy": "lines" | "text",  # how pdfplumber found the table
      "data": [["col1", "col2"], ...],
      "structured": [ { "page": 1, "y": 120.5, "columns": [...], "cells": [{ "text": "...", "x": 10.2 }, ...] } ]
    }
  ]
}
"""

import json
import pathlib
import sys
from typing import List, Dict, Any

try:
    import pdfplumber  # type: ignore
    from pdfminer.layout import LTChar, LTContainer, LTCurve  # type: ignore
except Exception as exc:  # pragma: no cover - surfaced to caller
    sys.stderr.write(f"pdfplumber is required: {exc}\n")
    sys.exit(1)


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        return str(value)
    return str(value).replace("\n", " ").strip()


def is_horizontal(obj: Dict[str, Any]) -> bool:
    """Watermarks and margin notes are printed rotated; table text never is."""
    if obj.get("object_type") != "char":
        return True
    a, b, c, d = (obj.get("matrix") or (1, 0, 0, 1))[:4]
    return abs(b) < 1e-3 and abs(c) < 1e-3 and a > 0 and d > 0


def build_rows(words: List[Dict[str, Any]], page_number: int, tolerance: float = 2.5) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for word in sorted(words, key=lambda w: (float(w.get("top", 0)), float(w.get("x0", 0)))):
        text = normalize_text(word.get("text"))
        if not text:
            continue

        x0 = float(word.get("x0", 0.0))
        x1 = float(word.get("x1", x0))
        top = float(word.get("top", 0.0))
        bottom = float(word.get("bottom", top))

        row = next((r for r in rows if abs(r["y"] - top) <= tolerance), None)
        if row is None:
            row = {"page": page_number, "y": top, "items": []}
            rows.append(row)

        row["items"].append(
            {
                "text": text,
                "x": x0,
                "y": top,
                "width": x1 - x0,
                "height": bottom - top,
                "page": page_number,
            }
        )

    for row in rows:
        row["items"].sort(key=lambda i: i["x"])
        row["text"] = " ".join([i["text"] for i in row["items"] if i.get("text")])

    return sorted(rows, key=lambda r: (r["page"], -r["y"]))


def build_structured_rows(data: List[List[str]], bbox: List[float], page_number: int) -> List[Dict[str, Any]]:
    if not data:
        return []

    max_cols = max(len(row) for row in data) if data else 0
    if max_cols == 0:
        return []

    left, top, right, bottom = bbox
    row_height = (bottom - top) / max(1, len(data))
    col_width = (right - left) / max_cols if max_cols else 0

    structured: List[Dict[str, Any]] = []
    for row_index, row in enumerate(data):
        row_y = bottom - (row_index + 0.5) * row_height if row_height else bottom
        cells = []
        for col_index in range(max_cols):
            cell_text = normalize_text(row[col_index]) if col_index < len(row) else ""
            cell_x = left + (col_index + 0.5) * col_width if col_width else left
            cells.append({"text": cell_text, "x": cell_x})

        structured.append({"page": page_number, "y": row_y, "columns": [normalize_text(c) for c in row], "cells": cells})

    return structured


def extract_tables(page: "pdfplumber.page.Page", page_number: int) -> List[Dict[str, Any]]:
    tables_out: List[Dict[str, Any]] = []
    seen_signatures = set()

    settings_variants = [
        {
          "vertical_strategy": "lines",
          "horizontal_strategy": "lines",
          "snap_tolerance": 3,
          "join_tolerance": 3,
          "edge_min_length": 15,
        },
        {
          "vertical_strategy": "text",
          "horizontal_strategy": "text",
          "snap_tolerance": 3,
          "join_tolerance": 3,
          "edge_min_length": 3,
        },
    ]

    for settings in settings_variants:
        try:
            tables = page.find_tables(table_settings=settings)
        except Exception:
            continue

        for table in tables or []:
            try:
                data = table.extract()
            except Exception:
                continue

            if not data:
                continue

            normalized = [[normalize_text(cell) for cell in (row or [])] for row in data]
            signature = "|".join([",".join(row) for row in normalized])
            if signature in seen_signatures:
                continue
            seen_signatures.add(signature)

            bbox = list(getattr(table, "bbox", [0, 0, page.width, page.height]))
            structured = build_structured_rows(normalized, bbox, page_number)
            tables_out.append({
                "page": page_number,
                "strategy": settings["vertical_strategy"],
                "data": normalized,
                "structured": structured,
            })

    return tables_out


def on_page(page: "pdfplumber.page.Page"):
    """Keeps the characters that sit on the page: a statement may print its own
    reference numbers past the right edge, where no reader sees them. A glyph
    the font has no character for ("(cid:856)", an ellipsis) is no text, and its
    width and height would throw the line it sits in off its neighbours."""
    left, _, right, _ = page.bbox
    return lambda obj: obj.get("object_type") != "char" or (
        obj["x0"] < right and obj["x1"] > left and not str(obj.get("text", "")).startswith("(cid:")
    )


def is_white(color: Any) -> bool:
    values = color if isinstance(color, (list, tuple)) else (color,)
    try:
        return tuple(float(v) for v in values) in ((1.0,), (1.0, 1.0, 1.0), (0.0, 0.0, 0.0, 0.0))
    except (TypeError, ValueError):
        return False


def hidden_chars(page: "pdfplumber.page.Page") -> set:
    """Characters a white fill drawn after them covers: an editor that paints
    over text to write new text on top leaves the old text underneath, where no
    reader sees it. Returned as the ids of the page's char objects, which come
    in the order the page draws them."""
    covered: set = set()
    drawn: List[Any] = []

    def walk(objects) -> None:
        for obj in objects:
            if isinstance(obj, LTChar):
                drawn.append(obj)
            elif isinstance(obj, LTCurve) and obj.fill and is_white(obj.non_stroking_color):
                for index, char in enumerate(drawn):
                    x, y = (char.x0 + char.x1) / 2, (char.y0 + char.y1) / 2
                    if obj.x0 <= x <= obj.x1 and obj.y0 <= y <= obj.y1:
                        covered.add(index)
            elif isinstance(obj, LTContainer):
                walk(obj)

    walk(page.layout)
    chars = page.chars
    if not covered or len(chars) != len(drawn):
        return set()
    return {id(chars[index]) for index in covered}


# Text below this size set over other text is no print a reader can make out.
SMUDGE_SIZE = 4.0


def upright(char: Dict[str, Any]) -> bool:
    matrix = char.get("matrix") or (1, 0, 0, 1)
    return abs(matrix[1]) < 1e-6 and abs(matrix[2]) < 1e-6


def smudges(chars: List[Dict[str, Any]]) -> set:
    """Characters under 4pt set over an upright character at least twice their
    size, most of their box inside its box: no reader can make them out, as an
    editor's leftovers drawn over the text it wrote ("01 Jul" at 3.75pt over
    "01 Feb" at 9pt). A watermark is turned, and the text under it is read."""
    found: set = set()
    by_line: Dict[int, List[Dict[str, Any]]] = {}
    for char in chars:
        by_line.setdefault(int(char["top"] // 10), []).append(char)
    for char in chars:
        area = (char["x1"] - char["x0"]) * (char["bottom"] - char["top"])
        if area <= 0 or char["size"] >= SMUDGE_SIZE or not char["text"].strip():
            continue
        line = int(char["top"] // 10)
        for other in by_line.get(line - 1, []) + by_line.get(line, []) + by_line.get(line + 1, []):
            if other["size"] < 2 * char["size"] or not upright(other) or not other["text"].strip():
                continue
            width = min(char["x1"], other["x1"]) - max(char["x0"], other["x0"])
            height = min(char["bottom"], other["bottom"]) - max(char["top"], other["top"])
            if width > 0 and height > 0 and width * height > area / 2:
                found.add(id(char))
                break
    return found


def visible(hidden: set):
    return lambda obj: obj.get("object_type") != "char" or id(obj) not in hidden


def parse_pdf(file_path: pathlib.Path) -> Dict[str, Any]:
    full_text: List[str] = []
    rows: List[Dict[str, Any]] = []
    tables: List[Dict[str, Any]] = []

    with pdfplumber.open(str(file_path)) as pdf:
        for page_number, raw_page in enumerate(pdf.pages, start=1):
            # Text painted over goes first: the text written on top at the same
            # spot would otherwise be dropped as its duplicate.
            hidden = hidden_chars(raw_page)
            page = raw_page.filter(visible(hidden)) if hidden else raw_page
            # Bold drawn twice at the same spot reads "PPaaggee" otherwise.
            page = page.dedupe_chars()
            page = page.filter(on_page(page))
            smudged = smudges(page.chars)
            if smudged:
                page = page.filter(visible(smudged))
            # The same gap splits words as in the rows below: at the default 3pt
            # a statement that sets words 2pt apart reads "Beginningbalance".
            page_text = page.extract_text(x_tolerance=1.5) or ""
            full_text.append(page_text)

            words = page.filter(is_horizontal).extract_words(
                x_tolerance=1.5,
                y_tolerance=2.0,
                keep_blank_chars=False,
                use_text_flow=True,
            ) or []
            rows.extend(build_rows(words, page_number))
            tables.extend(extract_tables(page, page_number))

    return {
        "text": "\n".join(full_text),
        "rows": rows,
        "tables": tables,
    }


def main() -> None:  # pragma: no cover - invoked from Node
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: pdfplumber_parser.py <file_path>\n")
        sys.exit(1)

    file_path = pathlib.Path(sys.argv[1])
    if not file_path.exists():
        sys.stderr.write(f"File not found: {file_path}\n")
        sys.exit(1)

    try:
        result = parse_pdf(file_path)
        json.dump(result, sys.stdout, ensure_ascii=False)
    except Exception as exc:
        sys.stderr.write(f"Failed to parse PDF with pdfplumber: {exc}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
