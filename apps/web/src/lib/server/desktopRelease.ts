import "server-only";
import { DESKTOP_REPO, parseRelease, type DesktopRelease } from "@/lib/desktopRelease";

// Asked at most every half hour; GitHub's unauthenticated limit is 60 requests an hour per server.
// DESKTOP_RELEASE_API points a test copy of the site at another answer (a local file server).
const API = process.env.DESKTOP_RELEASE_API || `https://api.github.com/repos/${DESKTOP_REPO}/releases/latest`;

/** The newest published desktop release, or null (none yet, or GitHub didn't answer). */
export async function latestDesktopRelease(): Promise<DesktopRelease | null> {
  try {
    const res = await fetch(API, {
      headers: { accept: "application/vnd.github+json", "user-agent": "dovli.in" },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return parseRelease(await res.json());
  } catch {
    return null;
  }
}
