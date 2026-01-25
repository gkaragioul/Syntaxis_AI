## 0) Goal (MVP)
Build a SaaS-style web app that:
1) Lets a user upload ONE representative PDF.
2) Automatically detects candidate table regions.
3) Lets the user SELECT / ADJUST what to export (ignore logos/graphics/executive summaries).
4) Saves the selection + extraction rules as a reusable TEMPLATE.
5) Applies the same template to a batch of PDFs with the SAME structure.
6) Exports clean .xlsx files (per PDF + optional combined workbook) with merged-cell/header logic preserved as best as possible.

**Hard scope limit for MVP:** support DIGITAL PDFs (selectable text) first.  
If scanned/image PDFs are uploaded, show “Scanned PDF not supported in MVP” with a clear message and stop (no OCR in MVP).

---

## 1) Product Requirements (must-have)
### Core flows
A) Template Builder
- Upload a single PDF (max 50MB).
- Render pages in browser (PDF viewer).
- Auto-detect “candidate table boxes” per page.
- User can:
  - Click a detected region to select as table
  - Draw/resize a bounding box manually
  - Mark regions to IGNORE (logos, headers, footers, notes)
  - Define header rows depth (0–10)
  - Define “repeat header each page” toggle
  - Define “totals/footnotes rows” handling: keep / drop / separate sheet
  - Define column rules:
    - Auto (inferred)
    - Manual column separators (drag vertical guides)
  - Define merged cell behavior:
    - Preserve merge (preferred)
    - Expand merges (fill merged value to all covered cells)

B) Batch Run
- User selects an existing template.
- Uploads multiple PDFs (up to 200 for MVP).
- System processes asynchronously.
- Shows progress + per-file status:
  - SUCCESS
  - WARNING (layout drift detected)
  - FAIL (anchor missing, table not found, parse error)
- Outputs:
  - Download zip of Excel files
  - Optional combined workbook (one sheet per file)
  - Optional combined CSV schema (normalized) — behind a toggle

C) Preview
- Before saving template: show “Excel preview” for the sample PDF.
- Before batch export: show preview for 1 chosen PDF from the batch.

---

## 2) Non-Goals (explicitly not in MVP)
- “Works on any PDF in the world”
- OCR-driven extraction
- SOC2, SSO, enterprise features
- Auto-learning templates across vendors
- Perfect reconstruction of every merged cell in every messy table

---

## 3) Tech Stack (recommended for speed)
### Frontend
- Next.js (React) + TypeScript
- PDF rendering: pdf.js
- Canvas/overlay for boxes & column guides
- UI: shadcn/ui + tailwind (clean, minimal)

### Backend
- Python FastAPI
- Async jobs: Celery + Redis (or RQ + Redis)
- Storage:
  - Local filesystem for dev
  - S3-compatible later (interface-based)
- DB:
  - SQLite for dev
  - Postgres ready via SQLAlchemy

### Extraction libs (digital PDFs only)
- PyMuPDF (fitz) for text blocks + geometry (fast)
- pdfplumber for higher-level table heuristics (optional)
- openpyxl for .xlsx writing + merges

---

## 4) Repository Layout
- /apps/web                (Next.js)
- /services/api            (FastAPI)
- /services/worker         (Celery worker)
- /shared                  (types + template schema)
- docker-compose.yml       (web, api, redis, worker, db)
- README.md                (setup + run)

---

## 5) Data Models (DB)
### User (basic)
- id, email, password_hash (simple auth for MVP)
- created_at

### Document
- id, user_id
- filename, storage_path
- page_count
- sha256
- created_at

### Template
- id, user_id
- name, description
- created_at, updated_at
- schema_json (full template definition)

### BatchJob
- id, user_id, template_id
- status: QUEUED/RUNNING/DONE/FAILED
- created_at, finished_at

### BatchJobItem
- id, batch_job_id
- document_id
- status: SUCCESS/WARNING/FAILED
- warnings_json
- output_paths_json

---

## 6) Template Schema (JSON) — MUST IMPLEMENT
A template must be deterministic and reusable.

### TemplateSchema v1 (store in Template.schema_json)
- version: "1.0"
- anchors: [ { pageHint, text, matchMode: exact|contains|regex, bboxOffset: {dx,dy}, tolerancePx } ]
  Purpose: locate stable text near the target table (e.g., “Balance Sheet”) to adapt to minor layout shifts.
- tables: [
  {
    id: "main_table"
    pages: "all" | [1,2,3]
    region: {
      mode: "relativeToAnchor" | "absolute"
      anchorId?: "anchor_1"
      bbox: { x0,y0,x1,y1 }   // if relative, bbox is offset from anchor bbox; if absolute, page coords
    }
    header: { depthRows: int, repeatEachPage: bool }
    columns: {
      mode: "auto" | "manualGuides"
      guides?: [xCoord1, xCoord2, ...]  // vertical separators in page coords or relative coords
    }
    cleanup: {
      dropEmptyRows: bool
      dropTotalsRows: bool
      totalsDetection: { mode: "regex", patterns: ["^Total", "^TOTAL"] }
      dropFootnotesArea: bool
      footnotesRegion?: bbox
    }
    mergedCells: { mode: "preserve" | "expand" }
    output: {
      sheetName: "BalanceSheet"
      normalizeNumbers: bool          // parse (1,234.00) as -1234, etc.
      keepCurrencySymbols: bool
    }
  }
]
- driftDetection:
  - requiredColumnCount?: int
  - requiredHeaderKeywords?: ["Assets", "Liabilities"]
  - maxAnchorDistancePx: int
  - failOnDrift: bool (MVP default false → warning)

