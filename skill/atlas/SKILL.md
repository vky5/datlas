---
name: atlas
description: Record an architecture decision (with an optional diagram) into the current repo's .atlas/ folder so it shows up in the datlas viewer. Use only when the user explicitly asks to record, save or log a design or decision ("record this", "add this to atlas").
argument-hint: [story|detail] [what to record]
---

# Record a decision in .atlas/

Only run when the user explicitly asks to record something. Never record on your own initiative.

## 1. Look before writing

- Find the repo root (nearest folder with `.git`). Decisions live in `<repo>/.atlas/`. Create the folder if missing.
- List what exists: `grep -h -E "^(id|system|tags|level|status):" <repo>/.atlas/*.md`
- **Pick the system** (required): the part of the product this decision lives in, e.g. `processors`, `scheduler`, `config`. One per decision. Reuse an existing system name exactly; at most one sub-level (`processors/build`). If no existing system fits, ask the user before creating one.
- **Tags are for cross-cutting concerns**, not for the system: things that span systems, like `config-writes` or `security`. Reuse existing tags; do not invent near-duplicates ("scheduler" vs "schedulers"). Zero or more.

## 2. Pick the level

- **story** (high level): one scenario, told as what happens. "What happens when I deploy with replicas: 3." No implementation detail: no data structures, algorithms, file formats or library names unless the user asked for them. Prefer a sequence diagram. Keep it to roughly 8 steps or boxes.
- **detail** (low level): how one part is implemented. It must name the story it realizes in `realizes:`. Stories never point down; details point up.
- If a detail contradicts its story, the story wins. Say so to the user instead of writing a contradicting detail.

## 3. Write one file

Path: `<repo>/.atlas/<id>.md` where `id` is `YYYYMMDD-short-slug` using today's date.
Get the timestamp with `date "+%Y-%m-%d %H:%M"`; the viewer numbers decisions (#1, #2, …) by it, so same-day decisions need the time.

```
---
id: YYYYMMDD-short-slug
title: One line, says what was decided
level: story            # story | detail
system: processors      # required: where this lives; reuse existing names; one optional sub-level (processors/build)
status: proposed        # proposed | accepted | rejected
date: YYYY-MM-DD HH:MM   # local time, from `date "+%Y-%m-%d %H:%M"`
tags: [concern]         # cross-cutting concerns only; may be empty
realizes: []            # detail only: story ids
supersedes: []          # ids this decision replaces
---
## Decision
One or two sentences: what we will do.

## Example
1. A concrete run through the flow, with real values (`replicas: 3`, a file name, two writers).
2. One numbered step per thing that happens, in order.
3. End with the outcome the reader should expect.

## Why
- At most three bullets, one line each.

## Alternatives rejected
- At most three bullets, one line each: the option, then why it lost.

## Diagram
(one ```d2 or ```mermaid block; leave the section out if a diagram adds nothing)
```

Rules:
- Keep it short. The written part (everything except the diagram) stays under about 150 words. Cut background, history and restating the title.
- Always include the Example section. Explain the flow with one concrete case, not general prose. A reader should understand the decision from the example alone.
- `status` is `proposed` unless the user says it is accepted or rejected.
- A design the user decided against is still worth recording: write it with `status: rejected` and the reasons.
- When a new decision replaces an old one, list the old id in `supersedes`. Never edit the old file; the viewer marks it superseded.
- Reasons come from what was actually said. Do not invent constraints or numbers. If a reason is missing, ask.
- Only write `accepted` decisions that were really decided. Do not mark anything accepted to make the record look finished.

## 4. Check

- For a D2 block: copy it to a temp file and run `d2 <tmp>.d2 <tmp>.svg`. Fix and re-run until it compiles.
- Tell the user the file path, its id and status, and that the datlas viewer shows it if the repo is under a saved folder.
