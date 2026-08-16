import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
