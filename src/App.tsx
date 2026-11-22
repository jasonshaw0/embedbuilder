import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, Check, CircleHelp, Clipboard, Code2, Download, FileInput, GripVertical, Monitor, Moon, PanelLeftClose, Plus, ScanText, Search, Smartphone, Sun, X } from 'lucide-react'
import Inspector from './Inspector'
import Preview from './Preview'
import { TOP_LEVEL, TYPE_NAMES, allowedChildren, containsNode, findNode, fromPayload, insertNode, makeNode, removeNode, toPayload, updateNode, walk, type Asset, type Media, type Node, type NodeType, type Project } from './model'
import { downloadBlob, exportBundle, importBundle, loadAssets, loadDraft, parseProject, safeFilename, saveAsset, saveDraft } from './storage'
import { STYLE_NAMES, SYMBOLS, styleText } from './symbols'
import { usedAssets, validateProject } from './validation'

type MobilePane = 'canvas' | 'library'

function parentInfo(nodes: Node[], id: string, parent?: Node): { parent?: Node; index: number } | undefined {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].uid === id) return { parent, index: i }
    const inner = parentInfo(nodes[i].components || [], id, nodes[i])
    if (inner) return inner
    if (nodes[i].accessory?.uid === id) return { parent: nodes[i], index: -1 }
  }
}

function TreeItem({ node, depth, selectedId, select, onMove, onDropNode, issues }: { node: Node; depth: number; selectedId?: string; select: (id: string) => void; onMove: (id: string, direction: -1 | 1) => void; onDropNode: (dragged: string, target: string) => void; issues: Set<string> }) {
  return <>
    <div className={`tree-item ${selectedId === node.uid ? 'active' : ''}`} style={{ paddingLeft: 11 + depth * 17 }} role="button" tabIndex={0} aria-label={`${TYPE_NAMES[node.type]} component; Alt and arrow keys reorder`} draggable onDragStart={event => { event.dataTransfer.setData('text/plain', node.uid); event.dataTransfer.effectAllowed = 'move' }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); event.stopPropagation(); onDropNode(event.dataTransfer.getData('text/plain'), node.uid) }} onClick={() => select(node.uid)} onKeyDown={event => { if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) { event.preventDefault(); onMove(node.uid, event.key === 'ArrowUp' ? -1 : 1) } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(node.uid) } }}>
      <GripVertical className="tree-grip" size={14}/><span className={`tree-type-dot type-${node.type}`}/><span className="tree-name">{TYPE_NAMES[node.type]}</span>{issues.has(node.uid) && <AlertCircle className="tree-error" size={14}/>}<span className="tree-actions"><button title="Move up" onClick={event => { event.stopPropagation(); onMove(node.uid, -1) }}><ArrowUp size={13}/></button><button title="Move down" onClick={event => { event.stopPropagation(); onMove(node.uid, 1) }}><ArrowDown size={13}/></button></span>
    </div>
    {node.components?.map(child => <TreeItem key={child.uid} node={child} depth={depth + 1} selectedId={selectedId} select={select} onMove={onMove} onDropNode={onDropNode} issues={issues}/>)}
    {node.accessory && <TreeItem node={node.accessory} depth={depth + 1} selectedId={selectedId} select={select} onMove={onMove} onDropNode={onDropNode} issues={issues}/>}
  </>
}

const PALETTE: { group: string; types: NodeType[] }[] = [
  { group: 'LAYOUT', types: [17, 9, 14, 1] },
  { group: 'CONTENT', types: [10, 12, 11, 13] },
  { group: 'INTERACTIVE', types: [2, 3, 5, 6, 7, 8] },
]
const TYPE_DESCRIPTIONS: Partial<Record<NodeType, string>> = {
  17: 'Group content with an accent', 9: 'Text with an accessory', 14: 'Space or divider', 1: 'Buttons or a select', 10: 'Discord markdown', 12: 'Images in a grid', 11: 'Section image', 13: 'Download attachment', 2: 'Interactive or link', 3: 'Defined choices', 5: 'Pick users', 6: 'Pick roles', 7: 'Users and roles', 8: 'Pick channels',
}

function createAssetName(file: File, assets: Asset[]): string {
  const used = new Set(assets.map(asset => asset.name))
  if (!used.has(file.name)) return file.name
  const dot = file.name.lastIndexOf('.')
  const base = dot < 0 ? file.name : file.name.slice(0, dot)
  const ext = dot < 0 ? '' : file.name.slice(dot)
  let i = 2
  while (used.has(`${base}-${i}${ext}`)) i++
  return `${base}-${i}${ext}`
}

