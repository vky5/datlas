# datlas

A local viewer for architecture decisions and diagrams across your projects.

- **Decisions** are markdown files in a project's `.atlas/` folder: front matter (id, level, status, date, tags, links) plus the reasoning and one optional D2 or Mermaid diagram.
- **Diagrams** are loose `.d2` / `.mmd` files anywhere in the chosen folders.
- You choose which folders to read on the home page. The list is stored in this browser's localStorage under `directories`.

## Run

    npm install
    npm run dev        # http://127.0.0.1:7777 (localhost only)

Needs the `d2` binary on PATH for D2 diagrams. Mermaid renders in the browser.

Try it: add `examples/scheduler-demo` as a folder, open the project, and pick a system from the overview.

## Recording decisions with Claude Code

Install the skill (copy to every Claude config dir you use):

    cp -r skill/atlas ~/.claude/skills/atlas

Then say "record this as a story for <feature>". The skill writes `.atlas/<id>.md` with `status: proposed`. Review it in git and change the status yourself.

## Decision file

    ---
    id: 20261008-scheduler-constraints   # YYYYMMDD-slug, never changes
    title: Scheduler filters workers by constraints
    level: story                          # story (high level) | detail (implementation)
    system: scheduler                     # where it lives; one folder per system (one sub-level: scheduler/placement)
    status: accepted                      # proposed | accepted | rejected
    date: 2026-10-08 14:30                # time optional; orders decisions inside a system
    tags: [placement]                     # cross-cutting concerns; filter the tree by one tag
    realizes: []                          # detail only: the story ids it implements
    supersedes: [20261001-scheduler-random]
    ---
    ## Decision / ## Why / ## Alternatives rejected / ## Diagram (```d2 or ```mermaid)

- Details point up to stories with `realizes`. Stories never point down; the viewer computes that link.
- A replaced decision is never edited. The newer one lists it in `supersedes` and the viewer shows the old one as superseded.
- The viewer lists problems: duplicate ids, unknown ids in links, bad level/status/date, and tags that look like typos of each other.

## Limits

- Reads any `.d2`, `.mmd` or `.atlas/*.md` file under your home folder that is requested; nothing outside it.
- Scans on every page load. Fine for hundreds of files.
- No auth. Do not bind it to a non-local address.
