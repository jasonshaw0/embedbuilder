export type NodeType = 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 17
export type Media = { url: string; assetId?: string }
export type GalleryItem = { media: Media; description?: string; spoiler?: boolean }
export type SelectOption = { label: string; value: string; description?: string; emoji?: { name: string; id?: string; animated?: boolean }; default?: boolean }
export type Node = {
  uid: string
  type: NodeType
  apiId?: number
  components?: Node[]
  accessory?: Node
  content?: string
  accent_color?: number
  spoiler?: boolean
  divider?: boolean
  spacing?: number
  items?: GalleryItem[]
  media?: Media
  file?: Media
  description?: string
  style?: number
  label?: string
  emoji?: { name: string; id?: string; animated?: boolean }
  custom_id?: string
  url?: string
  sku_id?: string
  disabled?: boolean
  options?: SelectOption[]
  placeholder?: string
  min_values?: number
  max_values?: number
  default_values?: { id: string; type: 'user' | 'role' | 'channel' }[]
  channel_types?: number[]
}
export type Asset = { id: string; name: string; type: string; blob: Blob }
export type Project = { version: 1; name: string; components: Node[] }
export type Issue = { uid?: string; message: string; level: 'error' | 'info' }

export const TYPE_NAMES: Record<NodeType, string> = {
  1: 'Action row', 2: 'Button', 3: 'String select', 5: 'User select', 6: 'Role select',
  7: 'Mentionable select', 8: 'Channel select', 9: 'Section', 10: 'Text display',
  11: 'Thumbnail', 12: 'Media gallery', 13: 'File', 14: 'Separator', 17: 'Container',
}
export const TOP_LEVEL: NodeType[] = [10, 9, 17, 12, 13, 14, 1]
export const CONTAINER_CHILDREN: NodeType[] = [10, 9, 12, 13, 14, 1]
export const SELECT_TYPES: NodeType[] = [3, 5, 6, 7, 8]
export const CHANNEL_TYPES = [0, 2, 4, 5, 10, 11, 12, 13, 14, 15, 16]

export function uid(): string { return crypto.randomUUID() }
export function makeNode(type: NodeType): Node {
  const node: Node = { uid: uid(), type }
  switch (type) {
    case 1: node.components = [makeNode(2)]; break
    case 2: Object.assign(node, { style: 1, label: 'Button', custom_id: `button_${node.uid.slice(0, 6)}` }); break
    case 3: Object.assign(node, { custom_id: `select_${node.uid.slice(0, 6)}`, placeholder: 'Choose an option', options: [{ label: 'First option', value: 'first' }] }); break
    case 5: case 6: case 7: case 8: Object.assign(node, { custom_id: `select_${node.uid.slice(0, 6)}`, placeholder: `Choose ${TYPE_NAMES[type].toLowerCase()}` }); break
    case 9: node.components = [makeNode(10)]; node.accessory = makeNode(11); break
    case 10: node.content = 'Write something here...'; break
    case 11: node.media = { url: '' }; break
    case 12: node.items = [{ media: { url: '' }, description: '' }]; break
    case 13: node.file = { url: '' }; break
    case 14: node.divider = true; node.spacing = 1; break
    case 17: node.accent_color = 0x5865f2; node.components = [makeNode(10)]; break
  }
  return node
}

export function exampleProject(): Project {
  const title = makeNode(10); title.content = '# Welcome to Component Studio\nBuild something worth sending.'
  const section = makeNode(9); section.components![0].content = '**Create with confidence**\nCompose rich layouts, insert symbols, and inspect the Discord result as you go.'
  const thumbnail = section.accessory!; thumbnail.media = { url: 'https://cdn.discordapp.com/embed/avatars/0.png' }; thumbnail.description = 'Discord-style illustration'
  const divider = makeNode(14)
  const note = makeNode(10); note.content = '▸  Every component below is editable. Select a block to get started.'
  const row = makeNode(1); row.components![0].label = 'Documentation'; row.components![0].style = 5; row.components![0].url = 'https://docs.discord.com/developers/components/overview'; delete row.components![0].custom_id
  const container = makeNode(17); container.components = [title, section, divider, note, row]
  return { version: 1, name: 'Welcome message', components: [container] }
}

