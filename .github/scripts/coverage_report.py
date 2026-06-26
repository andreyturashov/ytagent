from __future__ import annotations

import json
from pathlib import Path


BACKEND_FILE = Path("backend-coverage/coverage.json")
FRONTEND_FILE = Path("frontend-coverage/coverage-summary.json")
OUTPUT_FILE = Path("coverage.md")


def load_backend() -> dict | None:
    if not BACKEND_FILE.exists():
        return None

    with BACKEND_FILE.open() as f:
        data = json.load(f)

    totals = data["totals"]

    return {
        "coverage": totals["percent_covered"],
        "covered": totals["covered_lines"],
        "total": totals["num_statements"],
        "missing": totals["missing_lines"],
    }


def load_frontend() -> dict | None:
    if not FRONTEND_FILE.exists():
        return None

    with FRONTEND_FILE.open() as f:
        data = json.load(f)

    total = data["total"]

    return {
        "lines": total["lines"]["pct"],
        "branches": total["branches"]["pct"],
        "functions": total["functions"]["pct"],
        "statements": total["statements"]["pct"],
    }


def generate_markdown() -> str:
    backend = load_backend()
    frontend = load_frontend()

    md: list[str] = []

    md.append("# 📊 Coverage Report")
    md.append("")

    md.append("| Project | Coverage |")
    md.append("|---------|---------:|")

    md.append(
        f"| 🐍 Backend | {backend['coverage']:.1f}% |"
        if backend
        else "| 🐍 Backend | N/A |"
    )

    md.append(
        f"| ⚛️ Frontend | {frontend['lines']}% |" if frontend else "| ⚛️ Frontend | N/A |"
    )

    md.append("")
    md.append("## 🐍 Backend")
    md.append("")
    md.append("| Metric | Value |")
    md.append("|-------|------:|")

    if backend:
        md.append(f"| Coverage | {backend['coverage']:.1f}% |")
        md.append(f"| Covered lines | {backend['covered']} |")
        md.append(f"| Missing lines | {backend['missing']} |")
        md.append(f"| Statements | {backend['total']} |")
    else:
        md.append("| No coverage data | - |")

    md.append("")
    md.append("## ⚛️ Frontend")
    md.append("")
    md.append("| Metric | Value |")
    md.append("|-------|------:|")

    if frontend:
        md.append(f"| Lines | {frontend['lines']}% |")
        md.append(f"| Branches | {frontend['branches']}% |")
        md.append(f"| Functions | {frontend['functions']}% |")
        md.append(f"| Statements | {frontend['statements']}% |")
    else:
        md.append("| No coverage data | - |")

    return "\n".join(md)


def main() -> None:
    report = generate_markdown()
    OUTPUT_FILE.write_text(report)


if __name__ == "__main__":
    main()
