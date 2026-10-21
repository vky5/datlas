# datlas

A viewer for architecture decisions and diagrams across your projects, from folders on your computer or from GitHub repos.

- **Decisions** are markdown files in a project's `.datlas/` folder: front matter (id, level, status, date, tags, links) plus the reasoning and one optional D2 or Mermaid diagram.
- **Diagrams** are loose `.d2` / `.mmd` files anywhere in the chosen folders (local folders only).
- **Local folders**: you choose which to read on the home page. The list is stored in this browser's localStorage under `directories`.
- **GitHub repos**: log in with GitHub and pick repos for the datlas GitHub App. Only a `.datlas/` folder at the repo root is read.

Live: https://datlas-web.vercel.app

## Run

    npm install
    npm run dev        # http://127.0.0.1:7777 (localhost only)

Both D2 and Mermaid render in the browser. D2 uses D2.js (d2 compiled to WebAssembly), so no `d2` binary is needed; its ~6 MB bundle loads the first time a D2 diagram is shown.

Try it: add `examples/scheduler-demo` as a folder, open the project, and pick a system from the overview.

Local folders work with no setup. GitHub repos need your own GitHub App, below.

## GitHub repos

### 1. Register a GitHub App

GitHub → Settings → Developer settings → GitHub Apps → New GitHub App (https://github.com/settings/apps/new).

| Field | Value |
|---|---|
| GitHub App name | Anything unique on GitHub, e.g. `datlas-<you>` |
| Homepage URL | `http://127.0.0.1:7777`, or your deployed URL |
| Callback URL | `http://127.0.0.1:7777/api/auth/callback`. Add one more per deployment: `https://<your-domain>/api/auth/callback` |
| Request user authorization (OAuth) during installation | On, so installing also logs you in |
| Webhook → Active | **Off**. datlas uses no webhooks |
| Repository permissions → Contents | Read-only |
| Repository permissions → Metadata | Read-only (required by GitHub) |
| Everything else | No access |
| Where can this GitHub App be installed? | Only on this account. Choose "Any account" only if other people should use your deployment |

Then, on the App's page:

1. Copy the **App ID** and **Client ID** (General).
2. Credentials → Client secrets → **Generate a new client secret**. It is shown once.
3. Credentials → Key pairs → **New key**. A `.pem` file downloads. Put it in `secrets/` (gitignored) and `chmod 600` it.
4. **Install App** → your account → **Only select repositories** → pick the repos with a `.datlas/` folder. You can change the selection later from datlas ("Choose repos") or GitHub → Settings → Applications.

### 2. Local settings

Create `.env.local` (gitignored):

    GITHUB_APP_ID=<App ID>
    GITHUB_CLIENT_ID=<Client ID>
    GITHUB_CLIENT_SECRET=<client secret>
    GITHUB_PRIVATE_KEY_PATH=./secrets/<app>.<date>.private-key.pem
    SESSION_SECRET=<output of: openssl rand -base64 32>

Restart `npm run dev`, open **http://127.0.0.1:7777** and click **Log in with GitHub**. Use `127.0.0.1`, not `localhost`: the callback must match the registered URL exactly, and the login cookie belongs to the address you logged in on.

### How it works

- Login keeps one signed, HttpOnly cookie for 7 days: your GitHub user id and the App installation on your own account. No GitHub token is stored. The server creates a short-lived installation token per request from the App key.
- Repo files are fetched only when they changed (one call when the latest commit is the same) and kept in this browser's IndexedDB. The server stores nothing.
- Log out deletes the browser's copy. So does losing access: login expired, App removed, or a repo deselected.
- Hitting GitHub's rate limit pauses syncing until it refills; datlas says when.

## Deploy (Vercel)

    vercel link
    printf '%s' '<App ID>'        | vercel env add GITHUB_APP_ID production
    printf '%s' '<Client ID>'     | vercel env add GITHUB_CLIENT_ID production
    printf '%s' '<client secret>' | vercel env add GITHUB_CLIENT_SECRET production
    vercel env add GITHUB_PRIVATE_KEY production < secrets/<app>.<date>.private-key.pem
    openssl rand -base64 32 | tr -d '\n' | vercel env add SESSION_SECRET production
    vercel deploy --prod

- Hosting has no key file, so the key's contents go in `GITHUB_PRIVATE_KEY`. Use a new `SESSION_SECRET` for production.
- Add `https://<your-domain>/api/auth/callback` to the App's callback URLs. Log in only on that domain; per-deployment URLs aren't registered, so GitHub rejects their callbacks.
- `.vercelignore` keeps `secrets/`, `*.pem` and `.env.local` out of the upload.
- Local folders are off in any production build: the routes that read the disk answer 404 and the folder picker is hidden. They are on only with `NEXT_PUBLIC_DATLAS_LOCAL=1`, which `.env.development` sets for `npm run dev`. So `npm run build && npm start` on your machine shows GitHub repos only.

## Recording decisions with Claude Code

Install the skill (copy to every Claude config dir you use):

    cp -r skill/datlas ~/.claude/skills/datlas

Then say "record this as a story for <feature>". The skill writes `.datlas/<id>.md` with `status: proposed`. Review it in git and change the status yourself. Push it, and a GitHub repo in datlas shows it after a sync.

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

- Local folders: reads any `.d2`, `.mmd` or `.datlas/*.md` file under your home folder that is requested; nothing outside it. No auth, so never run `npm run dev` on a non-local address.
- Local folders are scanned on every page load. Fine for hundreds of files.
- GitHub repos: only `.datlas/*.md` at the repo root, from the default branch. Loose `.d2` / `.mmd` files and decisions in subfolders are not read.
- A diagram inside a decision can't import other D2 files.
- The same repo opened locally and from GitHub shows as two projects; search marks which is which.