export function templateProject(kind: 'announcement' | 'menu' | 'gallery'): Project {
  if (kind === 'announcement') return exampleProject()
  if (kind === 'menu') {
    const title = makeNode(10); title.content = '# Choose your path\nPick an option below to continue.'
    const row = makeNode(1); row.components = [makeNode(3)]; row.components[0].options = [
      { label: 'Explore', value: 'explore', description: 'See what is new', emoji: { name: '✨' } },
      { label: 'Settings', value: 'settings', description: 'Adjust your preferences', emoji: { name: '⚙️' } },
    ]
    const container = makeNode(17); container.accent_color = 0x57f287; container.components = [title, row]
    return { version: 1, name: 'Interactive menu', components: [container] }
  }
  const heading = makeNode(10); heading.content = '# Gallery\nA place for your favorite moments.'
  const gallery = makeNode(12); gallery.items = [
    { media: { url: '' }, description: 'Describe the first image' },
    { media: { url: '' }, description: 'Describe the second image' },
  ]
  const caption = makeNode(10); caption.content = '-# Add image URLs or attach local files in the inspector.'
  return { version: 1, name: 'Media gallery', components: [heading, gallery, caption] }
}

export function walk(nodes: Node[], visit: (node: Node) => void): void {
  for (const node of nodes) {
    visit(node)
    if (node.components) walk(node.components, visit)
    if (node.accessory) walk([node.accessory], visit)
  }
}
export function findNode(nodes: Node[], id: string): Node | undefined {
  let found: Node | undefined
  walk(nodes, node => { if (node.uid === id) found = node })
  return found
}
export function updateNode(nodes: Node[], id: string, update: (node: Node) => Node): Node[] {
  return nodes.map(node => node.uid === id ? update(node) : {
    ...node,
    components: node.components && updateNode(node.components, id, update),
    accessory: node.accessory ? updateNode([node.accessory], id, update)[0] : undefined,
  })
}
export function removeNode(nodes: Node[], id: string): Node[] {
  return nodes.filter(node => node.uid !== id).map(node => ({
    ...node,
    components: node.components && removeNode(node.components, id),
    accessory: node.accessory?.uid === id ? undefined : node.accessory,
  }))
}
export function containsNode(node: Node, id: string): boolean {
  if (node.uid === id) return true
  return !!findNode(node.components || [], id) || !!(node.accessory && containsNode(node.accessory, id))
}
export function allowedChildren(parent?: Node): NodeType[] {
  if (!parent) return TOP_LEVEL
  if (parent.type === 17) return CONTAINER_CHILDREN
  if (parent.type === 9) return [10]
  if (parent.type === 1) return parent.components?.some(c => SELECT_TYPES.includes(c.type)) ? [] : [2, ...(!parent.components?.length ? SELECT_TYPES : [])]
  return []
}
export function insertNode(nodes: Node[], parentId: string | undefined, node: Node, index?: number): Node[] {
  if (!parentId) {
    const copy = [...nodes]; copy.splice(index ?? copy.length, 0, node); return copy
  }
  return updateNode(nodes, parentId, parent => {
    const copy = [...(parent.components || [])]
    copy.splice(index ?? copy.length, 0, node)
    return { ...parent, components: copy }
  })
}

function mediaUrl(media?: Media): string { return media?.assetId ? `attachment://${media.url}` : (media?.url || '') }
function emojiValue(emoji?: Node['emoji']) { return emoji?.name ? emoji : undefined }
export function toApiNode(node: Node): Record<string, unknown> {
  const result: Record<string, unknown> = { type: node.type }
  if (node.apiId !== undefined) result.id = node.apiId
  switch (node.type) {
    case 1: result.components = node.components?.map(toApiNode) || []; break
    case 2:
      result.style = node.style ?? 1
      if (node.label) result.label = node.label
      if (emojiValue(node.emoji)) result.emoji = node.emoji
      if (node.style === 5) result.url = node.url || ''
      else if (node.style === 6) result.sku_id = node.sku_id || ''
      else result.custom_id = node.custom_id || ''
      if (node.disabled) result.disabled = true
      break
    case 3:
      result.custom_id = node.custom_id || ''
      result.options = node.options?.map(o => ({ label: o.label, value: o.value, ...(o.description ? { description: o.description } : {}), ...(o.emoji?.name ? { emoji: o.emoji } : {}), ...(o.default ? { default: true } : {}) })) || []
      if (node.placeholder) result.placeholder = node.placeholder
      if (node.min_values !== undefined) result.min_values = node.min_values
      if (node.max_values !== undefined) result.max_values = node.max_values
      if (node.disabled) result.disabled = true
      break
    case 5: case 6: case 7: case 8:
      result.custom_id = node.custom_id || ''
      if (node.placeholder) result.placeholder = node.placeholder
      if (node.min_values !== undefined) result.min_values = node.min_values
      if (node.max_values !== undefined) result.max_values = node.max_values
      if (node.default_values?.length) result.default_values = node.default_values
      if (node.type === 8 && node.channel_types?.length) result.channel_types = node.channel_types
      if (node.disabled) result.disabled = true
      break
    case 9: result.components = node.components?.map(toApiNode) || []; if (node.accessory) result.accessory = toApiNode(node.accessory); break
    case 10: result.content = node.content || ''; break
    case 11: result.media = { url: mediaUrl(node.media) }; if (node.description) result.description = node.description; if (node.spoiler) result.spoiler = true; break
    case 12: result.items = node.items?.map(item => ({ media: { url: mediaUrl(item.media) }, ...(item.description ? { description: item.description } : {}), ...(item.spoiler ? { spoiler: true } : {}) })) || []; break
    case 13: result.file = { url: mediaUrl(node.file) }; if (node.spoiler) result.spoiler = true; break
    case 14: if (node.divider !== undefined) result.divider = node.divider; if (node.spacing !== undefined) result.spacing = node.spacing; break
    case 17: result.components = node.components?.map(toApiNode) || []; if (node.accent_color !== undefined) result.accent_color = node.accent_color; if (node.spoiler) result.spoiler = true; break
  }
  return result
}
export function toPayload(project: Project) { return { flags: 32768, components: project.components.map(toApiNode) } }

