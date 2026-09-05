# Backup & Restore

## Authority

Production authority is **Neon PostgreSQL**. Export snapshots are backup artifacts, not live content.

## Requirements

```
DATABASE_URL=<neon connection string>
CONTENT_STORE=database
```

Admin Auth credentials are NOT required for CLI backup operations.

## Export

```bash
npm run export:content
```

Creates an immutable timestamped snapshot in `backups/smartdesk-YYYYMMDDTHHMMSSZ/`.

Includes:
- ArticleV1 metadata + Markdown bodies
- ProductV1 data
- Revision history (articles + products)
- SHA-256 integrity hashes
- manifest.json with counts and file listing

Export is **read-only** — no DB mutations, no revalidation, no Git operations.

## Snapshot Structure

```
backups/smartdesk-20260819T110500Z/
├── manifest.json
├── articles/<id>.json
├── article-bodies/<slug>.md
├── products/<id>.json
└── revisions/
    ├── articles/<id>.json
    └── products/<id>.json
```

## Validate a Snapshot

```bash
npm run validate:backup
```

Runs: export, manifest verification, hash checks, tamper detection, missing file detection, canonical validation, no-mutation check.

## Restore

```bash
# Dry run (no DB writes)
npm run restore:content -- <snapshot-path> --dry-run

# Restore into empty database
npm run restore:content -- <snapshot-path>

# Replace existing content (destructive)
npm run restore:content -- <snapshot-path> --replace
```

Restore validates the snapshot before any DB writes. If validation fails, no changes are made.

Restore is **transactional** — all-or-nothing.

## Disaster Recovery Procedure

1. Provision empty Postgres (Neon branch or new project)
2. Run DB migrations: `npm run db:migrate`
3. Set `DATABASE_URL` to new database
4. Validate snapshot: verify manifest.json exists and hashes pass
5. Restore: `npm run restore:content -- <snapshot-path>`
6. Verify parity (article/product counts, IDs, slugs)
7. Rebuild/redeploy application
8. Revalidate public site cache

## Important Notes

- Restore does NOT trigger Next.js revalidation — that's a separate deployment step
- `backups/` is gitignored by default; snapshots may contain full editorial content
- No automatic restore on app startup
- No backup on every Admin save (revision history covers per-save recovery)
- Backups are operator-triggered only
