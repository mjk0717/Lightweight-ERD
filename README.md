<div align="center">

![Lightweight-ERD banner](docs/banner.svg)

[![Live Demo](https://img.shields.io/badge/demo-mjk0717.github.io-brightgreen?logo=githubpages&logoColor=white)](https://mjk0717.github.io/)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![esbuild](https://img.shields.io/badge/bundled%20with-esbuild-FFCF00?logo=esbuild&logoColor=black)](package.json)
[![No server needed](https://img.shields.io/badge/runs%20from-file%3A%2F%2F-success)](#getting-started)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-lightgrey)](package.json)

**An offline-first ERD editor that lives in a single HTML file.**<br>
No install, no server, no accounts — [**try it right now in your browser →**](https://mjk0717.github.io/)

</div>

---

## Why Lightweight-ERD?

- **Zero friction** — open `index.html` (or the [live page](https://mjk0717.github.io/)) and start modeling. Everything runs client-side; your diagrams never leave your machine.
- **Real database workflows** — round-trip your schema: import existing DDL, edit visually, export DDL/PNG/JSON back out. Catalog-extraction SQL generators for Oracle, MySQL, PostgreSQL, and SQL Server are built in.
- **Feels like a real editor** — Excel-style column grids, app-wide undo/redo that survives refreshes, multi-select drag, minimap, and crow's-foot notation done properly.

## Features

- **Visual entity editing** — create tables from the right-click canvas menu, edit columns via double-click, drag headers to reposition, Ctrl+click to multi-select and move tables as a group
- **Excel-like column grid** — click-drag to select a cell range, copy/paste (including multi-cell, straight from/to spreadsheets), Delete to clear, drag rows to reorder
- **Relationships** — drag a table body onto another to connect, with crow's-foot/IE cardinality, composite (multi-column) FK support, and identifying vs. non-identifying (solid/dashed) lines derived from PK status
- **Draggable relation endpoints** — reposition either end anywhere along its entity's border, independent of the underlying FK column; self-referencing relations render as a clean arc, and angular routing steps around table bodies instead of cutting through them
- **Relation highlighting** — clicking a relation highlights the exact parent/child columns it connects
- **Logical / Physical modes** — toggle between business-friendly names/comments and physical table/column names
- **DDL import** — parses `CREATE TABLE`, `COMMENT ON`, and `ALTER TABLE ... ADD CONSTRAINT` (including the multi-constraint `ADD ( ... )` form), correctly wiring FKs even across separate imports
- **Reverse engineering** — one-query catalog-extraction SQL for Oracle / MySQL / PostgreSQL / SQL Server: run it against your database, paste the result, get your diagram
- **Export** — PNG (relation-aware bounds, nothing clipped), bulk or per-table DDL (optional FK constraints), and JSON (full diagram state + undo history)
- **System columns** — define common audit columns (`CREATED_BY`, `CREATED_DATE`, ...) once and apply them to every table, edited in the same spreadsheet-style grid
- **Undo/redo** — app-wide Ctrl+Z / Ctrl+Y covering every canvas action, persisted across page refreshes (last 50 steps)
- **Fully offline** — no network calls, no telemetry; state persists in `sessionStorage` for the tab (use `Export JSON` to keep a diagram beyond the session)

## Getting Started

### Use it instantly

Open **<https://mjk0717.github.io/>** — the editor runs entirely in your browser.

### Run it locally

```bash
git clone https://github.com/mjk0717/Lightweight-ERD-Community.git
cd Lightweight-ERD-Community
npm install
npm run build
```

Then open `index.html` directly in a browser — no server needed. TypeScript sources live in `src/` and are bundled by esbuild into `dist/bundle.js`, which `index.html` loads via a plain `<script>` tag (no ES modules, so it also works from `file://`).

## Usage

- **Add a table** — right-click empty canvas and choose `Create Entity/Table`, then double-click the table to add/edit columns
- **Move tables** — drag a header; Ctrl+click several tables to move them together
- **Connect a relation** — drag a table's body onto another table (or back onto itself for a self-referencing relation)
- **Reposition a relation endpoint** — click the relation to select it, then drag either end's handle along its entity's border
- **Edit columns like a spreadsheet** — click-drag across cells to select a range, then copy/paste or Delete as usual
- **Import DDL** — click `Import DDL` and paste `CREATE TABLE` / `ALTER TABLE` statements, or use the vendor catalog-extraction SQL to pull a schema from a live database
- **Export** — `Export PNG` for a snapshot, `Export DDL` for bulk or per-table DDL, `Export JSON` to save/reload the full diagram
- **Undo/redo** — `Ctrl+Z` / `Ctrl+Y` (or the toolbar buttons)
- **Switch views** — use the Logical/Physical toggle in the toolbar

## Scripts

| Script | What it does |
| --- | --- |
| `npm run typecheck` | Type-check only (`tsc --noEmit`) |
| `npm run build` | Type-check, then bundle `src/main.ts` into `dist/bundle.js` |
| `npm run watch` | Rebuild `dist/bundle.js` on every save |

`dist/` is generated and not committed — run `npm run build` after cloning or pulling changes to `src/`.

## License

[Apache License 2.0](LICENSE)
