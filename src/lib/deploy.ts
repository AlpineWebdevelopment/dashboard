import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import path from 'node:path'

export type DeployInfo = {
  /** ISO timestamp of the last code change / deploy */
  at: string
  /** Where the timestamp came from */
  source: 'commit' | 'build' | 'boot'
  /** Short commit hash, when we could read git */
  sha?: string
  /** Commit subject line, when we could read git */
  subject?: string
}

const CACHE_MS = 60_000
let cache: { info: DeployInfo; readAt: number } | null = null

// Last commit on the checked-out branch — the actual "last code edit"
function fromGit(): DeployInfo | null {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI%n%h%n%s'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const [at, sha, ...rest] = out.trim().split('\n')
    if (!at) return null
    return { at, source: 'commit', sha, subject: rest.join('\n').trim() || undefined }
  } catch {
    return null
  }
}

// No git on the box (or a copied-out build) — fall back to when the app was built
function fromBuild(): DeployInfo | null {
  try {
    const { mtime } = statSync(path.join(process.cwd(), '.next', 'BUILD_ID'))
    return { at: mtime.toISOString(), source: 'build' }
  } catch {
    return null
  }
}

/** Timestamp of the last code edit / deploy, cached for a minute. Server only. */
export function getDeployInfo(): DeployInfo {
  if (cache && Date.now() - cache.readAt < CACHE_MS) return cache.info

  const info: DeployInfo = fromGit() ??
    fromBuild() ?? {
      at: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      source: 'boot',
    }

  cache = { info, readAt: Date.now() }
  return info
}
