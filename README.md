# SyntaxisAI

**Project status: cancelled / archived.**

SyntaxisAI was an experimental invoice extraction platform for turning invoice PDFs into structured data for review and export. Development has been cancelled and the repository is published as-is for reference, reuse, and salvage under the MIT License.

This project is not maintained, not production-ready, and should not be treated as a supported SaaS product. Some implementation areas are incomplete, stale, or experimental.

## What This Was

- React/TypeScript frontend for uploading and reviewing invoice documents.
- Node.js/Express backend for authentication, file handling, OCR orchestration, and invoice data APIs.
- Python service experiments for PDF parsing, table detection, and extraction heuristics.
- Electron packaging experiments for a desktop build.

## Legal And Licensing

The original SyntaxisAI source code is released under the MIT License. See [LICENSE](LICENSE).

Third-party dependencies are not relicensed by this repository. They remain under their own licenses, including permissive, copyleft, and attribution licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [docs/LICENSE_AUDIT.md](docs/LICENSE_AUDIT.md) before redistributing, packaging, or publishing binaries.

Important audit notes:

- The repository previously claimed MIT licensing without a root `LICENSE` file. That has been corrected.
- The Python service uses PyMuPDF/MuPDF, which is AGPL-licensed unless a commercial license is obtained.
- The backend dependency tree includes `ua-parser-js` v2, listed as AGPL-3.0-or-later in the lockfile.
- Electron packaging should preserve third-party license notices if anyone revives binary distribution.
- This is not legal advice. Have a lawyer review the dependency and distribution model before shipping a derivative product.

## Historical Setup

The original development flow used Node.js 18+, PostgreSQL, Redis, and npm workspaces.

```bash
npm install
npm run dev
```

Those commands are kept for historical convenience only. They may fail without environment setup, database services, and dependency cleanup.

## Project Structure

```text
SyntaxisAI/
├── frontend/          # React/Electron frontend
├── backend/           # Node.js/Express API server
├── services/          # Python service experiments
├── database/          # Database schema and migration material
├── docs/              # Project and audit documentation
├── scripts/           # Setup and utility scripts
├── apps/              # Additional experiments
└── shared/            # Shared utilities and types
```

## Reuse Guidance

If you want to reuse this project, treat it as a code archive rather than a ready product:

1. Remove generated dependency artifacts such as checked-in virtual environments.
2. Re-run dependency license scanning for your exact runtime and build output.
3. Replace or commercially license AGPL components if your distribution model requires it.
4. Regenerate lockfiles and third-party notices.
5. Review security, privacy, and data handling before processing real invoices.

## License

Original SyntaxisAI source code: MIT License.

Third-party dependencies and generated artifacts: their respective licenses.
