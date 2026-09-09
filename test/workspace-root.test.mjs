import { describe, expect, it } from 'vitest'
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, posix, resolve, win32 } from 'node:path'
import { canonicalWorkspaceRoot, fromRelKey, parseWorkspaceRoot, toRelKey, workspaceQueueKey, INVALID_ROOT_MESSAGE } from '../src/workspace-root.mjs'

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

  it('maps existing directories through realpath so identities do not fork', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nb-canonical-'))
    try {
      expect(await canonicalWorkspaceRoot(root)).toBe(realpathSync(root))
      expect(await canonicalWorkspaceRoot(root + '/')).toBe(realpathSync(root))
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  it('upgrades a root first seen before its directory existed', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'nb-upgrade-'))
    const child = join(parent, 'late-ws')
    try {
      expect(await canonicalWorkspaceRoot(child)).toBe(resolve(child))
      await mkdir(child)
      expect(await canonicalWorkspaceRoot(child)).toBe(realpathSync(child))
    } finally { await rm(parent, { recursive: true, force: true }) }
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
