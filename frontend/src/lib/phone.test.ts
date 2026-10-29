import { describe, expect, it } from 'vitest'
import { isSyrianMobile, toLatinDigits } from './phone'

describe('phone', () => {
  it.each(['0944123456', '0944 123 456', '+963 944-123-456', '00963944123456', '944123456', '٠٩٤٤١٢٣٤٥٦'])(
    'accepts %s',
    (value) => expect(isSyrianMobile(value)).toBe(true),
  )

  it.each(['0112223344', '+447700900123', '094412345', '09441234567', 'abc', ''])('rejects %s', (value) =>
    expect(isSyrianMobile(value)).toBe(false),
  )

  it('converts Arabic-Indic and Persian digits', () => {
    expect(toLatinDigits('٠١٢٣٤٥٦٧٨٩ ۰۹')).toBe('0123456789 09')
  })
})
