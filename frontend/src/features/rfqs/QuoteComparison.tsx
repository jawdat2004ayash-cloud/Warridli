import { useEffect, useRef, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmationPanel } from '../../components/ui/ConfirmationPanel'
import { Icon } from '../../components/ui/Icon'
import { Money } from '../../components/ui/Money'
import { Notice } from '../../components/ui/Notice'
import { EmptyState, SkeletonCard } from '../../components/ui/States'
import { formatDate, formatNumber } from '../../lib/format'
import { BUYER_FULFILLMENT_LABELS, isClosable, UNIT_LABELS, type BuyerQuote, type Rfq, type SupplierContact } from '../../lib/rfqs'
import { CONDITION_LABELS, daysLabel } from '../../lib/supplier'
import { useRevealContact, useRfqQuotes, useSelectQuote } from './hooks'
import styles from './QuoteComparison.module.css'

type SortKey = 'price' | 'fastest' | 'newest'

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'price', label: 'الأرخص أولاً' },
  { value: 'fastest', label: 'الأسرع توفراً' },
  { value: 'newest', label: 'الأحدث' },
]

/** Prices are compared within one currency only (D3): SYP group first, then USD. */
function sortQuotes(quotes: BuyerQuote[], key: SortKey): BuyerQuote[] {
  const byPrice = (a: BuyerQuote, b: BuyerQuote) => a.currency.localeCompare(b.currency) || Number(a.unit_price) - Number(b.unit_price)
  const days = (q: BuyerQuote) => (q.stock_status === 'in_stock' ? 0 : q.lead_time_days)
  return [...quotes].sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1 // the chosen one always on top
    if (a.price_expired !== b.price_expired) return a.price_expired ? 1 : -1 // stale prices last
    if (key === 'fastest') return days(a) - days(b) || byPrice(a, b)
    if (key === 'newest') return b.updated_at.localeCompare(a.updated_at)
    return byPrice(a, b)
  })
}

/** Lowest valid unit price per currency. */
function cheapestIds(quotes: BuyerQuote[]): Set<number> {
  const best = new Map<string, BuyerQuote>()
  for (const q of quotes) {
    if (q.price_expired) continue
    const current = best.get(q.currency)
    if (!current || Number(q.unit_price) < Number(current.unit_price)) best.set(q.currency, q)
  }
  return new Set([...best.values()].map((q) => q.id))
}

function ContactBox({ rfq, quote }: { rfq: Rfq; quote: BuyerQuote }) {
  const reveal = useRevealContact(rfq.id)
  const [contact, setContact] = useState<SupplierContact | null>(null)
  const contactRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (contact) contactRef.current?.focus()
  }, [contact])

  if (contact) {
    return (
      <section ref={contactRef} className={styles.contact} tabIndex={-1} aria-label="بيانات التواصل مع المورّد">
        <p className={styles.contactPhone}>
          رقم المورّد: <bdi dir="ltr" className="num">{contact.phone}</bdi>
        </p>
        <a href={contact.whatsapp_url} target="_blank" rel="noopener noreferrer" className={styles.whatsapp}>
          <Icon name="whatsapp" size={20} />
          افتح المحادثة في واتساب
          <span className="visually-hidden"> (في نافذة جديدة)</span>
        </a>
      </section>
    )
  }

  return (
    <div className={styles.contact}>
      <Button variant="secondary" icon={<Icon name="whatsapp" size={18} />} loading={reveal.isPending} onClick={() => reveal.mutate(quote.id, { onSuccess: setContact })}>
        أظهر رقم واتساب المورّد
      </Button>
      {reveal.isError && <p className={styles.error} role="alert">{reveal.error.message}</p>}
    </div>
  )
}

type CardProps = {
  rfq: Rfq
  quote: BuyerQuote
  cheapest: boolean
  confirming: boolean
  onConfirm: (open: boolean) => void
}

