/**
 * The single module allowed to reason about path FORM (absolute-ness,
 * separators, casing) and about the shape of workspace-relative journal
 * keys. Every other module receives an already-canonical workspace root and
 * touches disk only through `path` library calls.
 *
 * Windows roots arrive as `C:\ws`, `C:/ws` or `\\server\share\ws`; macOS and
 * Linux as `/ws`. The server performs the actual filesystem calls, so the
 * RUNTIME `path` namespace decides what "absolute" means — never string
 * prefixes like `startsWith('/')`, which reject every Windows root.
 */
import { realpath } from 'node:fs/promises'
import * as nodePath from 'node:path'

export const INVALID_ROOT_MESSAGE = '缺少工作区 root'
const INVALID_REL_KEY_MESSAGE = '操作路径无效'

/**
 * Validate a workspace root string without touching the disk. Accepts any
 * absolute path the target platform understands; optional `pathImpl`
 * (`path.win32` / `path.posix`) lets tests exercise either convention on any
 * host. Returns the input unchanged — canonicalization is asynchronous and
 * lives in {@link canonicalWorkspaceRoot}.
 */
export function parseWorkspaceRoot(input, pathImpl = nodePath) {
  if (typeof input !== 'string' || !input || !pathImpl.isAbsolute(input)) throw new Error(INVALID_ROOT_MESSAGE)
  return input
}

/**
 * Sync workspace identity: absolute, resolved, Windows drive letter
 * lower-cased (derived from `path.parse`, never a hand-written drive
 * regex). Drives the write-queue key in persistence and forms the realpath
 * fallback inside {@link canonicalWorkspaceRoot}.
 */
export function workspaceQueueKey(root, pathImpl = nodePath) {
  const base = pathImpl.resolve(root)
  const parsed = pathImpl.parse(base)
  return parsed.root.length >= 2 && parsed.root[1] === ':'
    ? parsed.root.slice(0, 2).toLowerCase() + base.slice(2)
    : base
}

const canonicalCache = new Map()
const CANONICAL_CACHE_LIMIT = 64

/**
 * Canonical workspace identity: the {@link workspaceQueueKey} form mapped
 * through `realpath` when the directory exists (removes symlink and
 * drive-letter case variants so one workspace keeps one write queue and one
 * operation journal). The drive-letter rule belongs to BOTH branches — the
 * value `realpath` returns is normalized exactly like the fallback, so the
 * identity is always a fixed point of {@link workspaceQueueKey} and cannot
 * depend on how the caller spelled the drive.
 *
 * Only realpath results are cached — the fallback is recomputed per call, so a
 * root first requested before its directory existed upgrades on the next call
 * instead of keeping an unresolved identity forever.
 *
 * Boundary: aliases only `realpath` can see (symlink targets, Windows 8.3
 * short names) are therefore resolved only once the directory exists — the
 * identity of a not-yet-existing root may upgrade when it is first created.
 * Callers must not cache an identity across that moment.
 *
 * `realpathImpl` is injectable for the same reason `pathImpl` is: it lets a
 * test drive the realpath branch on a host whose own filesystem can never
 * produce that shape (a Windows drive letter on macOS, say).
 */
export async function canonicalWorkspaceRoot(input, pathImpl = nodePath, realpathImpl = realpath) {
  const value = parseWorkspaceRoot(input, pathImpl)
  const cached = canonicalCache.get(value)
  if (cached) return cached
  const fallback = workspaceQueueKey(value, pathImpl)
  try {
    const identity = workspaceQueueKey(await realpathImpl(fallback), pathImpl)
    if (canonicalCache.size >= CANONICAL_CACHE_LIMIT) canonicalCache.delete(canonicalCache.keys().next().value)
    canonicalCache.set(value, identity)
    return identity
  } catch { return fallback }
}

/**
 * Journal identity of a file inside the workspace: workspace-relative with
 * forward slashes on every platform, so history records written on Windows
 * stay readable everywhere and prefix checks stay exact.
 */
export function toRelKey(root, absPath, pathImpl = nodePath) {
  const key = pathImpl.relative(root, absPath).split(pathImpl.sep).join('/')
  if (!key || key === '..' || key.startsWith('../') || pathImpl.isAbsolute(key)) throw new Error(INVALID_REL_KEY_MESSAGE)
  return key
}

/**
 * Inverse of {@link toRelKey}: parses a journal key back to a disk path
 * under `root`, rejecting anything outside the `.noteboard/` envelope
 * (history journals included) or carrying traversal segments. Tolerates
 * backslash keys for robustness; newly written keys are always slash-form.
 */
export function fromRelKey(root, key, pathImpl = nodePath) {
  if (typeof key !== 'string') throw new Error(INVALID_REL_KEY_MESSAGE)
  const segments = key.split('\\').join('/').split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) throw new Error(INVALID_REL_KEY_MESSAGE)
  if (segments[0] !== '.noteboard' || segments.length < 2 || segments[1] === 'history') throw new Error(INVALID_REL_KEY_MESSAGE)
  return pathImpl.join(root, ...segments)
}
