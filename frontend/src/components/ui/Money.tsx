import { CURRENCY_LABELS, formatNumber, type Currency } from '../../lib/format'

/**
 * Amount in the mono face, currency label in the Arabic face (the mono font has no Arabic glyphs).
 * Explicit RTL isolation keeps "14.5 دولار" in reading order inside tables and LTR contexts.
 */
export function Money({ amount, currency }: { amount: number; currency: Currency }) {
  return (
    <bdi dir="rtl">
      <span className="num">{formatNumber(amount)}</span> <span>{CURRENCY_LABELS[currency]}</span>
    </bdi>
  )
}
