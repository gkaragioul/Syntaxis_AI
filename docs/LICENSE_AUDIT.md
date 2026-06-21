# License Audit - SyntaxisAI

**Verdict:** Acceptable as an archived MIT source release after cleanup. Re-audit before distributing binaries, Docker images, hosted services, or any revived Python extraction workflow.
**Intended license:** MIT for original SyntaxisAI source code.
**Detected license before updates:** Inconsistent. README claimed MIT, but no root `LICENSE` file was present.
**Audit date:** 2026-05-09; cleanup update 2026-06-22.

This audit follows `H:\DevWork\Files\DOCS\License-Policy-Audit-Checklist.md`. It is a practical engineering audit, not legal advice.

## Findings

### HIGH

1. **Missing authoritative MIT license** - `README.md:162` previously claimed MIT but the repository had no root `LICENSE` file. Add the full MIT license text at repository root. Fixed by adding `LICENSE`.
2. **AGPL Python PDF dependency** - `services/api/requirements.txt` previously listed `PyMuPDF==1.23.21`, and installed metadata in the checked-in virtualenv identified GNU Affero GPL 3.0 licensing. Fixed for install manifests by removing PyMuPDF from `services/api/requirements.txt`, removing the duplicate worker Dockerfile install path, and removing the checked-in virtualenv. Remaining caveat: legacy Python extraction files still import `fitz`; do not revive or ship that path unless it is rewritten for a permissive PDF library or covered by a commercial PyMuPDF license.
3. **AGPL backend dependency** - `backend/package.json` previously listed `ua-parser-js`, and `backend/package-lock.json` recorded `ua-parser-js` v2 as AGPL-3.0-or-later. Fixed by removing `ua-parser-js` and `@types/ua-parser-js`, regenerating lockfiles, and replacing usage with local lightweight user-agent parsing.
4. **Checked-in virtualenv contains third-party binaries** - `git ls-files services/api/venv` previously reported 7,371 tracked files. Fixed by removing `services/api/venv/` from version control. `.gitignore` already excludes virtualenv paths.

### MEDIUM

1. **Package manifests lacked license fields** - `package.json`, `frontend/package.json`, and `backend/package.json` had no `"license"` field. Add `"license": "MIT"` to match the intended source license. Fixed.
2. **Electron packaging excluded dependency license files** - `frontend/package.json:95` excluded `LICENSE` files under `node_modules` from packaged output. Preserve license files in any revived binary distribution. Fixed by removing the license-file exclusion pattern.
3. **Third-party notices were absent** - No root third-party notice file existed. Add a notice file listing high-risk and notable licenses. Fixed by adding `THIRD_PARTY_NOTICES.md`.
4. **README overstated product readiness** - The public README described an active SaaS platform even though the project is cancelled. Update it to describe archived status and reuse constraints. Fixed.

### LOW

1. **Historical docs still describe active product plans** - `docs/` contains old development, desktop, and production-readiness documents. Leave as historical material or add archive banners if those pages will be published.
2. **Ignored local `.env` files exist** - Local ignored env files include development secrets/placeholders. They are not tracked, but should not be published manually.

## Action Plan

1. Keep the root `LICENSE` and README license wording together.
2. Do not publish binaries until dependency notices are included in the final artifact.
3. Rewrite or commercially license the legacy `fitz`/PyMuPDF-based Python extraction code before using that service in a product.
4. Re-run dependency license scanning after any dependency changes.
5. For binary or Electron distribution, preserve dependency license files and notices, especially for LGPL/MPL/mixed-license packages.

## References

- GitHub Docs: licensing a repository - https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository
- GitHub Choose a License: MIT License - https://choosealicense.com/licenses/mit/
