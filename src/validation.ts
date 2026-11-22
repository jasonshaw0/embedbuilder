import { SELECT_TYPES, TYPE_NAMES, walk, type Asset, type Issue, type Media, type Node, type NodeType, type Project } from './model'

const urlOkay = (value: string) => { try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false } }

export function validateProject(project: Project, assets: Asset[]): Issue[] {
  const issues: Issue[] = []
  const add = (node: Node | undefined, message: string, level: Issue['level'] = 'error') => issues.push({ uid: node?.uid, message, level })
  const assetIds = new Set(assets.map(asset => asset.id))
  const customIds = new Map<string, string>()
  const apiIds = new Set<number>()
  let count = 0
  const checkMedia = (node: Node, media: Media | undefined, label: string, attachmentOnly = false) => {
    if (!media?.url) { add(node, `${label} needs a URL or local file.`); return }
    if (media.assetId) {
      if (!assetIds.has(media.assetId)) add(node, `${label} references a missing local file.`)
    } else if (media.url.startsWith('attachment://')) {
      add(node, `${label} needs its referenced file attached locally.`)
    } else if (attachmentOnly || !urlOkay(media.url)) {
      add(node, attachmentOnly ? `${label} must use a local attachment.` : `${label} needs an HTTPS or HTTP URL.`)
    }
  }
  const checkInteractive = (node: Node) => {
    const id = node.custom_id || ''
    if (!id || id.length > 100) add(node, 'Custom ID must be 1–100 characters.')
    else if (customIds.has(id)) add(node, `Custom ID “${id}” is used more than once.`)
    else customIds.set(id, node.uid)
  }
  const checkNode = (node: Node, parent?: NodeType) => {
    count++
    const valid = parent === undefined ? [1, 9, 10, 12, 13, 14, 17] : parent === 17 ? [1, 9, 10, 12, 13, 14] : parent === 9 ? [10, 2, 11] : parent === 1 ? [2, 3, 5, 6, 7, 8] : []
    if (!valid.includes(node.type)) add(node, `${TYPE_NAMES[node.type]} cannot be placed here.`)
    if (node.apiId !== undefined) {
      if (!Number.isInteger(node.apiId) || node.apiId < 0 || node.apiId > 0xffffffff) add(node, 'Component ID must be a 32-bit unsigned integer.')
      else if (node.apiId !== 0 && apiIds.has(node.apiId)) add(node, `Component ID ${node.apiId} is duplicated.`)
      apiIds.add(node.apiId)
    }
    switch (node.type) {
      case 1: {
        const children = node.components || []
        if (!children.length) add(node, 'Action row needs buttons or one select.')
        const selects = children.filter(child => SELECT_TYPES.includes(child.type))
        if (selects.length && children.length !== 1) add(node, 'A select must be alone in its action row.')
        if (!selects.length && children.length > 5) add(node, 'Action row allows at most 5 buttons.')
        break
      }
      case 2:
        if (!Number.isInteger(node.style) || (node.style || 0) < 1 || (node.style || 0) > 6) add(node, 'Choose a valid button style.')
        if (!(node.label || node.emoji?.name)) add(node, 'Button needs a label, an emoji, or both.')
        if ((node.label || '').length > 80) add(node, 'Button label must be at most 80 characters.')
        if (node.style === 5) { if (!node.url || !urlOkay(node.url) || node.url.length > 512) add(node, 'Link button needs a valid URL of at most 512 characters.') }
        else if (node.style === 6) { if (!/^\d+$/.test(node.sku_id || '')) add(node, 'Premium button needs a numeric SKU ID.') }
        else checkInteractive(node)
        break
      case 3:
        checkInteractive(node)
        if (!node.options?.length || node.options.length > 25) add(node, 'String select needs 1–25 options.')
        node.options?.forEach((option, index) => {
          if (!option.label || option.label.length > 100 || !option.value || option.value.length > 100) add(node, `Option ${index + 1} needs a label and value of at most 100 characters.`)
          if ((option.description || '').length > 100) add(node, `Option ${index + 1} description is too long.`)
        })
        break
      case 5: case 6: case 7: case 8: checkInteractive(node); break
      case 9:
        if (!node.components?.length || node.components.length > 3) add(node, 'Section needs 1–3 text displays.')
        if (!node.accessory || ![2, 11].includes(node.accessory.type)) add(node, 'Section needs a button or thumbnail accessory.')
        break
      case 10: if (!node.content?.trim()) add(node, 'Text display cannot be empty.'); break
      case 11: checkMedia(node, node.media, 'Thumbnail'); if ((node.description || '').length > 1024) add(node, 'Thumbnail description must be at most 1024 characters.'); break
      case 12:
        if (!node.items?.length || node.items.length > 10) add(node, 'Media gallery needs 1–10 items.')
        node.items?.forEach((item, index) => { checkMedia(node, item.media, `Gallery item ${index + 1}`); if ((item.description || '').length > 1024) add(node, `Gallery item ${index + 1} description must be at most 1024 characters.`) })
        break
      case 13: checkMedia(node, node.file, 'File', true); break
      case 14: if (node.spacing !== undefined && ![1, 2].includes(node.spacing)) add(node, 'Separator spacing must be small or large.'); break
      case 17:
        if (!node.components?.length) add(node, 'Container needs at least one component.')
        if (node.accent_color !== undefined && (!Number.isInteger(node.accent_color) || node.accent_color < 0 || node.accent_color > 0xffffff)) add(node, 'Accent color must be a valid RGB color.')
        break
    }
    if (SELECT_TYPES.includes(node.type)) {
      if ((node.placeholder || '').length > 150) add(node, 'Select placeholder must be at most 150 characters.')
      const max = node.type === 3 ? Math.min(node.options?.length || 0, 25) : 25
      if (node.min_values !== undefined && (node.min_values < 0 || node.min_values > max)) add(node, 'Minimum selections are out of range.')
      if (node.max_values !== undefined && (node.max_values < 1 || node.max_values > max || node.max_values < (node.min_values ?? 1))) add(node, 'Maximum selections are out of range.')
    }
    node.components?.forEach(child => checkNode(child, node.type))
    if (node.accessory) checkNode(node.accessory, node.type)
  }
  project.components.forEach(node => checkNode(node))
  if (!project.components.length) add(undefined, 'Add at least one component to export.')
  if (count > 40) add(undefined, `Message has ${count} components; Discord allows at most 40.`)
  const filenames = new Set<string>()
  for (const asset of usedAssets(project, assets)) {
    if (filenames.has(asset.name)) add(undefined, `Two local files are named “${asset.name}”; attachment filenames must be unique.`)
    filenames.add(asset.name)
  }
  return issues
}

export function usedAssets(project: Project, assets: Asset[]): Asset[] {
  const ids = new Set<string>()
  walk(project.components, node => {
    if (node.media?.assetId) ids.add(node.media.assetId)
    if (node.file?.assetId) ids.add(node.file.assetId)
    node.items?.forEach(item => { if (item.media.assetId) ids.add(item.media.assetId) })
  })
  return assets.filter(asset => ids.has(asset.id))
}
