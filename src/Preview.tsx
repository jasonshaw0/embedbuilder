import { ChevronDown, File as FileIcon, Image as ImageIcon, ExternalLink, LockKeyhole } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { renderDiscordMarkdown } from './markdown'
import { TYPE_NAMES, type Media, type Node, type Project } from './model'

type Props = { project: Project; selectedId?: string; select: (id: string) => void; assetUrls: Record<string, string>; theme: 'dark' | 'light'; viewport: 'desktop' | 'mobile'; embedOnly: boolean }

function mediaSource(media: Media | undefined, assetUrls: Record<string, string>): string {
  return media?.assetId ? assetUrls[media.assetId] || '' : media?.url || ''
}
function Markdown({ content }: { content: string }) {
  return <div className="discord-markdown" dangerouslySetInnerHTML={{ __html: renderDiscordMarkdown(content) }} onClick={event => {
    const target = event.target as HTMLElement
    if (target.classList.contains('discord-spoiler')) target.classList.toggle('revealed')
    if (target.closest('a')) event.preventDefault()
  }} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && (event.target as HTMLElement).classList.contains('discord-spoiler')) { event.preventDefault(); (event.target as HTMLElement).classList.toggle('revealed') } }} />
}
function MediaTile({ source, description, spoiler, small = false }: { source: string; description?: string; spoiler?: boolean; small?: boolean }) {
  return <div className={`media-tile ${small ? 'small' : ''} ${spoiler ? 'media-spoiler' : ''}`} onClick={event => { if (spoiler) (event.currentTarget as HTMLElement).classList.toggle('revealed') }}>
    {source ? <img src={source} alt={description || ''} onError={event => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement?.classList.add('media-failed') }} /> : <span className="media-empty"><ImageIcon size={small ? 22 : 30} strokeWidth={1.5}/><span>Image preview</span></span>}
    {spoiler && <span className="spoiler-label">SPOILER</span>}
  </div>
}
function PreviewNode({ node, selectedId, select, assetUrls }: { node: Node; selectedId?: string; select: (id: string) => void; assetUrls: Record<string, string> }) {
  const [open, setOpen] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!selectRef.current?.contains(event.target as globalThis.Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  const active = selectedId === node.uid
  const props = { className: `preview-node preview-${node.type} ${active ? 'selected' : ''}`, 'data-uid': node.uid, onClick: (event: React.MouseEvent) => { event.stopPropagation(); select(node.uid) } }
  switch (node.type) {
    case 10: return <div {...props}><Markdown content={node.content || ''}/></div>
    case 14: return <div {...props} className={`${props.className} separator ${node.spacing === 2 ? 'large' : ''}`}>{node.divider !== false && <span />}</div>
    case 17: return <div {...props} className={`${props.className} discord-container ${node.spoiler ? 'container-spoiler' : ''}`} style={{ borderLeftColor: node.accent_color === undefined ? 'transparent' : `#${node.accent_color.toString(16).padStart(6, '0')}` }}>
      {node.components?.map(child => <PreviewNode key={child.uid} node={child} selectedId={selectedId} select={select} assetUrls={assetUrls} />)}
      {node.spoiler && <button className="container-spoiler-cover" onClick={event => { event.stopPropagation(); event.currentTarget.parentElement?.classList.toggle('revealed') }}>SPOILER · Click to reveal</button>}
    </div>
    case 9: return <div {...props} className={`${props.className} discord-section`}>
      <div className="section-copy">{node.components?.map(child => <PreviewNode key={child.uid} node={child} selectedId={selectedId} select={select} assetUrls={assetUrls} />)}</div>
      {node.accessory && <div className="section-accessory"><PreviewNode node={node.accessory} selectedId={selectedId} select={select} assetUrls={assetUrls} /></div>}
    </div>
    case 11: return <div {...props} className={`${props.className} preview-thumbnail`}><MediaTile source={mediaSource(node.media, assetUrls)} description={node.description} spoiler={node.spoiler} small /></div>
    case 12: return <div {...props} className={`${props.className} discord-gallery gallery-count-${Math.min(node.items?.length || 1, 4)}`}>
      {node.items?.map((item, index) => <MediaTile key={index} source={mediaSource(item.media, assetUrls)} description={item.description} spoiler={item.spoiler} />)}
    </div>
    case 13: return <div {...props} className={`${props.className} discord-file`}><span className="file-icon"><FileIcon size={21}/></span><span className="file-copy"><strong>{node.file?.url || 'Attach a file'}</strong><small>Attachment</small></span>{node.spoiler && <LockKeyhole size={16}/>}</div>
    case 1: return <div {...props} className={`${props.className} discord-actions`}>{node.components?.map(child => <PreviewNode key={child.uid} node={child} selectedId={selectedId} select={select} assetUrls={assetUrls} />)}</div>
    case 2: return <button {...props} type="button" className={`${props.className} discord-button button-style-${node.style || 1}`} disabled={node.disabled}>
      {node.emoji?.name && <span>{node.emoji.name}</span>}{node.label || (node.emoji?.name ? '' : 'Button')}{node.style === 5 && <ExternalLink size={14}/>} {node.style === 6 && <span>◆</span>}
    </button>
    case 3: case 5: case 6: case 7: case 8: return <div {...props} ref={selectRef} className={`${props.className} discord-select ${node.disabled ? 'disabled' : ''}`} onClick={event => { event.stopPropagation(); select(node.uid); if (!node.disabled) setOpen(!open) }}>
      <span>{node.placeholder || TYPE_NAMES[node.type]}</span><ChevronDown size={16}/>
      {open && <div className="select-popover" onClick={event => event.stopPropagation()}>{node.type === 3 ? node.options?.map((option, index) => <div className="select-option" key={index}>{option.emoji?.name && <span>{option.emoji.name}</span>}<span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>{option.default && <span className="option-check">✓</span>}</div>) : <div className="select-option select-dynamic">Discord supplies the available {TYPE_NAMES[node.type].toLowerCase()} options when this message is sent.</div>}</div>}
    </div>
  }
}

export default function Preview({ project, selectedId, select, assetUrls, theme, viewport, embedOnly }: Props) {
  const components = <div className="message-components">{project.components.map(node => <PreviewNode key={node.uid} node={node} selectedId={selectedId} select={select} assetUrls={assetUrls} />)}</div>
  return <div className={`discord-stage ${theme} ${viewport} ${embedOnly ? 'embed-only' : ''}`}>
    {embedOnly ? <div className="embed-only-content">{components}</div> : <>
    <div className="discord-channel"><span className="channel-hash">#</span> component-preview <span className="channel-divider"/> <span className="channel-subtitle">A live layout simulation</span></div>
    <div className="discord-chat">
      <div className="discord-avatar">CS</div>
      <div className="discord-message">
        <div className="message-meta"><strong>Component Studio</strong><span className="bot-badge">APP</span><time>Today at 12:34 PM</time></div>
        {components}
      </div>
    </div>
    <div className="discord-chat-bottom"><span>＋</span> Message #component-preview</div></>}
  </div>
}
