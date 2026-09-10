import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, posix, win32 } from 'node:path'
import { canonicalWorkspaceRoot, fromRelKey, parseWorkspaceRoot, toRelKey, workspaceQueueKey, INVALID_ROOT_MESSAGE } from '../src/workspace-root.mjs'

const isWindows = process.platform === 'win32'

/**
 * `tmpdir()` on the Windows runner hands back an 8.3 short name
 * (`C:\Users\RUNNER~1\...`). Resolving it once gives these tests a parent whose
 * spelling no alias can change, so an identity that moves mid-test can only be
 * the code's doing.
 */
const realTmp = () => realpath(tmpdir())

describe('parseWorkspaceRoot', () => {
  it('accepts every absolute form the win32 convention understands', () => {
    expect(parseWorkspaceRoot('C:\\Users\\test\\项目', win32)).toBe('C:\\Users\\test\\项目')
    expect(parseWorkspaceRoot('C:\\a b\\项目 空格', win32)).toBe('C:\\a b\\项目 空格')
    expect(parseWorkspaceRoot('C:/Users/test', win32)).toBe('C:/Users/test')
    expect(parseWorkspaceRoot('\\\\server\\share\\ws', win32)).toBe('\\\\server\\share\\ws')
    expect(parseWorkspaceRoot('/', win32)).toBe('/')
  })

  it('accepts posix absolute roots and keeps the message for the rest', () => {
    expect(parseWorkspaceRoot('/Users/x/ws', posix)).toBe('/Users/x/ws')
    expect(parseWorkspaceRoot('/Users/x/my ws', posix)).toBe('/Users/x/my ws')
    const invalid = ['', undefined, null, 42, 'ws\\x', 'ws/x', './ws', 'C:\\x']
    for (const value of invalid) expect(() => parseWorkspaceRoot(value, posix)).toThrow(INVALID_ROOT_MESSAGE)
    expect(() => parseWorkspaceRoot('ws\\x', win32)).toThrow(INVALID_ROOT_MESSAGE)
  })
})

describe('workspaceQueueKey', () => {
  it('lower-cases only the win32 drive letter', () => {
    expect(workspaceQueueKey('C:\\Users\\X\\ws', win32)).toBe('c:\\Users\\X\\ws')
    expect(workspaceQueueKey('c:/a b/ws', win32)).toBe('c:\\a b\\ws')
    expect(workspaceQueueKey('\\\\Server\\share\\ws', win32)).toBe('\\\\Server\\share\\ws')
    expect(workspaceQueueKey('/Users/X/ws', posix)).toBe('/Users/X/ws')
  })

  it('gives one identity to case variants of the same drive', () => {
    expect(workspaceQueueKey('C:\\ws', win32)).toBe(workspaceQueueKey('c:\\ws', win32))
  })
})

