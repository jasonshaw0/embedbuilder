import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import path from 'node:path'
import { exampleProject, fromPayload, makeNode, toPayload, type Asset, type Project } from './model'
import { discordJsCode, exportBundle, importBundle } from './storage'
import { validateProject } from './validation'
import { renderDiscordMarkdown } from './markdown'

describe('Discord message export', () => {
  it('round trips a nested Components V2 message without dropping fields', () => {
    const project = exampleProject()
    expect(validateProject(project, [])).toEqual([])
    const payload = toPayload(project)
    expect(payload.flags).toBe(32768)
    expect(toPayload(fromPayload(payload))).toEqual(payload)
  })

  it('catches invalid nesting, duplicate custom IDs, and the global component limit', () => {
    const first = makeNode(2)
    const second = makeNode(2)
    second.custom_id = first.custom_id
    const invalid: Project = { version: 1, name: 'Invalid', components: [first, second, ...Array.from({ length: 39 }, () => makeNode(10))] }
    const messages = validateProject(invalid, []).map(issue => issue.message)
    expect(messages).toContain('Button cannot be placed here.')
    expect(messages.some(message => message.includes('used more than once'))).toBe(true)
    expect(messages.some(message => message.includes('at most 40'))).toBe(true)
  })

  it('keeps local attachments with a portable project and matches generated paths', async () => {
    const file = makeNode(13)
    const asset: Asset = { id: 'asset-1', name: 'guide.pdf', type: 'application/pdf', blob: new Blob(['guide'], { type: 'application/pdf' }) }
    file.file = { url: asset.name, assetId: asset.id }
    const project: Project = { version: 1, name: 'With file', components: [file] }
    expect(validateProject(project, [asset])).toEqual([])
    const code = discordJsCode(project, [asset])
    expect(code).toContain("./assets/asset-1-guide.pdf")
    expect(code).toContain('MessageFlags.IsComponentsV2')
    for (const sample of [code, discordJsCode(exampleProject(), [])]) {
      const filename = path.resolve(process.cwd(), 'generated-code.ts')
      const virtual = (name: string) => name.replace(/\\/g, '/').toLowerCase() === filename.replace(/\\/g, '/').toLowerCase()
      const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, skipLibCheck: true, noEmit: true }
      const host = ts.createCompilerHost(compilerOptions)
      const originalFileExists = host.fileExists.bind(host)
      const originalReadFile = host.readFile.bind(host)
      host.fileExists = name => virtual(name) || originalFileExists(name)
      host.readFile = name => virtual(name) ? sample : originalReadFile(name)
      const originalGetSourceFile = host.getSourceFile.bind(host)
      host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) => virtual(name) ? ts.createSourceFile(name, sample, ts.ScriptTarget.ES2022, true) : originalGetSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile)
      const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([filename], compilerOptions, host))
      expect(diagnostics.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n'))).toEqual([])
    }
    const blob = await exportBundle(project, [asset])
    const imported = await importBundle(new File([blob], 'project.zip'))
    expect(toPayload(imported.project)).toEqual(toPayload(project))
    expect(await imported.assets[0].blob.text()).toBe('guide')
  })
})

describe('preview formatting', () => {
  it('renders Discord spoilers and underline while escaping message HTML', () => {
    const html = renderDiscordMarkdown('__underlined__ ||hidden|| <script>alert(1)</script>')
    expect(html).toContain('<u>underlined</u>')
    expect(html).toContain('class="discord-spoiler"')
    expect(html).not.toContain('<script>')
  })
})
