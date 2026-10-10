---
id: 20261008-scheduler-constraints
title: Scheduler filters workers by constraints before placing
level: story
status: accepted
date: 2026-10-08
tags: [scheduler]
realizes: []
supersedes: [20261001-scheduler-random]
---
## Decision
Before placing replicas, the scheduler drops workers that fail the service's constraints (free disk, CPU, labels), then picks from the rest.

## Why
- Random placement put a database replica on a worker with 2 GB of free disk.
- Constraints are declared per service, so the rule lives next to the thing it protects.

## Alternatives rejected
- Bin packing: see the rejected decision. Too much logic for a small number of workers.

## Diagram
```d2
shape: sequence_diagram
dev: Dev
sched: Scheduler
workers: Workers
dev -> sched: deploy (replicas: 3, disk >= 20GB)
sched -> sched: drop workers that fail constraints
sched -> sched: pick 3 from the rest
sched -> workers: start 3 replicas
sched -> dev: error if fewer than 3 qualify
```
