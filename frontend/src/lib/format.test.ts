import { describe, expect, it } from 'vitest'
import { formatDate, formatMoney } from './format'

describe('format', () => {
  it('uses Latin digits with an explicit currency label', () => {
    expect(formatMoney(120000, 'SYP')).toMatch(/^120[,٬]000 ل\.س$/)
    expect(formatMoney(14.5, 'USD')).toBe('14.5 دولار')
  })

  it('formats dates in Damascus time with Latin digits', () => {
    // 22:30 UTC on Oct 29 is already Oct 30 in Damascus (UTC+3)
    const text = formatDate('2026-10-29T22:30:00Z')
    expect(text).toContain('30')
    expect(text).toContain('2026')
    expect(text).not.toMatch(/[٠-٩]/)
  })
})
