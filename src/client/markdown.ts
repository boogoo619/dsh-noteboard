import MarkdownIt from 'markdown-it'
const fullRenderer = new MarkdownIt({ html: false, linkify: true, breaks: true })
const cardRenderer = new MarkdownIt({ html: false, linkify: false, breaks: true }).disable(['heading', 'image', 'link'])
fullRenderer.renderer.rules.link_open = (tokens, index, options, _env, self) => {
  tokens[index].attrSet('target', '_blank')
  tokens[index].attrSet('rel', 'noopener noreferrer')
  return self.renderToken(tokens, index, options)
}
export const escapeHtml = (s: string) => fullRenderer.utils.escapeHtml(s)
export function renderMarkdown(src: string, { full = false } = {}) {
  return (full ? fullRenderer : cardRenderer).render(String(src ?? ''))
}
