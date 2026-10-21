"use client";

import { useCallback, useEffect, useState } from "react";
import { clearCopies } from "./copy";

export type InstalledRepo = { owner: string; repo: string; private: boolean };
export type GitHubState =
  | { status: "loading" }
  | { status: "out" }
  | { status: "in"; login: string; installation: number; repos: InstalledRepo[] | null; error: string | null };

// Who is logged in with GitHub and which repos the App may read. Asked again when the tab regains focus,
// so coming back from GitHub's "Configure" page shows the new selection.
export function useGitHub() {
  const [state, setState] = useState<GitHubState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const me = await fetch("/api/auth/me").then((r) => r.json());
      if (!me.login) return setState({ status: "out" });
      const res = await fetch("/api/gh/repos");
      const b = await res.json().catch(() => ({}));
      if (res.status === 401) return setState({ status: "out" }); // App uninstalled; the server cleared the login
      setState({ status: "in", login: me.login, installation: me.installation, repos: res.ok ? b.repos : null, error: res.ok ? null : b.error ?? "Could not list your repos" });
    } catch {
      setState((s) => (s.status === "in" ? { ...s, error: "Could not reach the server" } : { status: "out" }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    await clearCopies();
    setState({ status: "out" });
  }, []);

  return { state, refresh, logout };
}
