# Third-Party Notices

SyntaxisAI original source code is licensed under MIT. Third-party dependencies remain under their own licenses and are not relicensed by this project.

This notice is a practical audit snapshot, not a complete legal opinion. Re-run a dependency license scan before distributing source archives, Docker images, hosted services, Electron builds, or binaries.

## High-Risk / Review Before Distribution

| Component | Where Detected | License Signal | Why It Matters |
|---|---|---|---|
| `@img/sharp-libvips-*` / `sharp` binary packages | `backend/package-lock.json`, root `package-lock.json` | LGPL-3.0-or-later and related mixed notices | Binary distribution must preserve notices and respect LGPL requirements. |

## Resolved / Not Included in Install Manifests

| Component | Previous Detection | Current Status |
|---|---|---|
| PyMuPDF / MuPDF | `services/api/requirements.txt`, checked-in `services/api/venv/` | Removed from install manifests and removed generated virtualenv artifacts from version control. Legacy Python files still import `fitz`; do not revive or ship that path unless rewritten for a permissive PDF library or covered by a commercial PyMuPDF license. |
| `ua-parser-js` v2 | `backend/package.json`, `backend/package-lock.json`, root `package-lock.json` | Removed from package manifests and lockfiles; backend device parsing now uses local lightweight parsing code. |

## Other Notable Licenses

| Component | Where Detected | License Signal |
|---|---|---|
| `axe-core` | root and app lockfiles | MPL-2.0 |
| `dompurify` | root lockfile | MPL-2.0 or Apache-2.0 |
| `node-forge` | `apps/pdf-converter/package-lock.json` | BSD-3-Clause or GPL-2.0 |
| `caniuse-lite` | lockfiles | CC-BY-4.0 |
| `harmony-reflect` | `apps/pdf-converter/package-lock.json` | Apache-2.0 or MPL-1.1 |

## Packaging Notes

- Preserve dependency license files in packaged output.
- Include this file and the root `LICENSE` in source and binary distributions.
- If Electron packaging is revived, verify the final installer or portable app contains Chromium/Electron notices and dependency licenses.
- If Docker images or bundled Python environments are published, audit the exact image contents, not only source manifests.
