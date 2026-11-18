# Workspace contributor instructions

@AGENTS.md

@AGENTS.local.md

The delivery policy in `AGENTS.md` comes first. A task belongs to one product: read
`discocan/AGENTS.md` or `holita/AGENTS.md` as the product boundaries in `AGENTS.md` say, and read
only the documentation the task needs, starting from [docs/README.md](docs/README.md). The
optional, Git-ignored `AGENTS.local.md` adds this checkout's local instructions; a missing file is
skipped.

Keep this entry point short. Maintain shared rules in `AGENTS.md`, product rules in each product's
`AGENTS.md` and product documentation in `docs/`, so Codex and Claude use the same source of truth.
