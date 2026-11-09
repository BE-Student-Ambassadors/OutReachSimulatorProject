/**
 * Client-safe ASCII and Hexadecimal Cipher conversion helpers.
 */

export function combinationToHexAscii(code: string): string {
  return code
    .split('')
    .map((ch) => ch.charCodeAt(0).toString(16).toLowerCase())
    .join(' ')
}

export function hexAsciiToCombination(hex: string): string {
  return hex
    .trim()
    .split(/\s+/)
    .map((h) => String.fromCharCode(parseInt(h, 16)))
    .join('')
}
