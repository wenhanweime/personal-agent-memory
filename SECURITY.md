# Security

Personal Agent Memory is designed for local use, but it can still store sensitive material.

Rules:

- Never commit a real `~/.agent-memory` vault.
- Never commit `private/`, `events/`, or `sources/`.
- Keep complete secrets only in `private/secrets.md.enc`.
- Use redacted summaries in human-readable files.
- Run a secret scanner before publishing.

Report security issues privately to the project maintainer.