describe('canonicalWorkspaceRoot', () => {
  it('lower-cases the drive letter of not-yet-existing win32 roots', async () => {
    const root = await canonicalWorkspaceRoot('C:\\definitely-not-real-ws\\项目', win32)
    expect(root).toBe('c:\\definitely-not-real-ws\\项目')
  })

  /**
   * The canonical form is `resolve` + lower-cased drive letter, mapped through
   * `realpath` when the directory exists — so the drive rule belongs to both
   * branches, not only the fallback. An injected realpath is the only way to
   * exercise the second branch on a host that has no drive letters at all.
   */
  it('applies the drive-letter rule to the realpath result too', async () => {
    const resolved = async () => 'C:\\Users\\runneradmin\\ws'
    expect(await canonicalWorkspaceRoot('C:\\injected-drive-probe-a', win32, resolved)).toBe('c:\\Users\\runneradmin\\ws')
  })

  it('leaves UNC server-name casing alone in the realpath branch', async () => {
    const resolved = async () => '\\\\Server\\Share\\ws'
    expect(await canonicalWorkspaceRoot('\\\\Server\\Share\\injected-unc-probe-b', win32, resolved)).toBe('\\\\Server\\Share\\ws')
  })

  it('gives one identity to every spelling of the same directory', async () => {
    const root = await mkdtemp(join(await realTmp(), 'nb-canonical-'))
    try {
      const identity = await canonicalWorkspaceRoot(root)
      const variants = [root + '/', join(root, 'sub', '..')]
      if (isWindows) variants.push(root.replace(/^[A-Za-z]:/, (d) => d.toLowerCase()), root.replace(/^[A-Za-z]:/, (d) => d.toUpperCase()))
      for (const variant of variants) expect(await canonicalWorkspaceRoot(variant)).toBe(identity)
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  it('resolves to the directory it was handed', async () => {
    const root = await mkdtemp(join(await realTmp(), 'nb-target-'))
    try {
      expect(await realpath(await canonicalWorkspaceRoot(root))).toBe(await realpath(root))
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  /**
   * The promise the README makes: one workspace keeps exactly one write queue
   * and one operation journal. That holds only while the identity is a fixed
   * point of the queue key — stable under being canonicalized again.
   */
  it('is a fixed point of the queue key', async () => {
    const root = await mkdtemp(join(await realTmp(), 'nb-fixed-'))
    try {
      const identity = await canonicalWorkspaceRoot(root)
      expect(workspaceQueueKey(identity)).toBe(identity)
      expect(await canonicalWorkspaceRoot(identity)).toBe(identity)
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  it('keeps one identity across the creation of the directory', async () => {
    const parent = await mkdtemp(join(await realTmp(), 'nb-upgrade-'))
    const child = join(parent, 'late-ws')
    try {
      const before = await canonicalWorkspaceRoot(child)
      expect(before).toBe(workspaceQueueKey(child))
      await mkdir(child)
      const after = await canonicalWorkspaceRoot(child)
      expect(after).toBe(before)
      expect(workspaceQueueKey(after)).toBe(after)
    } finally { await rm(parent, { recursive: true, force: true }) }
  })

  it.skipIf(isWindows)('gives one identity to a directory and a symlink to it', async () => {
    const parent = await mkdtemp(join(await realTmp(), 'nb-link-'))
    const dir = join(parent, 'ws'), link = join(parent, 'ws-link')
    try {
      await mkdir(dir)
      await symlink(dir, link, 'dir')
      expect(await canonicalWorkspaceRoot(link)).toBe(await canonicalWorkspaceRoot(dir))
    } finally { await rm(parent, { recursive: true, force: true }) }
  })

  /**
   * The end-to-end control for that rule on the platform where it is
   * observable: the Windows runner's own temp root must canonicalize to a
   * lower-case drive, whichever branch produced the identity.
   */
  it.runIf(isWindows)('lower-cases the drive letter of a real Windows directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nb-drive-'))
    try {
      expect(await canonicalWorkspaceRoot(root)).toMatch(/^[a-z]:[\\/]/)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})

describe('relative keys', () => {
  it('round-trips through forward-slash keys on win32', () => {
    const root = 'c:\\ws', abs = 'c:\\ws\\.noteboard\\notes\\日记-9592.md'
    const key = toRelKey(root, abs, win32)
    expect(key).toBe('.noteboard/notes/日记-9592.md')
    expect(fromRelKey(root, key, win32)).toBe(abs)
  })

  it('keeps spaces intact across the round trip on win32', () => {
    const root = 'c:\\my ws', abs = 'c:\\my ws\\.noteboard\\notes\\my note-9592.md'
    const key = toRelKey(root, abs, win32)
    expect(key).toBe('.noteboard/notes/my note-9592.md')
    expect(fromRelKey(root, key, win32)).toBe(abs)
  })

  it('round-trips through forward-slash keys on posix', () => {
    const root = '/ws', abs = '/ws/.noteboard/canvases/Main.canvas'
    const key = toRelKey(root, abs, posix)
    expect(key).toBe('.noteboard/canvases/Main.canvas')
    expect(fromRelKey(root, key, posix)).toBe(abs)
  })

  it('tolerates legacy backslash keys', () => {
    expect(fromRelKey('c:\\ws', '.noteboard\\notes\\a.md', win32)).toBe('c:\\ws\\.noteboard\\notes\\a.md')
  })

  it('rejects keys outside the .noteboard envelope or carrying traversal', () => {
    const invalid = ['.noteboard/history/2026.json', '.noteboard', '.noteboard//a.md', 'notes/a.md', '..\\escape.md', '../escape', 'C:\\evil.md', '']
    for (const key of invalid) expect(() => fromRelKey('c:\\ws', key, win32)).toThrow('操作路径无效')
    expect(() => fromRelKey('c:\\ws', null, win32)).toThrow('操作路径无效')
  })

  it('refuses to key files on another drive', () => {
    expect(() => toRelKey('c:\\ws', 'd:\\outside\\x.md', win32)).toThrow('操作路径无效')
    expect(() => toRelKey('/ws', '/etc/passwd', posix)).toThrow('操作路径无效')
  })
})
