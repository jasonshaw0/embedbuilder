import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Baseline, Bold, Code, EyeOff, Heading1, Heading2, Heading3, Italic, List, ListOrdered, Quote, ScanText, Strikethrough, Underline } from 'lucide-react'
import { plainText, STYLE_NAMES, styleText } from './symbols'
import { normalizeSingleTildes, toggleCodeBlock, toggleLines, toggleMarkers, type FormatAction, type Keybindings, type TextSelection } from './textFormatting'

const MARKERS: Record<FormatAction, string> = { bold: '**', italic: '*', underline: '__', strike: '~~' }

type Props = { content: string; change: (content: string) => void; openSymbols: () => void; keybindings: Keybindings }

export default function TextEditor({ content, change, openSymbols, keybindings }: Props) {
  const editor = useRef<HTMLTextAreaElement>(null)
  const selection = useRef<TextSelection>({ start: 0, end: 0 })
  const pendingSelection = useRef<TextSelection | null>(null)
  const [fontOpen, setFontOpen] = useState(false)
  const [headingOpen, setHeadingOpen] = useState(false)
  const toolbar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      const target = event.target as Node
      if (!toolbar.current?.contains(target) || !(target as Element).closest?.('.toolbar-menu')) {
        setFontOpen(false)
        setHeadingOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeMenus)
    return () => document.removeEventListener('pointerdown', closeMenus)
  }, [])

  useLayoutEffect(() => {
    if (!pendingSelection.current || !editor.current) return
    const next = pendingSelection.current
    pendingSelection.current = null
    editor.current.focus()
    editor.current.setSelectionRange(next.start, next.end)
  }, [content])
  const remember = () => { if (editor.current) selection.current = { start: editor.current.selectionStart, end: editor.current.selectionEnd } }
  const apply = (next: { content: string; selection: TextSelection }) => {
    selection.current = next.selection
    pendingSelection.current = next.selection
    change(next.content)
  }
  const format = (action: FormatAction) => { remember(); apply(toggleMarkers(content, selection.current, MARKERS[action])) }
  const lines = (prefix: string) => { remember(); apply(toggleLines(content, selection.current, prefix)) }
  const heading = (level: number) => {
    remember()
    const { start, end } = selection.current
    const lineStart = content.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const lineEndIndex = content.indexOf('\n', end)
    const lineEnd = lineEndIndex < 0 ? content.length : lineEndIndex
    const original = content.slice(lineStart, lineEnd)
    const oldPrefix = original.match(/^#{1,3} /)?.[0] || ''
    const prefix = oldPrefix === `${'#'.repeat(level)} ` ? '' : `${'#'.repeat(level)} `
    const updated = prefix + original.slice(oldPrefix.length)
    const delta = prefix.length - oldPrefix.length
    apply({ content: content.slice(0, lineStart) + updated + content.slice(lineEnd), selection: { start: Math.max(lineStart, start + delta), end: Math.max(lineStart, end + delta) } })
    setHeadingOpen(false)
  }
  const font = (name: string) => {
    remember()
    const { start, end } = selection.current
    if (start === end) { editor.current?.focus(); setFontOpen(false); return }
    const styled = name === 'Normal' ? plainText(content.slice(start, end)) : styleText(plainText(content.slice(start, end)), name)
    apply({ content: content.slice(0, start) + styled + content.slice(end), selection: { start, end: start + styled.length } })
    setFontOpen(false)
  }
  const control = (label: string, icon: React.ReactNode, action: () => void, active = false) => <button type="button" title={label} aria-label={label} className={active ? 'active' : ''} onMouseDown={event => event.preventDefault()} onClick={action}>{icon}</button>

  return <div className="text-editor">
    <div ref={toolbar} className="editor-toolbar" role="toolbar" aria-label="Text formatting">
      {control('Bold', <Bold size={16}/>, () => format('bold'))}
      {control('Italic', <Italic size={16}/>, () => format('italic'))}
      {control('Underline', <Underline size={16}/>, () => format('underline'))}
      {control('Strikethrough', <Strikethrough size={16}/>, () => format('strike'))}
      <span className="toolbar-divider"/>
      <div className="toolbar-menu">
        {control('Heading size', <Heading1 size={17}/>, () => { setHeadingOpen(!headingOpen); setFontOpen(false) }, headingOpen)}
        {headingOpen && <div className="toolbar-popover heading-popover">{[1, 2, 3].map(level => <button key={level} onMouseDown={event => event.preventDefault()} onClick={() => heading(level)}>{level === 1 ? <Heading1 size={17}/> : level === 2 ? <Heading2 size={17}/> : <Heading3 size={17}/>} Heading {level}</button>)}</div>}
      </div>
      {control('Bulleted list', <List size={16}/>, () => lines('- '))}
      {control('Numbered list', <ListOrdered size={16}/>, () => lines('1. '))}
      {control('Quote', <Quote size={16}/>, () => lines('> '))}
      {control('Inline code', <Code size={16}/>, () => { remember(); apply(toggleMarkers(content, selection.current, '`')) })}
      {control('Code block', <span className="code-block-icon">{`{ }`}</span>, () => { remember(); apply(toggleCodeBlock(content, selection.current)) })}
      {control('Spoiler', <EyeOff size={16}/>, () => { remember(); apply(toggleMarkers(content, selection.current, '||')) })}
      <span className="toolbar-divider"/>
      <div className="toolbar-menu">
        {control('Font', <Baseline size={18}/>, () => { setFontOpen(!fontOpen); setHeadingOpen(false) }, fontOpen)}
        {fontOpen && <div className="toolbar-popover font-popover" role="menu" aria-label="Fonts">{['Normal', ...STYLE_NAMES].map(name => <button key={name} role="menuitem" aria-label={name} onMouseDown={event => event.preventDefault()} onClick={() => font(name)}>{name === 'Normal' ? name : styleText(name, name)}</button>)}</div>}
      </div>
      {control('Symbols', <ScanText size={16}/>, openSymbols)}
    </div>
    <textarea ref={editor} id="content-editor" aria-label="Markdown content" className="field-textarea" rows={11} value={content} onChange={event => { remember(); const next = normalizeSingleTildes(event.target.value, selection.current); if (next.content !== event.target.value) apply(next); else change(next.content) }} onSelect={remember} onKeyUp={remember} onClick={remember} onKeyDown={event => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
      const action = (Object.keys(keybindings) as FormatAction[]).find(key => keybindings[key] === event.key.toLowerCase())
      if (action) { event.preventDefault(); format(action) }
    }}/>
    <small className="field-hint">Select text to format it. Discord Markdown is used in the exported message.</small>
  </div>
}
