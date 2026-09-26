<h1 align="center">SyntaxisAI</h1>

<p align="center">
  <strong>Cancelled experimental invoice extraction platform for turning invoice PDFs into structured review/export data.</strong><br>
  <em>Published as-is for reference, reuse, and salvage under the MIT License; not maintained, not production-ready, and not a supported SaaS product.</em>
</p>

<p align="center">
  <a href="#security-warning">Security Warning</a> •
  <a href="#what-this-was">What This Was</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#legal-and-licensing">Legal And Licensing</a> •
  <a href="#disclaimer">Disclaimer</a> •
  <a href="#license">License</a>
</p>

## Security Warning

> [!WARNING]
> **Authentication is bypassed. Never deploy this code or expose it to a network as is.**
>
> In `services/api/main.py`, `get_current_user` ignores whatever credentials a request sends and always returns one shared demo user (`demo@syntaxis.ai`), creating it if needed. Every request is treated as that user, so anyone who can reach the API can upload, read, export and delete every document, template and batch job.
>
> Related shortcuts elsewhere: the React frontend's auth hooks are stubbed ("free access mode"), and the `apps/pdf-converter` upload server accepts files from anyone with no authentication.
>
> Run it only on your own machine, bound to `127.0.0.1`, with test documents you are allowed to process.

## What This Was

- React/TypeScript frontend (`frontend/`) for uploading and reviewing invoice documents, with Electron packaging experiments for a desktop build.
- Node.js/Express backend (`backend/`) for authentication, file handling, OCR orchestration, and invoice data APIs (PostgreSQL via Prisma, Redis).
- Python FastAPI service (`services/api/`, with a Celery worker in `services/worker/`) for PDF parsing, table detection, template matching, and Excel export, plus a React UI for it in `apps/web/`.
- A small Create React App prototype with a local Express upload server in `apps/pdf-converter/`.

## Getting Started

This is a code archive. The commands below are what the original development flow used; expect to fix things along the way. You need Node.js 18+, Python 3.11+, and PostgreSQL and Redis (the included `docker-compose.yml` starts both locally).

No sample documents are bundled. Use PDFs of your own and keep them in the git-ignored `samples/` folder. Do not feed it real invoices containing other people's personal data.

### Node stack (frontend + backend)

```bash
cp .env.example .env
cp backend/.env.example backend/.env   # edit DATABASE_URL, JWT_SECRET, etc.
docker compose up -d                   # PostgreSQL, Redis and MailHog
npm install
cd backend && npx prisma generate && npx prisma migrate dev && cd ..
npm run dev                            # frontend on :5173, backend on :3001
```

### Python API + web UI

The Python API needs PyMuPDF, which is **not** in `requirements.txt` on purpose. Read [PyMuPDF (AGPL) in plain terms](#pymupdf-agpl-in-plain-terms) before installing it.

```bash
cd services/api
python -m venv .venv
source .venv/bin/activate              # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install PyMuPDF                    # AGPL-3.0, see the licensing section
uvicorn main:app --host 127.0.0.1 --port 8000
```

By default it uses a local SQLite file (`services/api/pdf_extractor.db`) and writes to `services/api/uploads/` and `services/api/outputs/`; all three are git-ignored. Batch jobs also need Redis and the Celery worker in `services/worker/`. Then start the UI:

```bash
cd apps/web
npm install
npm run dev                            # http://localhost:3000
```

`docker-compose.new.yml` starts the same stack in containers, but its API image will not start without PyMuPDF, and Docker publishes the ports on all network interfaces. Given the security warning above, prefer the local commands.

### pdf-converter prototype

```bash
cd apps/pdf-converter
npm install
npm run start:server   # upload server on :3001, saves to apps/pdf-converter/uploads/ (git-ignored)
npm start              # React app on :3000
```

The upload server uses the same port as the Node backend, so do not run both at once.

### Tests

- Backend: `cd backend && npx jest src/__tests__/unit`. Many other suites expect a running PostgreSQL/Redis or were never finished.
- Frontend: `cd frontend && npm test`.
- Python API: `cd services/api && pytest` (needs PyMuPDF and `httpx`).
- The treasury report parser test only runs when you give it a PDF: set `TREASURY_SAMPLE_PDF=/path/to/your.pdf` or place one at `samples/treasury-sample.pdf`.

## Legal And Licensing

The original SyntaxisAI source code is released under the MIT License. See [LICENSE](LICENSE).

Third-party dependencies are not relicensed by this repository. They remain under their own licenses, including permissive, copyleft, and attribution licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [docs/LICENSE_AUDIT.md](docs/LICENSE_AUDIT.md) before redistributing, packaging, or publishing binaries.

### PyMuPDF (AGPL) in plain terms

- `services/api/main.py`, `extraction_engine.py`, `table_detector.py`, `fingerprint_service.py` and `test_batch_pipeline.py` import `fitz`, which is PyMuPDF.
- PyMuPDF and the MuPDF library it wraps are licensed under the GNU AGPL-3.0, or under a paid commercial licence from Artifex. PyMuPDF is not included in this repository and is not listed in `requirements.txt`; the MIT License here covers only the original SyntaxisAI code.
- If you install PyMuPDF and then distribute the Python service, or let other people use it over a network, the AGPL requires you to offer those users the complete source code of your whole service under the AGPL-3.0.
- To avoid that, buy a commercial PyMuPDF licence or rewrite those files against a permissively licensed PDF library (`pdfplumber`, already a dependency, covers much of the same ground).

### Other audit notes

- The repository previously claimed MIT licensing without a root `LICENSE` file. That has been corrected.
- Before publication, the git history was cleaned of a checked-in Python virtual environment (which contained PyMuPDF/MuPDF binaries), a third-party sample PDF, a local development database, and environment and Kubernetes secret files that held only placeholder values.
- `ua-parser-js` v2 was removed from backend manifests and replaced with local lightweight user-agent parsing.
- Electron packaging should preserve third-party license notices if anyone revives binary distribution.
- This is not legal advice. Have a lawyer review the dependency and distribution model before shipping a derivative product.

## Project Structure

```text
SyntaxisAI/
├── frontend/          # React/Electron frontend
├── backend/           # Node.js/Express API server
├── services/          # Python API and Celery worker
├── apps/              # web UI for the Python API, pdf-converter prototype
├── database/          # Database schema and migration material
├── k8s/               # Kubernetes manifests (secrets.example.yaml only)
├── docs/              # Project and audit documentation
└── scripts/           # Setup and utility scripts
```

## Reuse Guidance

If you want to reuse this project, treat it as a code archive rather than a ready product:

1. Replace the authentication bypass in `services/api/main.py` and the stubbed frontend auth before anything else.
2. Keep generated artifacts (virtual environments, `node_modules`, uploads, databases, real `.env` and secret files) out of version control; `.gitignore` covers the usual paths.
3. Re-run dependency license scanning for your exact runtime and build output.
4. Rewrite or commercially license legacy `fitz`/PyMuPDF-based code before reviving the Python extraction service.
5. Regenerate lockfiles and third-party notices.
6. Review security, privacy, and data handling before processing real invoices.

## Disclaimer

This project is provided as is, without warranty of any kind, under the MIT License. Use it at your own risk.

## License

Original SyntaxisAI source code: MIT License.

Third-party dependencies and generated artifacts: their respective licenses.
