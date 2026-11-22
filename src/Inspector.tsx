import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import { CHANNEL_TYPES, SELECT_TYPES, TYPE_NAMES, makeNode, type Media, type Node, type SelectOption } from './model'
import TextEditor, { type Keybindings } from './TextEditor'

type Props = { node?: Node; change: (node: Node) => void; attach: (file: File) => Promise<Media>; remove: () => void; addChild: (type: Node['type']) => void; openSymbols: () => void; keybindings: Keybindings }

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <small className="field-hint">{hint}</small>}</label>
}
function NumberField({ label, value, change, min, max, hint }: { label: string; value?: number; change: (value?: number) => void; min?: number; max?: number; hint?: string }) {
  return <Field label={label} hint={hint}><input type="number" min={min} max={max} value={value ?? ''} onChange={event => change(event.target.value === '' ? undefined : Number(event.target.value))}/></Field>
}
function Toggle({ label, checked, change }: { label: string; checked?: boolean; change: (value: boolean) => void }) {
  return <label className="toggle-field"><span>{label}</span><input type="checkbox" checked={!!checked} onChange={event => change(event.target.checked)}/><span className="toggle-track" /></label>
}
function MediaEditor({ media, change, attach, attachmentOnly = false, imageOnly = false }: { media?: Media; change: (media: Media) => void; attach: (file: File) => Promise<Media>; attachmentOnly?: boolean; imageOnly?: boolean }) {
  return <div className="media-editor">
    {!attachmentOnly && <Field label="Image or media URL"><input type="url" placeholder="https://example.com/image.png" value={media?.assetId ? '' : media?.url || ''} onChange={event => change({ url: event.target.value })}/></Field>}
    {media?.assetId && <div className="attached-name">Attached: {media.url} <button type="button" onClick={() => change({ url: '' })}>Remove</button></div>}
    <label className="upload-button"><ImagePlus size={16}/>{media?.assetId ? 'Replace file' : 'Attach local file'}<input type="file" accept={imageOnly ? 'image/*' : undefined} onChange={async event => { const file = event.target.files?.[0]; if (file) change(await attach(file)); event.target.value = '' }}/></label>
    {attachmentOnly && <small className="field-hint">Discord File components require an uploaded attachment.</small>}
  </div>
}
function OptionEditor({ options, change }: { options: SelectOption[]; change: (options: SelectOption[]) => void }) {
  const update = (index: number, patch: Partial<SelectOption>) => change(options.map((option, i) => i === index ? { ...option, ...patch } : option))
  return <section className="inspector-section"><div className="section-heading"><strong>Options</strong><span>{options.length}/25</span></div>
    {options.map((option, index) => <div className="option-card" key={index}>
      <div className="option-card-heading"><strong>Option {index + 1}</strong><button className="icon-button" title="Remove option" onClick={() => change(options.filter((_, i) => i !== index))}><Trash2 size={15}/></button></div>
      <Field label="Label"><input value={option.label} maxLength={100} onChange={event => update(index, { label: event.target.value })}/></Field>
      <Field label="Value"><input value={option.value} maxLength={100} onChange={event => update(index, { value: event.target.value })}/></Field>
      <details className="optional-fields"><summary>More options</summary><Field label="Description"><input value={option.description || ''} maxLength={100} onChange={event => update(index, { description: event.target.value })}/></Field>
        <Field label="Emoji"><input value={option.emoji?.name || ''} placeholder="Optional" onChange={event => update(index, { emoji: event.target.value ? { name: event.target.value } : undefined })}/></Field>
        {option.emoji?.name && <><Field label="Custom emoji ID"><input value={option.emoji.id || ''} placeholder="Leave blank for Unicode emoji" onChange={event => update(index, { emoji: { ...option.emoji!, id: event.target.value || undefined } })}/></Field><Toggle label="Animated emoji" checked={option.emoji.animated} change={value => update(index, { emoji: { ...option.emoji!, animated: value } })}/></>}
        <Toggle label="Selected by default" checked={option.default} change={value => update(index, { default: value })}/></details>
    </div>)}
    <button className="subtle-button full" disabled={options.length >= 25} onClick={() => change([...options, { label: `Option ${options.length + 1}`, value: `option_${options.length + 1}` }])}><Plus size={15}/> Add option</button>
  </section>
}

