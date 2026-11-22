export type TextSelection = { start: number; end: number }

export function toggleMarkers(content: string, selection: TextSelection, marker: string): { content: string; selection: TextSelection } {
  const { start, end } = selection
  const selected = content.slice(start, end)
  const before = content.slice(0, start)
  const after = content.slice(end)
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
    return { content: before + selected.slice(marker.length, -marker.length) + after, selection: { start, end: end - marker.length * 2 } }
  }
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return { content: before.slice(0, -marker.length) + selected + after.slice(marker.length), selection: { start: start - marker.length, end: end - marker.length } }
  }
  return { content: before + marker + selected + marker + after, selection: { start: start + marker.length, end: end + marker.length } }
}

export function toggleLines(content: string, selection: TextSelection, prefix: string): { content: string; selection: TextSelection } {
  const lineStart = content.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1
  const lineEndIndex = content.indexOf('\n', selection.end)
  const lineEnd = selection.end > selection.start && content[selection.end - 1] === '\n' ? selection.end - 1 : lineEndIndex < 0 ? content.length : lineEndIndex
  const lines = content.slice(lineStart, lineEnd).split('\n')
  const remove = lines.every(line => line.startsWith(prefix))
  const result = lines.map(line => remove ? line.slice(prefix.length) : prefix + line).join('\n')
  const delta = result.length - (lineEnd - lineStart)
  return { content: content.slice(0, lineStart) + result + content.slice(lineEnd), selection: { start: selection.start + (remove ? -prefix.length : prefix.length), end: selection.end + delta } }
}

export function toggleCodeBlock(content: string, selection: TextSelection): { content: string; selection: TextSelection } {
  const { start, end } = selection
  const selected = content.slice(start, end)
  const opening = '```\n'
  const closing = '\n```'
  if (content.slice(start - opening.length, start) === opening && content.slice(end, end + closing.length) === closing) {
    return { content: content.slice(0, start - opening.length) + selected + content.slice(end + closing.length), selection: { start: start - opening.length, end: end - opening.length } }
  }
  const before = start > 0 && content[start - 1] !== '\n' ? '\n' : ''
  const after = end < content.length && content[end] !== '\n' ? '\n' : ''
  return { content: content.slice(0, start) + before + opening + selected + closing + after + content.slice(end), selection: { start: start + before.length + opening.length, end: end + before.length + opening.length } }
}

export function normalizeSingleTildes(content: string, selection: TextSelection): { content: string; selection: TextSelection } {
  const matches = [...content.matchAll(/(?<!~)~(?!~)([^~\n]+?)(?<!~)~(?!~)/g)]
  if (!matches.length) return { content, selection }
  const shift = (position: number) => matches.reduce((total, match) => total + (position > match.index! ? 1 : 0) + (position >= match.index! + match[0].length ? 1 : 0), 0)
  return {
    content: content.replace(/(?<!~)~(?!~)([^~\n]+?)(?<!~)~(?!~)/g, '~~$1~~'),
    selection: { start: selection.start + shift(selection.start), end: selection.end + shift(selection.end) },
  }
}
