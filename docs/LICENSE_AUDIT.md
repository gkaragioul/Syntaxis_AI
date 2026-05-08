# License Audit - SyntaxisAI

**Verdict:** NEEDS FIXES for distribution; acceptable as an archived source release after the README and root MIT license updates.
**Intended license:** MIT for original SyntaxisAI source code.
**Detected license before updates:** Inconsistent. README claimed MIT, but no root `LICENSE` file was present.
**Audit date:** 2026-05-09

This audit follows `H:\DevWork\Files\DOCS\License-Policy-Audit-Checklist.md`. It is a practical engineering audit, not legal advice.

## Findings

### HIGH

1. **Missing authoritative MIT license** - `README.md:162` previously claimed MIT but the repository had no root `LICENSE` file. Add the full MIT license text at repository root. Fixed by adding `LICENSE`.
2. **AGPL Python PDF dependency** - `services/api/requirements.txt:11` lists `PyMuPDF==1.23.21`, and installed metadata in `services/api/venv/lib/python3.9/site-packages/PyMuPDF-1.23.21.dist-info/METADATA:8` states GNU Affero GPL 3.0. Review AGPL obligations before distribution or network use; replace it or obtain a commercial license if the intended distribution model is incompatible.
3. **AGPL backend dependency** - `backend/package.json:71` lists `ua-parser-js`, and `backend/package-lock.json` records `ua-parser-js` v2 as AGPL-3.0-or-later. Review compatibility with an MIT-only distribution or replace/pin to a suitable alternative.
4. **Checked-in virtualenv contains third-party binaries** - `git ls-files services/api/venv` reports 7,371 tracked files. Remove generated virtualenv artifacts from the repository before treating this as a clean source release.

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
3. Remove `services/api/venv/` from version control before a clean public release.
4. Decide whether to replace or commercially license AGPL components (`PyMuPDF`, `ua-parser-js` v2) before distributing derivative builds.
5. Re-run dependency license scanning after any dependency changes.

## References

- GitHub Docs: licensing a repository - https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository
- GitHub Choose a License: MIT License - https://choosealicense.com/licenses/mit/
