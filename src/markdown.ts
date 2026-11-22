import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false })
md.validateLink = url => /^(https?:|mailto:)/i.test(url)
function timestamp(unix: string, style = 'f'): string {
  const date = new Date(Number(unix) * 1000)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  if (style === 'R') {
    const delta = Math.round((date.getTime() - Date.now()) / 1000)
    const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]]
    const [unit, seconds] = units.find(([, threshold]) => Math.abs(delta) >= threshold) || units[5]
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(delta / seconds), unit)
  }
  const options: Intl.DateTimeFormatOptions = style === 't' ? { hour: 'numeric', minute: '2-digit' } : style === 'T' ? { hour: 'numeric', minute: '2-digit', second: '2-digit' } : style === 'd' ? { year: 'numeric', month: '2-digit', day: '2-digit' } : style === 'D' ? { year: 'numeric', month: 'long', day: 'numeric' } : style === 'F' ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }
  return new Intl.DateTimeFormat(undefined, options).format(date)
}
md.renderer.rules.text = (tokens, index) => md.utils.escapeHtml(tokens[index].content)
  .replace(/&lt;(a?):([a-zA-Z0-9_]+):(\d+)&gt;/g, (_, animated: string, name: string, id: string) => `<img class="discord-emoji" src="https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'webp'}" alt=":${name}:" />`)
  .replace(/&lt;t:(\d+)(?::([tTdDfFR]))?&gt;/g, (_, unix: string, style: string) => `<span class="discord-timestamp">${timestamp(unix, style)}</span>`)
  .replace(/&lt;@!?\d+&gt;/g, '<span class="discord-mention">@user</span>')
  .replace(/&lt;@&amp;\d+&gt;/g, '<span class="discord-mention">@role</span>')
  .replace(/&lt;#\d+&gt;/g, '<span class="discord-mention">#channel</span>')
  .replace(/\|\|([^|]+?)\|\|/g, '<span class="discord-spoiler" tabindex="0">$1</span>')
md.renderer.rules.strong_open = (tokens, index) => tokens[index].markup === '__' ? '<u>' : '<strong>'
md.renderer.rules.strong_close = (tokens, index) => tokens[index].markup === '__' ? '</u>' : '</strong>'

export function renderDiscordMarkdown(source: string): string {
  // Discord's subtext marker is line-oriented and does not have a MarkdownIt equivalent.
  const normalized = source.split('\n').map(line => line.startsWith('-# ') ? `<discord-subtext>${line.slice(3)}</discord-subtext>` : line).join('\n')
  const html = md.render(normalized)
  return html.replace(/&lt;discord-subtext&gt;([\s\S]*?)&lt;\/discord-subtext&gt;/g, '<small class="discord-subtext">$1</small>')
}
