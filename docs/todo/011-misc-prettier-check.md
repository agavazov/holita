# 011 Files in .misc rewritten by Prettier

**Status:** Needs owner: `.misc/` is opened only on the owner's explicit request. **Product:**
Workspace.

## Background

On the evening of 2026-11-19 a Codex run used a copied ignore file with Prettier. The copy's
root-anchored patterns stopped matching, and Prettier rewrote 26 files in `.misc/` (Git-ignored
reference projects with no backup) and 6 files in `.credentials/`. The credential files were checked
afterwards and are intact. The `.misc/` files were not checked.

## Goal

Know whether any `.misc/` file lost something that matters.

## Steps

Only after the owner asks for it:

1. List the `.misc/` files modified in that run (by modification time).
2. Prettier changes formatting only. Look closer at formats where whitespace carries meaning
   (Markdown code blocks, YAML, templates).
3. Where something matters, restore it from WebStorm Local History or from the reference project's
   original source.

## Done when

The owner has the list with a verdict for each file, and anything needed is restored.

## Limits

Touch only the files from that run.
