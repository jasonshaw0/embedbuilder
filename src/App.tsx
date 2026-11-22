import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, Check, ChevronDown, CircleHelp, Clipboard, Code2, Download, FileInput, GalleryHorizontal, GripVertical, LayoutGrid, Library, Menu, Monitor, Moon, MoreHorizontal, Plus, Redo2, RotateCcw, Search, Smartphone, Sparkles, Sun, Trash2, Undo2, X } from 'lucide-react'
import Inspector from './Inspector'
import Preview from './Preview'
import { CONTAINER_CHILDREN, SELECT_TYPES, TOP_LEVEL, TYPE_NAMES, allowedChildren, containsNode, exampleProject, findNode, fromPayload, insertNode, makeNode, removeNode, templateProject, toPayload, updateNode, walk, type Asset, type Media, type Node, type NodeType, type Project } from './model'
import { downloadBlob, discordJsCode, exportBundle, importBundle, loadAssets, loadDraft, parseProject, safeFilename, saveAsset, saveDraft } from './storage'
import { STYLE_NAMES, SYMBOLS, styleText } from './symbols'
import { usedAssets, validateProject } from './validation'

type SidebarTab = 'components' | 'symbols' | 'templates'
type ExportTab = 'json' | 'typescript'
type MobilePane = 'canvas' | 'library' | 'inspector'

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
    <div className={`tree-item ${selectedId === node.uid ? 'active' : ''}`} style={{ paddingLeft: 11 + depth * 17 }} draggable onDragStart={event => { event.dataTransfer.setData('text/plain', node.uid); event.dataTransfer.effectAllowed = 'move' }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); event.stopPropagation(); onDropNode(event.dataTransfer.getData('text/plain'), node.uid) }} onClick={() => select(node.uid)}>
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
  const [project, setProject] = useState<Project>(exampleProject)
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState<string>()
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('components')
  const [symbolCategory, setSymbolCategory] = useState('Separators')
  const [symbolQuery, setSymbolQuery] = useState('')
  const [favorites, setFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('studio-favorites') || '[]') } catch { return [] } })
  const [recent, setRecent] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('studio-recent') || '[]') } catch { return [] } })
  const [styleInput, setStyleInput] = useState('Component Studio')
  const [styleName, setStyleName] = useState(STYLE_NAMES[0])
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [mobilePane, setMobilePane] = useState<MobilePane>('canvas')
  const [exportOpen, setExportOpen] = useState(false)
  const [exportTab, setExportTab] = useState<ExportTab>('json')
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [toast, setToast] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved')
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
    setSaveStatus('saving')
    const timer = window.setTimeout(() => saveDraft(project).then(() => setSaveStatus('saved')).catch(() => setToast('Could not save this draft.')), 450)
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
  const code = useMemo(() => discordJsCode(project, usedAssets(project, assets)), [project, assets])

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
  const select = (id: string) => { setSelectedId(id); if (window.innerWidth < 900) setMobilePane('inspector') }

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
    if (window.innerWidth < 900) setMobilePane('inspector')
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
      } else {
        const incoming = JSON.parse(await file.text())
        commit(incoming.version === 1 ? parseProject(incoming) : fromPayload(incoming))
      }
      setSelectedId(undefined); setImportOpen(false); notify('Project imported.')
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not import the file.') }
  }
  const importPasted = () => { try { commit(fromPayload(JSON.parse(importText))); setSelectedId(undefined); setImportOpen(false); setImportText(''); notify('Components imported.') } catch (error) { notify(error instanceof Error ? error.message : 'Invalid JSON.') } }
  const applyTemplate = (kind: 'announcement' | 'menu' | 'gallery') => { commit(templateProject(kind)); setSelectedId(undefined); notify('Template loaded. Undo restores the previous draft.') }
  const symbolList = symbolQuery.trim() ? Object.values(SYMBOLS).flat().filter((symbol, index, all) => all.indexOf(symbol) === index && (symbol.includes(symbolQuery.trim()) || `U+${symbol.codePointAt(0)?.toString(16).toUpperCase()}`.includes(symbolQuery.trim().toUpperCase()))) : symbolCategory === 'Favorites' ? favorites : symbolCategory === 'Recent' ? recent : SYMBOLS[symbolCategory] || []

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><LayoutGrid size={18}/></span><span className="brand-name">component<span>studio</span></span><span className="brand-version">V2</span></div>
      <div className="top-project"><input aria-label="Project name" value={project.name} onChange={event => commit({ ...project, name: event.target.value })}/><span className={`save-indicator ${saveStatus}`}>{saveStatus === 'saved' ? <Check size={13}/> : <RotateCcw size={13}/>} {saveStatus === 'saved' ? 'Saved locally' : 'Saving'}</span></div>
      <div className="top-actions"><button className="icon-button" title="Undo" disabled={!history.current.length} onClick={undo}><Undo2 size={18}/></button><button className="icon-button" title="Redo" disabled={!future.current.length} onClick={redo}><Redo2 size={18}/></button><span className="top-separator"/><button className="icon-button theme-top" title={theme === 'dark' ? 'Light preview' : 'Dark preview'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Moon size={18}/> : <Sun size={18}/>}</button><button className="secondary-button import-top" onClick={() => setImportOpen(true)}><FileInput size={16}/> Import</button><button className="primary-button" onClick={() => setExportOpen(true)}><Code2 size={17}/> Export</button></div>
    </header>

    <div className="workspace">
      <aside className={`sidebar ${mobilePane === 'library' ? 'mobile-visible' : ''}`}>
        <div className="sidebar-tabs"><button className={sidebarTab === 'components' ? 'active' : ''} onClick={() => setSidebarTab('components')}><LayoutGrid size={16}/> Blocks</button><button className={sidebarTab === 'symbols' ? 'active' : ''} onClick={() => setSidebarTab('symbols')}><Sparkles size={16}/> Symbols</button><button className={sidebarTab === 'templates' ? 'active' : ''} onClick={() => setSidebarTab('templates')}><Library size={16}/> Kits</button></div>
        <div className="sidebar-body">
          {sidebarTab === 'components' && <>
            <div className="sidebar-heading"><span className="eyebrow">STRUCTURE</span><span className="component-count">{(() => { let count = 0; walk(project.components, () => count++); return count })()}/40</span></div>
            <div className="tree">{project.components.length ? project.components.map(node => <TreeItem key={node.uid} node={node} depth={0} selectedId={selectedId} select={select} onMove={moveNode} onDropNode={dropNode} issues={issueIds}/>) : <p className="tree-empty">Your canvas is empty. Add a block below.</p>}</div>
            <div className="sidebar-heading palette-heading"><span className="eyebrow">ADD COMPONENT</span><span className="tiny-help" title="Select a container or row to add inside it. Otherwise blocks are added beside the selection."><CircleHelp size={15}/></span></div>
            {PALETTE.map(group => <div className="palette-group" key={group.group}><div className="palette-label">{group.group}</div><div className="palette-grid">{group.types.map(type => <button key={type} className="palette-card" onClick={() => addNode(type)}><span className={`palette-icon type-${type}`}>{type === 17 ? '▣' : type === 9 ? '▤' : type === 14 ? '☰' : type === 1 ? '▦' : type === 10 ? 'T' : type === 12 ? '▧' : type === 11 ? '◩' : type === 13 ? '▤' : type === 2 ? '▭' : '☷'}</span><span><strong>{TYPE_NAMES[type]}</strong><small>{TYPE_DESCRIPTIONS[type]}</small></span></button>)}</div></div>)}
          </>}
          {sidebarTab === 'symbols' && <>
            <div className="symbol-intro"><span className="eyebrow">CHARACTER LIBRARY</span><h3>Details make the difference.</h3><p>Search, copy, or insert symbols into your selected text block.</p></div>
            <div className="search-box"><Search size={16}/><input aria-label="Search symbols" placeholder="Find a symbol or U+ code" value={symbolQuery} onChange={event => setSymbolQuery(event.target.value)}/></div>
            <div className="category-list">{['Favorites','Recent',...Object.keys(SYMBOLS)].map(category => <button key={category} className={symbolCategory === category ? 'active' : ''} onClick={() => { setSymbolCategory(category); setSymbolQuery('') }}>{category}</button>)}</div>
            <div className="symbol-grid">{symbolList.map((symbol, index) => <div className="symbol-cell" key={`${symbol}-${index}`}><button title={`${symbol} · U+${symbol.codePointAt(0)?.toString(16).toUpperCase()}`} onClick={() => insertText(symbol)}>{symbol}</button><button className={`favorite-button ${favorites.includes(symbol) ? 'active' : ''}`} title="Toggle favorite" onClick={() => setFavorites(current => current.includes(symbol) ? current.filter(value => value !== symbol) : [...current, symbol])}>☆</button></div>)}</div>
            {!symbolList.length && <p className="muted-note">No symbols in this collection yet.</p>}
            <div className="style-tool"><span className="eyebrow">STYLED UNICODE</span><p>Convert letters into Unicode variants. Discord still controls the font.</p><input aria-label="Text to style" value={styleInput} onChange={event => setStyleInput(event.target.value)}/><select aria-label="Unicode style" value={styleName} onChange={event => setStyleName(event.target.value)}>{STYLE_NAMES.map(name => <option key={name}>{name}</option>)}</select><div className="styled-result">{styleText(styleInput, styleName)}</div><div className="child-actions"><button className="subtle-button" onClick={() => insertText(styleText(styleInput, styleName))}>Insert</button><button className="subtle-button" onClick={() => copy(styleText(styleInput, styleName))}><Clipboard size={14}/> Copy</button></div><small>Styled characters may be difficult for screen readers and may not exist in every font.</small></div>
          </>}
          {sidebarTab === 'templates' && <div className="templates-panel"><span className="eyebrow">STARTER KITS</span><h3>Start with a layout.</h3><p>Each kit is editable. Loading one replaces the current canvas; Undo brings it back.</p>{([['announcement','Announcement','Text, section, divider, and link'],['menu','Interactive menu','Container with a string select'],['gallery','Media gallery','Image grid with captions']] as const).map(([key,title,description]) => <button className="template-card" key={key} onClick={() => applyTemplate(key)}><span className="template-art">{key === 'gallery' ? <GalleryHorizontal size={24}/> : key === 'menu' ? <Menu size={24}/> : <Sparkles size={24}/>}</span><span><strong>{title}</strong><small>{description}</small></span><Plus size={16}/></button>)}<button className="subtle-button full" onClick={() => { commit({ version: 1, name: 'Untitled message', components: [] }); setSelectedId(undefined) }}>Start with a blank canvas</button></div>}
        </div>
      </aside>

      <main className={`main-panel ${mobilePane === 'canvas' ? 'mobile-visible' : ''}`}>
        <div className="canvas-toolbar"><div><span className="eyebrow">LIVE CANVAS</span><h1>Message preview <span className="live-dot"/></h1></div><div className="preview-controls"><div className="segmented"><button title="Desktop width" className={viewport === 'desktop' ? 'active' : ''} onClick={() => setViewport('desktop')}><Monitor size={16}/></button><button title="Mobile width" className={viewport === 'mobile' ? 'active' : ''} onClick={() => setViewport('mobile')}><Smartphone size={16}/></button></div><div className="segmented"><button title="Dark preview" className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><Moon size={16}/></button><button title="Light preview" className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><Sun size={16}/></button></div></div></div>
        <div className="canvas-scroller"><div className="canvas-backdrop"><div className="canvas-caption"><span>DISCORD SIMULATION</span><span>{viewport === 'desktop' ? 'Desktop' : 'Mobile'} · {theme === 'dark' ? 'Dark' : 'Light'}</span></div><Preview project={project} selectedId={selectedId} select={select} assetUrls={assetUrls} theme={theme} viewport={viewport}/><div className="preview-footnote"><CircleHelp size={15}/><span>Preview matches Discord’s layout closely. Client fonts, remote media, and platform updates can change the final result.</span></div></div>
          <div className="canvas-bottom"><div className="validation-card"><div className="validation-header"><span className={`validation-icon ${errors.length ? 'invalid' : ''}`}>{errors.length ? <AlertCircle size={17}/> : <Check size={17}/>}</span><div><strong>{errors.length ? `${errors.length} issue${errors.length === 1 ? '' : 's'} to fix` : 'Ready to export'}</strong><small>{errors.length ? 'Select an issue to inspect its component.' : 'This message passes local Discord component checks.'}</small></div><span className="count-pill">{errors.length}</span></div>{errors.length > 0 && <div className="issue-list">{errors.slice(0, 6).map((issue, index) => <button key={index} onClick={() => issue.uid && select(issue.uid)}>{issue.message}</button>)}{errors.length > 6 && <small>+ {errors.length - 6} more issues in export</small>}</div>}</div><div className="limits-note"><span className="eyebrow">DISCORD LIMITS</span><p>V2 messages cannot carry classic embeds or set a custom font. Buttons and selects need bot handlers. Local files must accompany the exported payload.</p></div></div>
        </div>
      </main>

      <aside className={`inspector ${mobilePane === 'inspector' ? 'mobile-visible' : ''}`}><Inspector node={selected} change={updateSelected} attach={attach} remove={deleteSelected} addChild={type => addNode(type, selectedId)}/></aside>
    </div>

    <nav className="mobile-nav"><button className={mobilePane === 'library' ? 'active' : ''} onClick={() => setMobilePane('library')}><LayoutGrid size={18}/> Build</button><button className={mobilePane === 'canvas' ? 'active' : ''} onClick={() => setMobilePane('canvas')}><Monitor size={18}/> Preview</button><button className={mobilePane === 'inspector' ? 'active' : ''} onClick={() => setMobilePane('inspector')}><MoreHorizontal size={18}/> Edit</button></nav>

    {exportOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setExportOpen(false) }}><div className="export-modal" role="dialog" aria-modal="true" aria-label="Export message"><div className="modal-header"><div><span className="eyebrow">SHARE YOUR BUILD</span><h2>Export message</h2></div><button className="icon-button" title="Close" onClick={() => setExportOpen(false)}><X size={20}/></button></div><div className="export-summary"><span className={`validation-icon ${errors.length ? 'invalid' : ''}`}>{errors.length ? <AlertCircle size={17}/> : <Check size={17}/>}</span><span>{errors.length ? `${errors.length} issue${errors.length === 1 ? '' : 's'} must be fixed before sending.` : 'Payload passes local validation.'}</span></div>{errors.length > 0 && <div className="export-errors">{errors.map((issue, index) => <button key={index} onClick={() => { if (issue.uid) select(issue.uid); setExportOpen(false) }}>{issue.message}</button>)}</div>}<div className="export-tabs"><button className={exportTab === 'json' ? 'active' : ''} onClick={() => setExportTab('json')}>Discord JSON</button><button className={exportTab === 'typescript' ? 'active' : ''} onClick={() => setExportTab('typescript')}>discord.js TypeScript</button></div><pre className="code-output"><code>{exportTab === 'json' ? json : code}</code></pre><div className="export-actions"><button className="secondary-button" onClick={downloadProject}><Download size={16}/> Project ZIP</button><div><button className="secondary-button" disabled={!!errors.length} onClick={() => downloadText(exportTab === 'json' ? json : code, exportTab === 'json' ? 'json' : 'ts')}><Download size={16}/> Download</button><button className="primary-button" disabled={!!errors.length} onClick={() => copy(exportTab === 'json' ? json : code)}><Clipboard size={16}/> Copy {exportTab === 'json' ? 'JSON' : 'code'}</button></div></div><p className="export-note">JSON that uses <code>attachment://</code> also needs the matching files. The project ZIP keeps those files with your editable draft.</p></div></div>}
    {importOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setImportOpen(false) }}><div className="import-modal" role="dialog" aria-modal="true" aria-label="Import project"><div className="modal-header"><div><span className="eyebrow">BRING YOUR WORK</span><h2>Import a project</h2></div><button className="icon-button" title="Close" onClick={() => setImportOpen(false)}><X size={20}/></button></div><p>Open a Component Studio ZIP, a project JSON file, or an existing Components V2 message payload.</p><button className="upload-large" onClick={() => fileInput.current?.click()}><FileInput size={23}/><strong>Choose a file</strong><small>.studio.zip or .json</small></button><input ref={fileInput} type="file" accept=".zip,.json,application/json" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = '' }}/><div className="import-or">OR PASTE MESSAGE JSON</div><textarea rows={8} value={importText} placeholder={'{ "flags": 32768, "components": [...] }'} onChange={event => setImportText(event.target.value)}/><div className="modal-footer"><button className="secondary-button" onClick={() => setImportOpen(false)}>Cancel</button><button className="primary-button" disabled={!importText.trim()} onClick={importPasted}>Import JSON</button></div></div></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}