function parseMedia(raw: unknown): Media {
  const url = typeof raw === 'object' && raw && 'url' in raw ? String(raw.url) : ''
  return url.startsWith('attachment://') ? { url: url.slice(13) } : { url }
}
export function fromApiNode(input: unknown): Node {
  if (!input || typeof input !== 'object' || !('type' in input)) throw new Error('A component is missing its type.')
  const raw = input as Record<string, unknown>
  const type = Number(raw.type) as NodeType
  if (!(type in TYPE_NAMES)) throw new Error(`Unsupported component type ${raw.type}. Nothing was imported.`)
  for (const field of ['components', 'items', 'options', 'default_values', 'channel_types']) {
    if (raw[field] !== undefined && !Array.isArray(raw[field])) throw new Error(`${TYPE_NAMES[type]} has an invalid ${field} field. Nothing was imported.`)
  }
  for (const field of ['media', 'file', 'accessory']) {
    if (raw[field] !== undefined && (typeof raw[field] !== 'object' || raw[field] === null)) throw new Error(`${TYPE_NAMES[type]} has an invalid ${field} field. Nothing was imported.`)
  }
  const node: Node = { uid: uid(), type }
  if (typeof raw.id === 'number') node.apiId = raw.id
  const fields = ['content','accent_color','spoiler','divider','spacing','description','style','label','custom_id','url','sku_id','disabled','placeholder','min_values','max_values','channel_types','default_values'] as const
  for (const field of fields) if (raw[field] !== undefined) (node as unknown as Record<string, unknown>)[field] = raw[field]
  if (Array.isArray(raw.components)) node.components = raw.components.map(fromApiNode)
  if (raw.accessory) node.accessory = fromApiNode(raw.accessory)
  if (raw.media) node.media = parseMedia(raw.media)
  if (raw.file) node.file = parseMedia(raw.file)
  if (Array.isArray(raw.items)) node.items = raw.items.map(item => {
    const value = item as Record<string, unknown>
    return { media: parseMedia(value.media), description: String(value.description || ''), spoiler: Boolean(value.spoiler) }
  })
  if (Array.isArray(raw.options)) node.options = raw.options as SelectOption[]
  if (raw.emoji) node.emoji = raw.emoji as Node['emoji']
  const known = new Set(['type','id','components','accessory','media','file','items','options','emoji',...fields])
  const extras = Object.keys(raw).filter(key => !known.has(key))
  if (extras.length) throw new Error(`Unsupported field(s) on ${TYPE_NAMES[type]}: ${extras.join(', ')}. Nothing was imported.`)
  return node
}
export function fromPayload(input: unknown): Project {
  if (!input || typeof input !== 'object') throw new Error('Expected a Components V2 JSON object.')
  const raw = input as Record<string, unknown>
  if (!Array.isArray(raw.components)) throw new Error('JSON must contain a components array.')
  if (typeof raw.flags !== 'number' || (raw.flags & 32768) === 0) throw new Error('Components V2 JSON must set the 32768 message flag.')
  if (raw.content !== undefined || raw.embeds !== undefined) throw new Error('Components V2 cannot include content or embeds.')
  const extras = Object.keys(raw).filter(key => !['flags','components'].includes(key))
  if (extras.length) throw new Error(`Unsupported message field(s): ${extras.join(', ')}. Nothing was imported.`)
  return { version: 1, name: 'Imported message', components: raw.components.map(fromApiNode) }
}