export default function Inspector({ node, change, attach, remove, addChild, openSymbols, keybindings }: Props) {
  if (!node) return null
  const patch = (value: Partial<Node>) => change({ ...node, ...value })
  const isSelect = SELECT_TYPES.includes(node.type)
  return <div className="inspector-form">
    <div className="inspector-title"><div><span className="eyebrow">PROPERTIES</span><h2>{TYPE_NAMES[node.type]}</h2></div><button className="icon-button danger" title="Delete component" onClick={remove}><Trash2 size={18}/></button></div>
    <div className="inspector-intro">{node.type === 9 ? 'Pair one to three text blocks with a thumbnail or button.' : node.type === 17 ? 'Group components with an optional accent.' : node.type === 1 ? 'A row holds up to five buttons or one select.' : 'Changes appear in the preview immediately.'}</div>
    <section className="inspector-section">
      {node.type === 10 && <TextEditor content={node.content || ''} change={content => patch({ content })} openSymbols={openSymbols} keybindings={keybindings}/>}
      {node.type === 17 && <>
        <Field label="Accent color"><div className="color-field"><input type="color" value={`#${(node.accent_color ?? 0x5865f2).toString(16).padStart(6, '0')}`} onChange={event => patch({ accent_color: parseInt(event.target.value.slice(1), 16) })}/><input value={node.accent_color === undefined ? '' : `#${node.accent_color.toString(16).padStart(6, '0')}`} placeholder="No accent" onChange={event => { const value = event.target.value.replace('#', ''); if (/^[0-9a-f]{6}$/i.test(value)) patch({ accent_color: parseInt(value, 16) }); else if (!value) patch({ accent_color: undefined }) }}/></div></Field>
        <Toggle label="Spoiler container" checked={node.spoiler} change={value => patch({ spoiler: value })}/>
        <div className="child-actions"><button className="subtle-button" onClick={() => addChild(10)}><Plus size={15}/> Text</button><button className="subtle-button" onClick={() => addChild(14)}><Plus size={15}/> Separator</button></div>
      </>}
      {node.type === 9 && <>
        <Field label="Accessory"><select value={node.accessory?.type || 11} onChange={event => patch({ accessory: makeNode(Number(event.target.value) as 2 | 11) })}><option value={11}>Thumbnail</option><option value={2}>Button</option></select></Field>
        <button className="subtle-button full" disabled={(node.components?.length || 0) >= 3} onClick={() => addChild(10)}><Plus size={15}/> Add text display</button>
      </>}
      {node.type === 1 && <div className="child-actions"><button className="subtle-button" disabled={!!node.components?.some(child => SELECT_TYPES.includes(child.type)) || (node.components?.length || 0) >= 5} onClick={() => addChild(2)}><Plus size={15}/> Button</button><button className="subtle-button" disabled={!!node.components?.length} onClick={() => addChild(3)}><Plus size={15}/> Select</button></div>}
      {node.type === 14 && <><Toggle label="Show divider" checked={node.divider} change={value => patch({ divider: value })}/><Field label="Vertical spacing"><select value={node.spacing ?? 1} onChange={event => patch({ spacing: Number(event.target.value) })}><option value={1}>Small</option><option value={2}>Large</option></select></Field></>}
      {node.type === 11 && <><MediaEditor media={node.media} change={media => patch({ media })} attach={attach} imageOnly/><Field label="Alt text"><input value={node.description || ''} maxLength={1024} placeholder="Describe the image" onChange={event => patch({ description: event.target.value })}/></Field><Toggle label="Spoiler image" checked={node.spoiler} change={value => patch({ spoiler: value })}/></>}
      {node.type === 13 && <><MediaEditor media={node.file} change={file => patch({ file })} attach={attach} attachmentOnly/><Toggle label="Spoiler file" checked={node.spoiler} change={value => patch({ spoiler: value })}/></>}
      {node.type === 12 && <div className="gallery-items"><div className="section-heading"><strong>Media items</strong><span>{node.items?.length || 0}/10</span></div>{node.items?.map((item, index) => <div className="option-card" key={index}><div className="option-card-heading"><strong>Image {index + 1}</strong><button className="icon-button" title="Remove image" onClick={() => patch({ items: node.items?.filter((_, i) => i !== index) })}><Trash2 size={15}/></button></div><MediaEditor media={item.media} change={media => patch({ items: node.items?.map((old, i) => i === index ? { ...old, media } : old) })} attach={attach}/><Field label="Alt text"><input value={item.description || ''} maxLength={1024} onChange={event => patch({ items: node.items?.map((old, i) => i === index ? { ...old, description: event.target.value } : old) })}/></Field><Toggle label="Spoiler" checked={item.spoiler} change={value => patch({ items: node.items?.map((old, i) => i === index ? { ...old, spoiler: value } : old) })}/></div>)}<button className="subtle-button full" disabled={(node.items?.length || 0) >= 10} onClick={() => patch({ items: [...(node.items || []), { media: { url: '' }, description: '' }] })}><Plus size={15}/> Add media</button></div>}
      {node.type === 2 && <>
        <Field label="Button style"><select value={node.style ?? 1} onChange={event => { const style = Number(event.target.value); patch({ style, custom_id: style >= 5 ? undefined : node.custom_id || `button_${node.uid.slice(0, 6)}`, url: style === 5 ? node.url || 'https://' : undefined, sku_id: style === 6 ? node.sku_id || '' : undefined }) }}><option value={1}>Primary</option><option value={2}>Secondary</option><option value={3}>Success</option><option value={4}>Danger</option><option value={5}>Link</option><option value={6}>Premium</option></select></Field>
        <Field label="Label"><input maxLength={80} value={node.label || ''} onChange={event => patch({ label: event.target.value })}/></Field>
        {node.style === 5 ? <Field label="Link URL"><input type="url" value={node.url || ''} onChange={event => patch({ url: event.target.value })}/></Field> : node.style === 6 ? <Field label="SKU ID"><input value={node.sku_id || ''} onChange={event => patch({ sku_id: event.target.value })}/></Field> : <Field label="Custom ID" hint="Your bot receives this ID when the button is clicked."><input value={node.custom_id || ''} onChange={event => patch({ custom_id: event.target.value })}/></Field>}
        <details className="optional-fields"><summary>More options</summary><Field label="Emoji"><input placeholder="Emoji character or custom emoji name" value={node.emoji?.name || ''} onChange={event => patch({ emoji: event.target.value ? { ...node.emoji, name: event.target.value } : undefined })}/></Field>
          {node.emoji?.name && <><Field label="Custom emoji ID"><input placeholder="Leave blank for Unicode emoji" value={node.emoji.id || ''} onChange={event => patch({ emoji: { ...node.emoji!, id: event.target.value || undefined } })}/></Field><Toggle label="Animated emoji" checked={node.emoji.animated} change={value => patch({ emoji: { ...node.emoji!, animated: value } })}/></>}
          <Toggle label="Disabled" checked={node.disabled} change={value => patch({ disabled: value })}/></details>
      </>}
      {isSelect && <>
        <Field label="Custom ID"><input value={node.custom_id || ''} onChange={event => patch({ custom_id: event.target.value })}/></Field>
        <Field label="Placeholder"><input value={node.placeholder || ''} maxLength={150} onChange={event => patch({ placeholder: event.target.value })}/></Field>
        <div className="field-grid"><NumberField label="Minimum" min={0} max={25} value={node.min_values} change={value => patch({ min_values: value })}/><NumberField label="Maximum" min={1} max={25} value={node.max_values} change={value => patch({ max_values: value })}/></div>
        <Toggle label="Disabled" checked={node.disabled} change={value => patch({ disabled: value })}/>
        <details className="optional-fields"><summary>More options</summary>{node.type === 8 && <Field label="Channel types" hint="Choose the Discord channel types shown in the menu."><div className="channel-types">{CHANNEL_TYPES.map(type => <label key={type}><input type="checkbox" checked={node.channel_types?.includes(type) || false} onChange={event => patch({ channel_types: event.target.checked ? [...(node.channel_types || []), type] : node.channel_types?.filter(value => value !== type) })}/>{type === 0 ? 'Text' : type === 2 ? 'Voice' : type === 4 ? 'Category' : type === 5 ? 'News' : type === 15 ? 'Forum' : `Type ${type}`}</label>)}</div></Field>}
        {node.type !== 3 && <Field label="Default selections" hint={node.type === 7 ? 'One entry per line: user:ID or role:ID.' : 'One Discord ID per line.'}><textarea rows={3} placeholder={node.type === 7 ? 'user:123456789\nrole:987654321' : 'Discord IDs, one per line'} value={(node.default_values || []).map(value => node.type === 7 ? `${value.type}:${value.id}` : value.id).join('\n')} onChange={event => patch({ default_values: event.target.value.split('\n').map(value => value.trim()).filter(Boolean).map(value => {
          if (node.type === 7) { const [type, id] = value.includes(':') ? value.split(':', 2) : ['user', value]; return { id, type: type === 'role' ? 'role' as const : 'user' as const } }
          return { id: value, type: node.type === 6 ? 'role' as const : node.type === 8 ? 'channel' as const : 'user' as const }
        }) })}/></Field>}</details>
      </>}
    </section>
    {node.type === 3 && <OptionEditor options={node.options || []} change={options => patch({ options })}/>}
    <details className="inspector-section advanced"><summary>Advanced</summary><NumberField label="Discord component ID" value={node.apiId} min={0} max={4294967295} change={apiId => patch({ apiId })} hint="Optional. Discord generates an ID if left empty."/></details>
  </div>
}
