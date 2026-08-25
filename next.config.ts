import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Inlined at build time (webpack/Turbopack DefinePlugin), so the deployed
  // bundle carries the moment it was built. Vercel gives us no git checkout and
  // no commit timestamp env var, and the lambda's file mtimes are fiction — this
  // is the only honest "when did this code last change" signal out there.
  env: {
    NEXT_BUILD_TIME: new Date().toISOString(),
  },
  turbopack: {
    // Pin the workspace root to this project.
    //
    // Without it, Next walks up looking for a lockfile and finds a stray 92-byte
    // package-lock.json at R:\z_jeskoserver\, so it treats that whole drive as
    // the workspace. Sixteen sibling projects and their node_modules then fall
    // inside the root Turbopack watches and resolves against, which is enough to
    // exhaust memory during a build.
    root: path.resolve(import.meta.dirname),
  },
  async redirects() {
    return [
      // The calendar moved to /cal to match the name in the sidebar. Keeps old
      // bookmarks working, and anything still pointing at the old path.
      { source: "/events", destination: "/cal", permanent: false },
    ];
  },
};

export default nextConfig;