function QuoteCard({ rfq, quote, cheapest, confirming, onConfirm }: CardProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const select = useSelectQuote(rfq.id)
  const unit = Number(quote.unit_price)
  const closable = isClosable(rfq)
  const canContact = closable || quote.selected
  const titleId = `quote-${quote.id}-title`

  return (
    <article className={styles.card} data-selected={quote.selected ? '' : undefined} data-expired={quote.price_expired ? '' : undefined} aria-labelledby={titleId}>
      <header className={styles.cardHead}>
        <div>
          <h3 id={titleId} className={styles.supplier}>
            {quote.supplier.name}
          </h3>
          <p className={styles.supplierArea}>
            <Icon name="store" size={14} /> مورّد موثّق · {quote.supplier.area.name}
          </p>
        </div>
        <span className={styles.badges}>
          {quote.selected && <Badge tone="ok">العرض الذي اخترته</Badge>}
          {cheapest && !quote.selected && <Badge tone="info">الأرخص</Badge>}
          {quote.price_expired && <Badge tone="danger">انتهت صلاحية السعر</Badge>}
        </span>
      </header>

      <div className={styles.price}>
        <p className={styles.unitPrice} data-long={formatNumber(unit).length > 12 ? '' : undefined}>
          <Money amount={unit} currency={quote.currency} />
          <span className={styles.per}> للقطعة</span>
        </p>
        <p className={styles.total}>
          المجموع لـ <span className="num">{rfq.quantity}</span> {UNIT_LABELS[rfq.unit]}: <strong><Money amount={unit * rfq.quantity} currency={quote.currency} /></strong>
        </p>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>الحالة</dt>
          <dd>{CONDITION_LABELS[quote.condition].label}</dd>
        </div>
        <div>
          <dt>التوفر</dt>
          <dd>{quote.stock_status === 'in_stock' ? 'متوفرة الآن' : `خلال ${daysLabel(quote.lead_time_days)}`}</dd>
        </div>
        <div>
          <dt>الاستلام</dt>
          <dd>{BUYER_FULFILLMENT_LABELS[quote.fulfillment]}</dd>
        </div>
        <div>
          <dt>السعر صالح حتى</dt>
          <dd>
            <time dateTime={quote.valid_until}>{formatDate(quote.valid_until)}</time>
          </dd>
        </div>
        {(quote.brand || quote.origin) && (
          <div>
            <dt>الماركة والمنشأ</dt>
            <dd>{[quote.brand, quote.origin].filter(Boolean).join(' · ')}</dd>
          </div>
        )}
        {quote.notes && (
          <div className={styles.wide}>
            <dt>ملاحظات المورّد</dt>
            <dd className={styles.notes}>{quote.notes}</dd>
          </div>
        )}
      </dl>

      {(canContact || closable) && (
        <footer className={styles.actions}>
          {canContact && <ContactBox rfq={rfq} quote={quote} />}

          {closable && !quote.price_expired && !confirming && (
            <Button ref={triggerRef} onClick={() => onConfirm(true)}>اختر هذا العرض</Button>
          )}
          {closable && quote.price_expired && (
            <p className={styles.hint}>لا يمكن اختيار سعر منتهي الصلاحية. تواصل مع المورّد ليجدده.</p>
          )}

          {confirming && (
            <ConfirmationPanel className={styles.confirm} labelledBy={`quote-${quote.id}-question`} pending={select.isPending} onCancel={() => onConfirm(false)} returnFocus={triggerRef}>
              <p id={`quote-${quote.id}-question`} className={styles.confirmText}>
                ستختار عرض «{quote.supplier.name}» بمجموع <strong><Money amount={unit * rfq.quantity} currency={quote.currency} /></strong>. سيُغلق
                الطلب، ولن تصل عروض جديدة، ولا يمكن تغيير الاختيار بعدها.
              </p>
              <div className={styles.confirmActions}>
                <Button loading={select.isPending} onClick={() => select.mutate(quote, { onSettled: () => onConfirm(false) })}>
                  نعم، اختر هذا العرض
                </Button>
                <Button variant="secondary" onClick={() => onConfirm(false)} disabled={select.isPending}>
                  تراجع
                </Button>
              </div>
            </ConfirmationPanel>
          )}
          {select.isError && <Notice focusOnMount tone="danger" title={select.error.message} />}
        </footer>
      )}
    </article>
  )
}

/**
 * The buyer's comparison of the quotes on their RFQ (M3c). The server decides what is visible and what may be
 * chosen/contacted; this only presents it and asks for confirmation before the irreversible choice.
 */
export function QuoteComparison({ rfq }: { rfq: Rfq }) {
  const quotes = useRfqQuotes(rfq.id)
  const [sort, setSort] = useState<SortKey>('price')
  const [confirming, setConfirming] = useState<number | null>(null)

  if (quotes.isPending) return <SkeletonCard />
  if (quotes.isError) {
    return (
      <EmptyState
        tone="danger"
        icon="alert"
        title="تعذّر تحميل العروض"
        description={quotes.error.message}
        action={<Button variant="secondary" onClick={() => void quotes.refetch()}>أعد المحاولة</Button>}
      />
    )
  }

  if (quotes.data.length === 0) {
    const waiting = rfq.status === 'pending_review'
      ? 'تصل العروض بعد أن تحدد الإدارة تصنيف طلبك ويُرسَل إلى المورّدين.'
      : rfq.accepts_quotes
        ? 'أرسلنا طلبك إلى المورّدين المختصين. ستظهر عروضهم هنا فور وصولها.'
        : 'انتهت مدة استقبال العروض دون أن يصل أي عرض.'
    return <EmptyState icon="clock" title="لم تصل عروض بعد" description={waiting} />
  }

  const sorted = sortQuotes(quotes.data, sort)
  const cheapest = cheapestIds(quotes.data)
  const currencies = new Set(quotes.data.map((q) => q.currency))

  return (
    <div className={styles.comparison}>
      <div className={styles.toolbar}>
        <p className={styles.count}>
          وصلك <span className="num">{quotes.data.length}</span> {quotes.data.length === 1 ? 'عرض' : 'عروض'}
        </p>
        <label className={styles.sort}>
          <span>رتّب حسب</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={styles.sortSelect}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {currencies.size > 1 && (
        <Notice tone="info" title="العروض بعملتين مختلفتين">قارن عروض الليرة السورية فيما بينها، وعروض الدولار فيما بينها.</Notice>
      )}

      <ul className={styles.list} aria-label="عروض الأسعار">
        {sorted.map((quote) => (
          <li key={quote.id}>
            <QuoteCard
              rfq={rfq}
              quote={quote}
              cheapest={cheapest.has(quote.id)}
              confirming={confirming === quote.id}
              onConfirm={(open) => setConfirming(open ? quote.id : null)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