---

## 7) Extraction Engine (Algorithm) — MUST IMPLEMENT
Input: PDF bytes + TemplateSchema v1  
Output: structured grid + Excel file

### Steps (digital PDF)
1) Load PDF with PyMuPDF.
2) For each target table region:
   a) Locate anchor (if relative mode):
      - search text blocks per page
      - find best match by matchMode + proximity heuristics
      - if anchor missing and failOnDrift=true → FAIL; else WARNING and try fallback absolute coords
   b) Compute table bbox on each page.
   c) Extract all text spans/blocks whose bbox intersects table bbox.
3) Build row/column structure:
   - If columns.mode = manualGuides:
       - Use guides to assign each text span to a column bucket by x-center.
   - If columns.mode = auto:
       - Cluster x positions of spans into columns using 1D clustering with tolerance (e.g., DBSCAN-like simple implementation).
4) Build rows:
   - Cluster spans by y position (baseline) into rows with tolerance.
   - Sort rows top-to-bottom, columns left-to-right.
5) Header handling:
   - first N rows are headers (depthRows)
   - optionally repeat header for each page but output as a single header in Excel
6) Merged cell inference (best-effort):
   - Detect spans that extend across multiple column ranges (span bbox crosses guides) → merge horizontally.
   - Detect multi-line labels in first column that align across multiple y clusters → merge vertically (optional, best-effort).
7) Cleanup:
   - drop empty rows
   - drop totals rows by regex if configured
   - optional footnotes region removal
8) Normalize:
   - numeric parsing: thousands separators, parentheses negatives, currency symbols
9) Drift detection:
   - compare inferred column count vs expected
   - check header keywords present
   - if drift → status WARNING (or FAIL if configured)
10) Write Excel:
   - openpyxl workbook
   - write cells
   - apply merges if mergedCells.mode=preserve
   - basic formatting: bold header rows, freeze panes at first data row

---

## 8) Backend API (FastAPI)
### Auth (simple MVP)
- POST /auth/register
- POST /auth/login

### Documents
- POST /documents/upload  -> returns document_id, page_count
- GET  /documents/{id}/pages/{n}/render (returns image/png) OR serve via frontend using pdf.js directly
- GET  /documents/{id} metadata

### Template
- POST /templates (name, schema_json)
- GET  /templates
- GET  /templates/{id}
- PUT  /templates/{id}

### Preview
- POST /preview (document_id, template_schema_json) -> returns preview JSON grid + generated xlsx temp link

### Batch
- POST /batch (template_id, document_ids[])
- GET  /batch/{id}/status
- GET  /batch/{id}/download (zip)

---

## 9) Frontend Pages (Next.js)
1) /login
2) /dashboard
   - list templates
   - list recent batch jobs
3) /template/new
   - PDF upload
   - PDF viewer with overlay:
     - detected boxes
     - draw box tool
     - ignore box tool
     - column guide tool
   - right panel “Table Settings”
   - preview panel “Excel preview”
   - save template
4) /batch/run
   - pick template
   - upload many PDFs
   - run batch
   - show progress + results + download

---

## 10) Auto-Detection Heuristic (MVP-level)
In Template Builder after upload:
- Run a lightweight pass that finds dense text-block clusters:
  - For each page, get all text blocks with bbox.
  - Identify rectangles where text density is high and aligned in columns (many blocks with similar x positions).
  - Propose 1–3 candidate boxes per page.
This does NOT need to be perfect. Users can draw/adjust.

---

## 11) Security + Privacy (minimum viable)
- Store files privately (no public URLs).
- Delete files older than X days (configurable) via nightly job.
- No training on customer data.
- Basic rate limits on upload endpoints.

---

## 12) Testing & Quality Gates (must)
- Unit tests for:
  - anchor matching
  - column clustering
  - row clustering
  - numeric normalization
  - drift detection
- Golden test fixture:
  - include 2–3 sample PDFs in /services/api/tests/fixtures (synthetic or allowed)
  - assert output grid dimensions + key cell values

---

## 13) Deliverables / Definition of Done
MVP is done when:
- User can create a template on one PDF and get a correct Excel preview.
- User can run batch on 20+ same-structure PDFs and download Excel results.
- Drift detection flags layout changes as WARNING (not silent corruption).
- Scanned PDFs are rejected with a clear message.

---

## 14) Implementation Plan (execute in order)
1) Bootstrap monorepo + docker-compose.
2) Implement auth + storage + DB models.
3) Implement PDF upload + page count extraction.
4) Implement template schema + save/load.
5) Implement extraction engine (manual guides first, then auto columns).
6) Implement preview endpoint + Excel writing.
7) Implement batch job queue + worker + zip download.
8) Implement frontend Template Builder UI (viewer + boxes + guides).
9) Add drift warnings in UI + batch results.
10) Add tests + fixtures + CI.

---

## 15) Important Product Rule (do not break)
If uncertain, FAIL or WARN — never silently “guess” and output wrong numbers.
Finance users prefer an explicit warning over incorrect spreadsheets.

Now implement this MVP end-to-end.