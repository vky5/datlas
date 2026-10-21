import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

// Server-only GitHub App calls. The secrets they use come from .env.local and never reach the browser.

const API = "https://api.github.com";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in .env.local`);
  return v;
}

let key: string | null = null;
const privateKey = () => (key ??= readFileSync(env("GITHUB_PRIVATE_KEY_PATH"), "utf8"));

// Proves "I am the App". GitHub allows at most 10 minutes; backdated a minute for clock drift.
function appJwt(): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iat: now - 60, exp: now + 540, iss: env("GITHUB_APP_ID") })}`;
  return `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(privateKey(), "base64url")}`;
}

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function api<T>(path: string, token: string, method = "GET"): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new AppError(res.status, `GitHub answered ${res.status} for ${path}`);
  return res.json();
}

// Swaps the one-time code from the login redirect for a user token. Errors come back as 200 with an `error` field.
export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: env("GITHUB_CLIENT_ID"), client_secret: env("GITHUB_CLIENT_SECRET"), code, redirect_uri: redirectUri }),
    signal: AbortSignal.timeout(15000),
  });
  const b = await res.json().catch(() => ({}));
  if (!b.access_token) throw new Error(b.error_description ?? `GitHub answered ${res.status} when finishing login`);
  return b.access_token;
}

export const currentUser = (userToken: string) => api<{ id: number; login: string }>("/user", userToken);

export type Installation = { id: number; account: { id: number; login: string } };
export async function userInstallations(userToken: string): Promise<Installation[]> {
  return (await api<{ installations: Installation[] }>("/user/installations?per_page=100", userToken)).installations;
}

let slug: Promise<string> | null = null;
export function appSlug(): Promise<string> {
  slug ??= api<{ slug: string }>("/app", appJwt()).then((a) => a.slug);
  slug.catch(() => (slug = null));
  return slug;
}

// Tokens last an hour; reuse one until five minutes before it runs out. 404 means the App was uninstalled.
const tokens = new Map<number, { token: string; until: number }>();
export async function installationToken(installationId: number): Promise<string> {
  const hit = tokens.get(installationId);
  if (hit && hit.until > Date.now()) return hit.token;
  const t = await api<{ token: string; expires_at: string }>(`/app/installations/${installationId}/access_tokens`, appJwt(), "POST");
  tokens.set(installationId, { token: t.token, until: Date.parse(t.expires_at) - 5 * 60_000 });
  return t.token;
}

export const forgetToken = (installationId: number) => tokens.delete(installationId);

export type InstalledRepo = { owner: string; repo: string; private: boolean };
export async function installationRepos(token: string): Promise<InstalledRepo[]> {
  const out: InstalledRepo[] = [];
  for (let page = 1; ; page++) {
    const b = await api<{ repositories: { name: string; private: boolean; owner: { login: string } }[] }>(`/installation/repositories?per_page=100&page=${page}`, token);
    out.push(...b.repositories.map((r) => ({ owner: r.owner.login, repo: r.name, private: r.private })));
    if (b.repositories.length < 100) return out;
  }
}
