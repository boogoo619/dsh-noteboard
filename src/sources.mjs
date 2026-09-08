const string = { type: 'string' }
const seq = { type: 'integer', description: '非负整数。' }
export const sourceSchema = {
  type: 'object', additionalProperties: false,
  description: '可验证的来源。会话使用 sessionId、seq 和原文 text；文件使用 path、startLine/endLine；网页使用 url。多来源时在正文逐项引用。',
  properties: {
    sessionId: string, seq: { oneOf: [seq, string], description: '非负事件序号；兼容已有便签保存的数字字符串。' }, label: string, text: string, path: string, url: string,
    startLine: { type: 'integer', description: '从 1 开始的行号。' }, endLine: { type: 'integer', description: '包含末行。' },
    fragments: { type: 'array', description: '最多 100 个来源片段。', items: { type: 'object', additionalProperties: false,
      properties: { key: string, seq, turn: seq, text: string, prefix: string, suffix: string, start: seq, end: seq },
      required: ['key', 'text', 'prefix', 'suffix', 'start', 'end'] } },
  },
}

export function validateSource(source) {
  if (source == null) return
  if (typeof source !== 'object' || Array.isArray(source)) throw new Error('source 必须是来源对象')
  for (const key of ['sessionId', 'label', 'text', 'path', 'url']) if (source[key] != null && typeof source[key] !== 'string') throw new Error(`source.${key} 必须是字符串`)
  for (const key of ['seq', 'startLine', 'endLine']) if (source[key] != null) {
    const value = source[key]
    if (!(typeof value === 'number' || key === 'seq' && typeof value === 'string' && /^\d+$/.test(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < (key === 'seq' ? 0 : 1)) throw new Error(`source.${key} 无效`)
  }
  if (source.startLine != null && source.endLine != null && Number(source.startLine) > Number(source.endLine)) throw new Error('来源行号范围无效')
  if (source.url != null) {
    let url
    try { url = new URL(source.url) } catch { throw new Error('来源 URL 无效') }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('来源 URL 仅支持 HTTP/HTTPS')
  }
  if (source.fragments != null) {
    if (!Array.isArray(source.fragments) || source.fragments.length > 100) throw new Error('来源片段最多 100 个')
    for (const f of source.fragments) {
      if (!f || typeof f.key !== 'string' || typeof f.text !== 'string' || typeof f.prefix !== 'string' || typeof f.suffix !== 'string' || !Number.isSafeInteger(f.start) || !Number.isSafeInteger(f.end) || f.start < 0 || f.end < f.start) throw new Error('来源片段无效')
      for (const key of ['seq', 'turn']) if (f[key] != null && (!Number.isSafeInteger(f[key]) || f[key] < 0)) throw new Error(`来源片段 ${key} 无效`)
    }
  }
}
