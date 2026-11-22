import JSZip from 'jszip'
import { openDB } from 'idb'
import { TYPE_NAMES, toPayload, type Asset, type Project } from './model'
import { usedAssets } from './validation'

let dbPromise: ReturnType<typeof openDB> | undefined
function getDb() {
  dbPromise ??= openDB('component-studio', 1, {
    upgrade(db) { db.createObjectStore('project'); db.createObjectStore('assets', { keyPath: 'id' }) },
  })
  return dbPromise
}

export async function loadDraft(): Promise<Project | undefined> { return (await getDb()).get('project', 'current') }
export async function saveDraft(project: Project): Promise<void> { await (await getDb()).put('project', project, 'current') }
export async function loadAssets(): Promise<Asset[]> { return (await getDb()).getAll('assets') }
export async function saveAsset(asset: Asset): Promise<void> { await (await getDb()).put('assets', asset) }
export async function clearAssets(): Promise<void> { await (await getDb()).clear('assets') }

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function safeFilename(name: string): string { return (name.trim() || 'project').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) }

export async function exportBundle(project: Project, assets: Asset[]): Promise<Blob> {
  const zip = new JSZip()
  zip.file('project.json', JSON.stringify(project, null, 2))
  zip.file('message.json', JSON.stringify(toPayload(project), null, 2))
  zip.file('send.ts', discordJsCode(project, usedAssets(project, assets)))
  const manifest: { id: string; name: string; type: string; path: string }[] = []
  for (const asset of assets) {
    const path = `assets/${asset.id}-${safeFilename(asset.name)}`
    manifest.push({ id: asset.id, name: asset.name, type: asset.type, path })
    zip.file(path, await asset.blob.arrayBuffer())
  }
  zip.file('assets.json', JSON.stringify(manifest, null, 2))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}
export async function importBundle(file: File): Promise<{ project: Project; assets: Asset[] }> {
  const zip = await JSZip.loadAsync(file)
  const projectText = await zip.file('project.json')?.async('text')
  if (!projectText) throw new Error('Bundle has no project.json.')
  const project = parseProject(JSON.parse(projectText))
  const manifestText = await zip.file('assets.json')?.async('text')
  const manifest = manifestText ? JSON.parse(manifestText) as { id: string; name: string; type: string; path: string }[] : []
  const assets: Asset[] = []
  for (const entry of manifest) {
    if (!entry.path.startsWith('assets/') || entry.path.includes('..')) throw new Error('Bundle contains an invalid asset path.')
    const content = await zip.file(entry.path)?.async('uint8array')
    if (!content) throw new Error(`Missing asset: ${entry.name}`)
    assets.push({ id: entry.id, name: entry.name, type: entry.type, blob: new Blob([new Uint8Array(content)], { type: entry.type }) })
  }
  return { project, assets }
}

export function parseProject(input: unknown): Project {
  if (!input || typeof input !== 'object') throw new Error('Invalid project file.')
  const project = input as Project
  if (project.version !== 1 || typeof project.name !== 'string' || !Array.isArray(project.components)) throw new Error('Unsupported project format.')
  const uids = new Set<string>()
  const checkMedia = (media: unknown): void => {
    if (!media || typeof media !== 'object' || typeof (media as Record<string, unknown>).url !== 'string') throw new Error('Project contains an invalid media reference.')
    const assetId = (media as Record<string, unknown>).assetId
    if (assetId !== undefined && typeof assetId !== 'string') throw new Error('Project contains an invalid asset ID.')
  }
  const check = (node: unknown): void => {
    if (!node || typeof node !== 'object') throw new Error('Project contains an invalid component.')
    const value = node as Record<string, unknown>
    if (typeof value.uid !== 'string' || typeof value.type !== 'number' || !(value.type in TYPE_NAMES)) throw new Error('Project contains an invalid component.')
    if (uids.has(value.uid)) throw new Error('Project has duplicate component IDs.')
    uids.add(value.uid)
    if (value.components !== undefined) {
      if (!Array.isArray(value.components)) throw new Error('Project contains invalid child components.')
      value.components.forEach(check)
    }
    if (value.accessory !== undefined) check(value.accessory)
    if (value.media !== undefined) checkMedia(value.media)
    if (value.file !== undefined) checkMedia(value.file)
    if (value.items !== undefined) {
      if (!Array.isArray(value.items)) throw new Error('Project contains an invalid media gallery.')
      value.items.forEach(item => { if (!item || typeof item !== 'object') throw new Error('Project contains an invalid gallery item.'); checkMedia((item as Record<string, unknown>).media) })
    }
    if (value.options !== undefined) {
      if (!Array.isArray(value.options)) throw new Error('Project contains invalid select options.')
      value.options.forEach(option => { if (!option || typeof option !== 'object' || typeof option.label !== 'string' || typeof option.value !== 'string') throw new Error('Project contains an invalid select option.') })
    }
    if (value.default_values !== undefined) {
      if (!Array.isArray(value.default_values)) throw new Error('Project contains invalid default selections.')
      value.default_values.forEach(entry => { if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !['user','role','channel'].includes(entry.type)) throw new Error('Project contains an invalid default selection.') })
    }
    if (value.channel_types !== undefined && (!Array.isArray(value.channel_types) || value.channel_types.some(entry => typeof entry !== 'number'))) throw new Error('Project contains invalid channel types.')
    if (value.content !== undefined && typeof value.content !== 'string') throw new Error('Project contains invalid text content.')
  }
  project.components.forEach(check)
  return project
}

export function discordJsCode(project: Project, assets: Asset[]): string {
  const local = usedAssets(project, assets)
  const importLine = local.length ? 'AttachmentBuilder, ' : ''
  const fileLines = local.map(asset => `    new AttachmentBuilder('./assets/${asset.id}-${safeFilename(asset.name)}', { name: ${JSON.stringify(asset.name)} }),`).join('\n')
  const components = JSON.stringify(toPayload(project).components, null, 2).replace(/\n/g, '\n    ')
  return `import { ${importLine}MessageFlags, type TextChannel } from 'discord.js';\n\nexport async function sendMessage(channel: TextChannel) {\n  await channel.send({\n    flags: MessageFlags.IsComponentsV2,\n    components: ${components},${local.length ? `\n    files: [\n${fileLines}\n    ],` : ''}\n  });\n}\n`
}
