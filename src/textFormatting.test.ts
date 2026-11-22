import { describe, expect, it } from 'vitest'
import { normalizeSingleTildes, toggleCodeBlock, toggleMarkers } from './textFormatting'
import { renderDiscordMarkdown } from './markdown'

describe('text formatting', () => {
  it('toggles markers around a selected span without stacking them', () => {
    const bold = toggleMarkers('hello', { start: 0, end: 5 }, '**')
    expect(bold.content).toBe('**hello**')
    expect(toggleMarkers(bold.content, bold.selection, '**').content).toBe('hello')
    expect(toggleMarkers('__hello__', { start: 0, end: 9 }, '__').content).toBe('hello')
  })

  it('converts paired single tildes to Discord strikethrough syntax', () => {
    const result = normalizeSingleTildes('~hello~', { start: 7, end: 7 })
    expect(result).toEqual({ content: '~~hello~~', selection: { start: 9, end: 9 } })
    expect(renderDiscordMarkdown(result.content)).toContain('<s>hello</s>')
  })

  it('places fenced code on its own lines', () => {
    expect(toggleCodeBlock('before code after', { start: 7, end: 11 }).content).toBe('before \n```\ncode\n```\n after')
  })
})
