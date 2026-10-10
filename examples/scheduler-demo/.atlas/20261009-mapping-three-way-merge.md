---
id: 20261009-mapping-three-way-merge
title: Two writers update mapping.yaml with a three-way merge
level: detail
status: accepted
date: 2026-10-09
tags: [scheduler, config-sync]
realizes: [20261008-scheduler-constraints]
supersedes: []
---
## Decision
When the scheduler and an operator both change `mapping.yaml`, the writer merges its change against the last version it read (base), the version on disk (theirs) and its own (ours). Conflicts on the same key fail the write instead of overwriting.

## Why
- Last-writer-wins silently dropped a manual placement during a deploy.
- A file lock alone would serialize writes but still lose the earlier edit.

## Alternatives rejected
- Moving placement into a database: correct, but removes the hand-editable file people rely on.

## Diagram
```d2
direction: right
base: base (last read)
ours: ours (scheduler change)
theirs: theirs (on disk now)
merge: three-way merge {shape: diamond}
ok: write merged mapping.yaml
fail: refuse write, report conflicting keys
base -> merge
ours -> merge
theirs -> merge
merge -> ok: no overlapping keys
merge -> fail: same key changed twice
```
