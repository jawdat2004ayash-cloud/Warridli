/**
 * Arabic UI with Western (latn) digits — prices and part numbers are read and copied as Latin digits
 * in local trade. Times are stored in UTC and shown in Damascus time (D6b).
 */
const LOCALE = 'ar-SY-u-nu-latn'
const TIME_ZONE = 'Asia/Damascus'

/** D3 (pending founder confirmation): which Syrian pound is quoted must be explicit in the UI. */
export type Currency = 'SYP' | 'USD'

export const CURRENCY_LABELS: Record<Currency, string> = {
  SYP: 'ل.س',
  USD: 'دولار',
}

const numberFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

export function formatMoney(amount: number, currency: Currency): string {
  return `${formatNumber(amount)} ${CURRENCY_LABELS[currency]}`
}

const dateFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' })

export function formatDate(value: Date | string): string {
  return dateFormat.format(typeof value === 'string' ? new Date(value) : value)
}

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** Date and time in Damascus, e.g. for the audit trail. */
export function formatDateTime(value: Date | string): string {
  return dateTimeFormat.format(typeof value === 'string' ? new Date(value) : value)
}
