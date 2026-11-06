export interface AsciiEntry {
  decimal: number
  hex: string
  character: string
  description: string
  isDigit: boolean
}

function getAsciiDescription(dec: number, char: string, isDigit: boolean): string {
  if (dec === 32) return 'Space'
  if (isDigit) return `Digit '${char}'`
  if (dec >= 65 && dec <= 90) return `Uppercase letter '${char}'`
  if (dec >= 97 && dec <= 122) return `Lowercase letter '${char}'`
  return `Punctuation / symbol '${char}'`
}

/**
 * Printable ASCII table entries (32 through 126)
 */
export const ASCII_TABLE: AsciiEntry[] = Array.from({ length: 95 }, (_, i) => {
  const dec = i + 32
  const hex = dec.toString(16).toUpperCase().padStart(2, '0')
  const char = String.fromCharCode(dec)
  const isDigit = dec >= 48 && dec <= 57
  const description = getAsciiDescription(dec, char, isDigit)

  return {
    decimal: dec,
    hex,
    character: char,
    description,
    isDigit,
  }
})

/**
 * Look up ASCII character from hex string (e.g. "34" -> "4")
 */
export function lookupHex(hexStr: string): AsciiEntry | undefined {
  const clean = hexStr.trim().replace(/^0x/i, '').toUpperCase()
  return ASCII_TABLE.find((entry) => entry.hex === clean)
}
