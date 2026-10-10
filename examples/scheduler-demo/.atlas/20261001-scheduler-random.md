---
id: 20261001-scheduler-random
title: Scheduler places replicas on random workers
level: story
status: accepted
date: 2026-10-01
tags: [scheduler]
realizes: []
supersedes: []
---
## Decision
When a service asks for `replicas: 3`, the scheduler picks 3 workers at random and writes the placement to `mapping.yaml`.

## Why
- Gets multi-replica deploys working with the least code.
- Good enough while every worker has the same capacity.

## Alternatives rejected
- Round robin: needs shared state about the last pick, for no real gain at this size.

## Diagram
```mermaid
sequenceDiagram
  actor Dev
  Dev->>Scheduler: deploy (replicas: 3)
  Scheduler->>Scheduler: pick 3 workers at random
  Scheduler->>mapping.yaml: write placement
  Scheduler->>Workers: start 3 replicas
```