export default function App() {
  const [project, setProject] = useState<Project>({ version: 1, name: 'Untitled message', components: [] })
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState<string>()
  const [addOpen, setAddOpen] = useState(false)
  const [symbolOpen, setSymbolOpen] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [symbolCategory, setSymbolCategory] = useState('Separators')
  const [symbolQuery, setSymbolQuery] = useState('')
  const [favorites, setFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('studio-favorites') || '[]') } catch { return [] } })
  const [recent, setRecent] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('studio-recent') || '[]') } catch { return [] } })
  const [styleInput, setStyleInput] = useState('Component Studio')
  const [styleName, setStyleName] = useState(STYLE_NAMES[0])
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [mobilePane, setMobilePane] = useState<MobilePane>('canvas')
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [toast, setToast] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const history = useRef<Project[]>([])
  const future = useRef<Project[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let live = true
    Promise.all([loadDraft(), loadAssets()]).then(([draft, storedAssets]) => {
      if (!live) return
      if (draft?.version === 1) setProject(draft)
      setAssets(storedAssets)
      setHydrated(true)
    }).catch(() => { if (live) { setHydrated(true); setToast('Browser storage is unavailable; drafts will not persist.') } })
    return () => { live = false }
  }, [])
  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => saveDraft(project).catch(() => setToast('Could not save this draft.')), 450)
    return () => clearTimeout(timer)
  }, [project, hydrated])
  useEffect(() => {
    const urls: Record<string, string> = {}
    assets.forEach(asset => { urls[asset.id] = URL.createObjectURL(asset.blob) })
    setAssetUrls(urls)
    return () => Object.values(urls).forEach(URL.revokeObjectURL)
  }, [assets])
  useEffect(() => { localStorage.setItem('studio-favorites', JSON.stringify(favorites)) }, [favorites])
  useEffect(() => { localStorage.setItem('studio-recent', JSON.stringify(recent)) }, [recent])
  useEffect(() => { if (toast) { const id = setTimeout(() => setToast(''), 3600); return () => clearTimeout(id) } }, [toast])

  const issues = useMemo(() => validateProject(project, assets), [project, assets])
  const errors = issues.filter(issue => issue.level === 'error')
  const issueIds = new Set(errors.map(issue => issue.uid).filter((id): id is string => !!id))
  const selected = selectedId ? findNode(project.components, selectedId) : undefined
  const json = useMemo(() => JSON.stringify(toPayload(project), null, 2), [project])

  const commit = (next: Project) => {
    history.current.push(project)
    if (history.current.length > 80) history.current.shift()
    future.current = []
    setProject(next)
  }
  const updateSelected = (node: Node) => commit({ ...project, components: updateNode(project.components, node.uid, () => node) })
  const undo = () => { const previous = history.current.pop(); if (previous) { future.current.push(project); setProject(previous) } }
  const redo = () => { const next = future.current.pop(); if (next) { history.current.push(project); setProject(next) } }
  const notify = (message: string) => setToast(message)
  const select = (id: string) => { setSelectedId(id); setSymbolOpen(false); if (window.innerWidth < 900) setMobilePane('library') }

  const addNode = (type: NodeType, forcedParentId?: string) => {
    let node = makeNode(type)
    const target = forcedParentId ? findNode(project.components, forcedParentId) : selected
    let parentId: string | undefined
    let index: number | undefined
    if (target && allowedChildren(target).includes(type)) {
      parentId = target.uid
    } else if (selected) {
      const info = parentInfo(project.components, selected.uid)
      if (info && info.index >= 0 && allowedChildren(info.parent).includes(type)) { parentId = info.parent?.uid; index = info.index + 1 }
    }
    if (!parentId && index === undefined && !TOP_LEVEL.includes(type)) {
      if (type === 11) { const wrapper = makeNode(9); wrapper.accessory = node; node = wrapper }
      else { const wrapper = makeNode(1); wrapper.components = [node]; node = wrapper }
    }
    if (parentId && type === 2 && target?.type === 1 && (target.components?.length || 0) >= 5) { notify('An action row allows five buttons.'); return }
    const next = insertNode(project.components, parentId, node, index)
    commit({ ...project, components: next })
    setSelectedId(type === node.type ? node.uid : node.components?.[0]?.uid || node.accessory?.uid)
    setAddOpen(false)
    if (window.innerWidth < 900) setMobilePane('library')
  }
  const deleteSelected = () => {
    if (!selected) return
    const info = parentInfo(project.components, selected.uid)
    if (info?.index === -1 && info.parent?.type === 9) { notify('Change the section accessory type instead of removing it.'); return }
    commit({ ...project, components: removeNode(project.components, selected.uid) })
    setSelectedId(info?.parent?.uid)
  }
  const moveNode = (id: string, direction: -1 | 1) => {
    const info = parentInfo(project.components, id)
    if (!info || info.index < 0) return
    const siblings = info.parent?.components || project.components
    const nextIndex = info.index + direction
    if (nextIndex < 0 || nextIndex >= siblings.length) return
    const copy = [...siblings]; [copy[info.index], copy[nextIndex]] = [copy[nextIndex], copy[info.index]]
    const components = info.parent ? updateNode(project.components, info.parent.uid, parent => ({ ...parent, components: copy })) : copy
    commit({ ...project, components })
  }
  const dropNode = (draggedId: string, targetId: string) => {
    if (!draggedId || draggedId === targetId) return
    const dragged = findNode(project.components, draggedId)
    const target = findNode(project.components, targetId)
    const info = parentInfo(project.components, targetId)
    if (!dragged || !target || !info || info.index < 0 || containsNode(dragged, targetId) || !allowedChildren(info.parent).includes(dragged.type)) return
    const original = parentInfo(project.components, draggedId)
    const index = original && original.parent?.uid === info.parent?.uid && original.index < info.index ? info.index - 1 : info.index
    const components = insertNode(removeNode(project.components, draggedId), info.parent?.uid, dragged, index)
    commit({ ...project, components })
  }
  const attach = async (file: File): Promise<Media> => {
    const name = createAssetName(file, assets)
    const asset: Asset = { id: crypto.randomUUID(), name, type: file.type, blob: file }
    await saveAsset(asset)
    setAssets(current => [...current, asset])
    return { url: name, assetId: asset.id }
  }
  const insertText = (text: string) => {
    if (!selected || selected.type !== 10) { notify('Select a text display to insert characters.'); return }
    const field = document.getElementById('content-editor') as HTMLTextAreaElement | null
    const start = field?.selectionStart ?? (selected.content || '').length
    const end = field?.selectionEnd ?? start
    const content = selected.content || ''
    updateSelected({ ...selected, content: content.slice(0, start) + text + content.slice(end) })
    setRecent(current => [text, ...current.filter(value => value !== text)].slice(0, 30))
    requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(start + text.length, start + text.length) })
  }
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); notify('Copied to clipboard.') } catch { notify('Clipboard is unavailable in this browser.') } }
  const downloadText = (text: string, extension: string) => downloadBlob(new Blob([text], { type: 'text/plain' }), `${safeFilename(project.name)}.${extension}`)
  const downloadProject = async () => { try { downloadBlob(await exportBundle(project, usedAssets(project, assets)), `${safeFilename(project.name)}.studio.zip`); notify('Project bundle downloaded.') } catch (error) { notify(error instanceof Error ? error.message : 'Could not create the bundle.') } }
  const importFile = async (file: File) => {
    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        const imported = await importBundle(file)
        for (const asset of imported.assets) await saveAsset(asset)
        setAssets(current => [...current.filter(asset => !imported.assets.some(item => item.id === asset.id)), ...imported.assets])
        commit(imported.project)
        setSelectedId(undefined); setJsonOpen(false); notify('Project imported.')
      } else {
        setJsonText(await file.text())
        notify('JSON loaded into the editor. Apply it to update the canvas.')
      }
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not import the file.') }
  }
  const applyJson = () => { try { const incoming = JSON.parse(jsonText); commit(incoming.version === 1 ? parseProject(incoming) : parseProject(fromPayload(incoming))); setSelectedId(undefined); setJsonOpen(false); notify('JSON applied.') } catch (error) { notify(error instanceof Error ? error.message : 'Invalid JSON.') } }
  const openJson = () => { setJsonText(json); setJsonOpen(true) }
  const symbolList = symbolQuery.trim() ? Object.values(SYMBOLS).flat().filter((symbol, index, all) => all.indexOf(symbol) === index && (symbol.includes(symbolQuery.trim()) || `U+${symbol.codePointAt(0)?.toString(16).toUpperCase()}`.includes(symbolQuery.trim().toUpperCase()))) : symbolCategory === 'Favorites' ? favorites : symbolCategory === 'Recent' ? recent : SYMBOLS[symbolCategory] || []

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setAddOpen(false); setSymbolOpen(false); setJsonOpen(false); setWelcomeOpen(false) }
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo() }
      if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return <div className="app-shell">
    <div className="workspace">
      <aside className={`sidebar ${mobilePane === 'library' ? 'mobile-visible' : ''}`}>
        <div className="sidebar-top">
          <input aria-label="Project name" value={project.name} onChange={event => commit({ ...project, name: event.target.value })}/>
          <div className="sidebar-top-actions"><button className="secondary-button" onClick={openJson}><Code2 size={16}/> JSON</button><button className="icon-button" title="About this workspace" aria-label="About this workspace" onClick={() => setWelcomeOpen(true)}><CircleHelp size={18}/></button></div>
        </div>
        <div className="sidebar-body">
          <div className="sidebar-heading"><span className="eyebrow">COMPONENTS</span><span className="component-count">{(() => { let count = 0; walk(project.components, () => count++); return count })()}/40</span></div>
          <div className="tree">{project.components.length ? project.components.map(node => <TreeItem key={node.uid} node={node} depth={0} selectedId={selectedId} select={select} onMove={moveNode} onDropNode={dropNode} issues={issueIds}/>) : <p className="tree-empty">Add a component to start.</p>}</div>
          <div className="add-wrap"><button className="primary-button add-button" aria-expanded={addOpen} onClick={() => setAddOpen(!addOpen)}><Plus size={17}/> Add component</button>
            {addOpen && <div className="add-popover" role="menu" aria-label="Add component">{PALETTE.map(group => <div key={group.group}><div className="palette-label">{group.group}</div>{group.types.map(type => <button key={type} role="menuitem" onClick={() => addNode(type)}><span className={`tree-type-dot type-${type}`}/><span><strong>{TYPE_NAMES[type]}</strong><small>{TYPE_DESCRIPTIONS[type]}</small></span></button>)}</div>)}</div>}
          </div>
          {selected && <div className="selected-editor"><Inspector node={selected} change={updateSelected} attach={attach} remove={deleteSelected} addChild={type => addNode(type, selectedId)} openSymbols={() => setSymbolOpen(true)}/></div>}
        </div>
      </aside>
      <main className={`main-panel ${mobilePane === 'canvas' ? 'mobile-visible' : ''}`}>
        <div className="canvas-toolbar"><div className="preview-controls"><div className="segmented"><button title="Desktop width" aria-label="Desktop width" className={viewport === 'desktop' ? 'active' : ''} onClick={() => setViewport('desktop')}><Monitor size={16}/></button><button title="Mobile width" aria-label="Mobile width" className={viewport === 'mobile' ? 'active' : ''} onClick={() => setViewport('mobile')}><Smartphone size={16}/></button></div><div className="segmented"><button title="Dark preview" aria-label="Dark preview" className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><Moon size={16}/></button><button title="Light preview" aria-label="Light preview" className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><Sun size={16}/></button></div></div></div>
        <div className="canvas-scroller"><div className="canvas-backdrop"><Preview project={project} selectedId={selectedId} select={select} assetUrls={assetUrls} theme={theme} viewport={viewport}/></div>
          <div className="canvas-bottom"><div className="validation-card"><div className="validation-header"><span className={`validation-icon ${errors.length ? 'invalid' : ''}`}>{errors.length ? <AlertCircle size={17}/> : <Check size={17}/>}</span><div><strong>{errors.length ? `${errors.length} issue${errors.length === 1 ? '' : 's'} to fix` : 'Ready to export'}</strong><small>{errors.length ? 'Select an issue to inspect its component.' : 'This message passes local Discord component checks.'}</small></div><span className="count-pill">{errors.length}</span></div>{errors.length > 0 && <div className="issue-list">{errors.slice(0, 6).map((issue, index) => <button key={index} onClick={() => issue.uid && select(issue.uid)}>{issue.message}</button>)}{errors.length > 6 && <small>+ {errors.length - 6} more issues</small>}</div>}</div></div>
        </div>
      </main>
    </div>

    <nav className="mobile-nav"><button className={mobilePane === 'library' ? 'active' : ''} onClick={() => setMobilePane('library')}><PanelLeftClose size={18}/> Edit</button><button className={mobilePane === 'canvas' ? 'active' : ''} onClick={() => setMobilePane('canvas')}><Monitor size={18}/> Preview</button></nav>

    {symbolOpen && selected?.type === 10 && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSymbolOpen(false) }}><div className="symbol-modal" role="dialog" aria-modal="true" aria-label="Insert symbols"><div className="modal-header"><div><span className="eyebrow">TEXT TOOLS</span><h2>Symbols</h2></div><button className="icon-button" title="Close" onClick={() => setSymbolOpen(false)}><X size={20}/></button></div><div className="symbol-modal-body"><div className="search-box"><Search size={16}/><input aria-label="Search symbols" placeholder="Find a symbol or U+ code" value={symbolQuery} onChange={event => setSymbolQuery(event.target.value)}/></div><div className="category-list">{['Favorites','Recent',...Object.keys(SYMBOLS)].map(category => <button key={category} className={symbolCategory === category ? 'active' : ''} onClick={() => { setSymbolCategory(category); setSymbolQuery('') }}>{category}</button>)}</div><div className="symbol-grid">{symbolList.map((symbol, index) => <div className="symbol-cell" key={`${symbol}-${index}`}><button title={`${symbol} · U+${symbol.codePointAt(0)?.toString(16).toUpperCase()}`} onClick={() => insertText(symbol)}>{symbol}</button><button className={`favorite-button ${favorites.includes(symbol) ? 'active' : ''}`} title="Toggle favorite" onClick={() => setFavorites(current => current.includes(symbol) ? current.filter(value => value !== symbol) : [...current, symbol])}>☆</button></div>)}</div>{!symbolList.length && <p className="muted-note">No symbols in this collection yet.</p>}<div className="style-tool"><span className="eyebrow">STYLED UNICODE</span><p>Convert letters into Unicode variants.</p><input aria-label="Text to style" value={styleInput} onChange={event => setStyleInput(event.target.value)}/><select aria-label="Unicode style" value={styleName} onChange={event => setStyleName(event.target.value)}>{STYLE_NAMES.map(name => <option key={name}>{name}</option>)}</select><div className="styled-result">{styleText(styleInput, styleName)}</div><div className="child-actions"><button className="subtle-button" onClick={() => insertText(styleText(styleInput, styleName))}>Insert</button><button className="subtle-button" onClick={() => copy(styleText(styleInput, styleName))}><Clipboard size={14}/> Copy</button></div></div></div></div></div>}

    {jsonOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setJsonOpen(false) }}><div className="json-modal" role="dialog" aria-modal="true" aria-label="JSON editor"><div className="modal-header"><div><span className="eyebrow">MESSAGE DATA</span><h2>JSON</h2></div><button className="icon-button" title="Close" onClick={() => setJsonOpen(false)}><X size={20}/></button></div><textarea aria-label="Message JSON" spellCheck={false} value={jsonText} onChange={event => setJsonText(event.target.value)}/><div className="json-actions"><button className="secondary-button" onClick={() => fileInput.current?.click()}><FileInput size={16}/> Open file</button><input ref={fileInput} type="file" accept=".zip,.json,application/json" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = '' }}/><button className="secondary-button" onClick={downloadProject}><Download size={16}/> Project ZIP</button><span className="action-spacer"/><button className="secondary-button" onClick={() => copy(jsonText)}><Clipboard size={16}/> Copy</button><button className="secondary-button" onClick={() => downloadText(jsonText, 'json')}><Download size={16}/> Export JSON</button><button className="primary-button" onClick={applyJson}>Apply JSON</button></div><p className="export-note">Paste a Components V2 payload or project JSON, then Apply JSON to update the canvas. Local attachments are included in the project ZIP.</p></div></div>}

    {welcomeOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setWelcomeOpen(false) }}><div className="welcome-modal" role="dialog" aria-modal="true" aria-label="About this workspace"><div className="modal-header"><h2>Build a Discord message</h2><button className="icon-button" title="Close" onClick={() => setWelcomeOpen(false)}><X size={20}/></button></div><p>Select a component in the tree or preview to edit it. Add components from the left sidebar. Use JSON to paste, edit, copy, or export the payload.</p><p>Ctrl+Z / Ctrl+Y undo and redo outside text fields. Ctrl+B and Ctrl+I format selected text in the Markdown editor.</p></div></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}
