import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false })
md.validateLink = url => /^(https?:|mailto:)/i.test(url)
md.inline.ruler.before('emphasis', 'discord_spoiler', (state, silent) => {
  if (state.src.slice(state.pos, state.pos + 2) !== '||') return false
  const end = state.src.indexOf('||', state.pos + 2)
  if (end < 0) return false
  if (!silent) {
    const open = state.push('spoiler_open', 'span', 1); open.attrSet('class', 'discord-spoiler')
    const content = state.push('text', '', 0); content.content = state.src.slice(state.pos + 2, end)
    state.push('spoiler_close', 'span', -1)
  }
  state.pos = end + 2
  return true
})
md.renderer.rules.spoiler_open = () => '<span class="discord-spoiler" tabindex="0">'
md.renderer.rules.spoiler_close = () => '</span>'

export function renderDiscordMarkdown(source: string): string {
  // Discord's subtext marker is line-oriented and does not have a MarkdownIt equivalent.
  const normalized = source.split('\n').map(line => line.startsWith('-# ') ? `<discord-subtext>${line.slice(3)}</discord-subtext>` : line).join('\n')
  const html = md.render(normalized)
  return html.replace(/&lt;discord-subtext&gt;([\s\S]*?)&lt;\/discord-subtext&gt;/g, '<small class="discord-subtext">$1</small>')
}
