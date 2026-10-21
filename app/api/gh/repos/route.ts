import { installationRepos } from "@/lib/githubApp";
import { withInstallation } from "@/lib/installation";

// The repos the logged-in user's installation can read.
export async function GET(request: Request) {
  return withInstallation(request, async (token) => ({ repos: await installationRepos(token) }));
}
