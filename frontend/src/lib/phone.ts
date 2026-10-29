/**
 * Client-side mirror of backend `App\Support\SyrianPhone` — used only for instant feedback;
 * the server normalizes and validates again.
 */
const ARABIC_INDIC = /[٠-٩۰-۹]/g

export function toLatinDigits(value: string): string {
  return value.replace(ARABIC_INDIC, (d) => {
    const code = d.charCodeAt(0)
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660)
  })
}

export function isSyrianMobile(input: string): boolean {
  const value = toLatinDigits(input.trim())
  if (!/^\+?[0-9\s\-().]+$/.test(value)) return false
  const digits = value.replace(/\D/g, '')
  return /^(?:00963|963|0)?9\d{8}$/.test(digits)
}
