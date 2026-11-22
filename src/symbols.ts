export const SYMBOLS: Record<string, string[]> = {
  'Separators': ['•','·','∙','⋅','∘','◆','◇','✦','✧','✶','✷','❖','❘','❙','❚','│','┃','┆','┊','╎','╏','━','─','═','⸻','⁃','※','⁂','⋆','★','☆'],
  'Arrows': ['→','←','↑','↓','↔','↕','↗','↘','↙','↖','⇒','⇐','⇑','⇓','⇢','⇠','⟶','⟵','➜','➤','➔','➙','➝','➞','➟','➠','⤷','↳','↪','↩','⮕','➥'],
  'Bullets & lists': ['•','◦','▪','▫','▸','▹','▾','▿','►','▻','▶','▷','◉','◎','○','●','◌','☐','☑','☒','✓','✔','✕','✖','⊳','➢','➣','❯'],
  'Borders & corners': ['─','━','│','┃','┌','┐','└','┘','┏','┓','┗','┛','├','┤','┬','┴','┼','╭','╮','╰','╯','╔','╗','╚','╝','═','║','╠','╣','╦','╩','╬'],
  'Shapes': ['■','□','▣','▤','▥','▦','▧','▨','▩','▲','△','▼','▽','◆','◇','◈','⬢','⬡','⬟','⬠','●','◯','◐','◑','◒','◓','◖','◗','◕','◔'],
  'Decorative': ['✦','✧','✩','✪','✫','✬','✭','✮','✯','✰','❀','✿','❁','❃','❋','✾','❈','❉','❊','❥','♡','♥','❦','❧','☼','☾','☽','♢','♧','♤','♠','♣','♦','∞'],
  'Status': ['✓','✔','✗','✘','✕','☑','☒','⚠','ℹ','ⓘ','●','○','◉','⊙','◌','◐','◑','⏳','⌛','⌚','⏱','⏰','🔒','🔓','⚡','☁','☀','★','☆','✚'],
  'Math & logic': ['±','×','÷','≈','≠','≤','≥','≡','∈','∉','∋','∅','∞','∑','∏','√','∛','∂','∆','∇','∫','∬','∮','∧','∨','¬','⊕','⊗','⊆','⊇','∴','∵','∝','∠'],
  'Currency & units': ['$','€','£','¥','₹','₩','₿','¢','¤','₽','₺','₴','°','℃','℉','µ','‰','‱','′','″','℅','№','℮','™','®','©'],
  'Cards & music': ['♠','♣','♥','♦','♤','♧','♡','♢','♩','♪','♫','♬','♭','♮','♯','𝄞','𝄢','✩','✪'],
}

const styledRanges: Record<string, { upper: number; lower: number; digits?: number }> = {
  'Bold': { upper: 0x1d400, lower: 0x1d41a, digits: 0x1d7ce },
  'Italic': { upper: 0x1d434, lower: 0x1d44e },
  'Bold italic': { upper: 0x1d468, lower: 0x1d482 },
  'Sans bold': { upper: 0x1d5d4, lower: 0x1d5ee, digits: 0x1d7ec },
  'Sans italic': { upper: 0x1d608, lower: 0x1d622 },
  'Monospace': { upper: 0x1d670, lower: 0x1d68a, digits: 0x1d7f6 },
  'Fullwidth': { upper: 0xff21, lower: 0xff41, digits: 0xff10 },
}
export const STYLE_NAMES = Object.keys(styledRanges)
export function plainText(text: string): string {
  return Array.from(text).map(char => {
    const code = char.codePointAt(0)!
    for (const range of Object.values(styledRanges)) {
      if (code >= range.upper && code < range.upper + 26) return String.fromCharCode(65 + code - range.upper)
      if (code >= range.lower && code < range.lower + 26) return String.fromCharCode(97 + code - range.lower)
      if (range.digits && code >= range.digits && code < range.digits + 10) return String.fromCharCode(48 + code - range.digits)
    }
    return char
  }).join('')
}
export function styleText(text: string, style: string): string {
  const ranges = styledRanges[style]
  if (!ranges) return text
  return Array.from(text).map(char => {
    const code = char.charCodeAt(0)
    if (code >= 65 && code <= 90) return String.fromCodePoint(ranges.upper + code - 65)
    if (code >= 97 && code <= 122) return String.fromCodePoint(ranges.lower + code - 97)
    if (ranges.digits && code >= 48 && code <= 57) return String.fromCodePoint(ranges.digits + code - 48)
    return char
  }).join('')
}
