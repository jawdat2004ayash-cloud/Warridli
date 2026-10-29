import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { RfqStatusBadge, UrgencyBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmationPanel } from '../../components/ui/ConfirmationPanel'
import { PartTag } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { Money } from '../../components/ui/Money'
import { Notice } from '../../components/ui/Notice'
import { EmptyState, SkeletonCard } from '../../components/ui/States'
import { useSupplierRfq, useWithdrawQuote } from '../../features/supplier/hooks'
import { QuoteForm } from '../../features/supplier/QuoteForm'
import { ApiError } from '../../lib/api'
import { formatDate, formatNumber } from '../../lib/format'
import { UNIT_LABELS } from '../../lib/rfqs'
import { CONDITION_LABELS, daysLabel, FULFILLMENT_LABELS, STOCK_LABELS, type Quote, type SupplierRfq } from '../../lib/supplier'
import authStyles from '../auth/AuthPage.module.css'
import rfqStyles from '../rfqs/Rfq.module.css'
import styles from './Supplier.module.css'

type Outcome = 'sent' | 'updated' | 'withdrawn' | null

function QuoteSummary({ quote, rfq }: { quote: Quote; rfq: SupplierRfq }) {
  const unit = Number(quote.unit_price)
  return (
    <dl className={authStyles.facts}>
      <div className={authStyles.fact}>
        <dt>سعر القطعة</dt>
        <dd>
          <Money amount={unit} currency={quote.currency} />
        </dd>
      </div>
      <div className={authStyles.fact}>
        <dt>المجموع</dt>
        <dd>
          <Money amount={unit * rfq.quantity} currency={quote.currency} /> لـ <span className="num">{rfq.quantity}</span> {UNIT_LABELS[rfq.unit]}
        </dd>
      </div>
      <div className={authStyles.fact}>
        <dt>الحالة والتوفر</dt>
        <dd>
          {CONDITION_LABELS[quote.condition].label} ·{' '}
          {quote.stock_status === 'in_stock' ? STOCK_LABELS.in_stock.label : `تتوفر خلال ${daysLabel(quote.lead_time_days)}`}
        </dd>
      </div>
      <div className={authStyles.fact}>
        <dt>الاستلام</dt>
        <dd>{FULFILLMENT_LABELS[quote.fulfillment]}</dd>
      </div>
      <div className={authStyles.fact}>
        <dt>صالح حتى</dt>
        <dd>
          <time dateTime={quote.valid_until}>{formatDate(quote.valid_until)}</time>
        </dd>
      </div>
      {(quote.brand || quote.origin) && (
        <div className={authStyles.fact}>
          <dt>الماركة والمنشأ</dt>
          <dd>{[quote.brand, quote.origin].filter(Boolean).join(' · ')}</dd>
        </div>
      )}
      {quote.notes && (
        <div className={authStyles.fact}>
          <dt>ملاحظاتك</dt>
          <dd className={styles.preLine}>{quote.notes}</dd>
        </div>
      )}
    </dl>
  )
}

function QuotePanel({ rfq }: { rfq: SupplierRfq }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>(null)
  const withdraw = useWithdrawQuote(rfq.id)
  const quote = rfq.my_quote

  const outcomeNotice =
    outcome === 'sent' ? (
      <Notice focusOnMount tone="ok" title="تم إرسال عرضك.">يرى المشتري عرضك مع العروض الأخرى، وإذا اختاره يتواصل معك عبر واتساب.</Notice>
    ) : outcome === 'updated' ? (
      <Notice focusOnMount tone="ok" title="تم حفظ التعديل على عرضك." />
    ) : outcome === 'withdrawn' ? (
      <Notice focusOnMount tone="info" title="سحبت عرضك. لم يعد يظهر للمشتري." />
    ) : null

  if (quote?.selected) {
    return (
      <>
        <Notice tone="ok" title="اختار المشتري عرضك.">سيتواصل معك المشتري عبر واتساب على رقم محلك لترتيب الاستلام والدفع.</Notice>
        <QuoteSummary quote={quote} rfq={rfq} />
      </>
    )
  }

  if (!rfq.accepts_quotes) {
    return (
      <>
        <Notice tone="info" title="هذا الطلب لم يعد يستقبل عروضاً">أُلغي الطلب أو أُغلق أو انتهت مدته، فلا يمكن إرسال عرض أو تعديله.</Notice>
        {quote && <QuoteSummary quote={quote} rfq={rfq} />}
      </>
    )
  }

  if (!quote || editing) {
    return (
      <>
        {quote?.status === 'withdrawn' && !editing && <Notice tone="info" title="سحبت عرضك سابقاً. يمكنك إرسال عرض جديد." />}
        <QuoteForm
          rfq={rfq}
          onDone={() => {
            setOutcome(quote?.status === 'submitted' ? 'updated' : 'sent')
            setEditing(false)
          }}
          onCancel={editing ? () => setEditing(false) : undefined}
        />
      </>
    )
  }

  if (quote.status === 'withdrawn') {
    return (
      <>
        {outcomeNotice ?? <Notice tone="info" title="سحبت عرضك على هذا الطلب." />}
        <Button onClick={() => { setOutcome(null); setEditing(true) }}>قدّم عرضاً من جديد</Button>
      </>
    )
  }

  return (
    <>
      {outcomeNotice}
      <h2 className={rfqStyles.sectionTitle}>عرضك المرسَل</h2>
      <QuoteSummary quote={quote} rfq={rfq} />
      {withdraw.isError && <Notice focusOnMount tone="danger" title={withdraw.error.message} />}
      {!confirming ? (
        <div className={rfqStyles.confirmActions}>
          <Button onClick={() => { setOutcome(null); setEditing(true) }}>عدّل العرض</Button>
          <Button ref={triggerRef} variant="secondary" onClick={() => setConfirming(true)}>
            اسحب العرض
          </Button>
        </div>
      ) : (
        <ConfirmationPanel className={rfqStyles.confirm} labelledBy="withdraw-question" pending={withdraw.isPending} onCancel={() => setConfirming(false)} returnFocus={triggerRef}>
          <p id="withdraw-question" className={rfqStyles.confirmText}>هل تريد سحب عرضك؟ لن يراه المشتري بعد السحب، ويمكنك إرسال عرض جديد ما دام الطلب مفتوحاً.</p>
          <div className={rfqStyles.confirmActions}>
            <Button
              variant="danger"
              loading={withdraw.isPending}
              onClick={() =>
                withdraw.mutate(undefined, {
                  onSuccess: () => setOutcome('withdrawn'),
                  onSettled: () => setConfirming(false),
                })
              }
            >
              نعم، اسحب العرض
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={withdraw.isPending}>
              تراجع
            </Button>
          </div>
        </ConfirmationPanel>
      )}
    </>
  )
}

export function SupplierRfqPage() {
  const { id = '' } = useParams()
  const rfq = useSupplierRfq(id)

  if (rfq.isPending) return <SkeletonCard />

  if (rfq.isError) {
    const missing = rfq.error instanceof ApiError && rfq.error.status === 404
    return (
      <EmptyState
        tone={missing ? 'neutral' : 'danger'}
        icon={missing ? 'box' : 'alert'}
        title={missing ? 'هذا الطلب غير متاح لك' : 'تعذّر تحميل الطلب'}
        description={missing ? 'ربما أُغلق أو أُلغي، أو أنه ليس ضمن تخصصاتك المعتمدة.' : rfq.error.message}
        action={missing ? <Link to="/supplier/rfqs">إلى الطلبات</Link> : <Button variant="secondary" onClick={() => void rfq.refetch()}>أعد المحاولة</Button>}
      />
    )
  }

  const data = rfq.data
  const photos = data.photos ?? []

  return (
    <div className={`${authStyles.page} ${authStyles.wide}`}>
      <Link to={data.my_quote ? '/supplier/rfqs?tab=quoted' : '/supplier/rfqs'} className={rfqStyles.back}>
        <Icon name="chevron" size={16} className={rfqStyles.backIcon} />
        الطلبات
      </Link>

      <section className={authStyles.sheet} aria-labelledby="srfq-title">
        <header className={authStyles.head}>
          <span className={rfqStyles.rowBadges}>
            {data.status !== 'open' && <RfqStatusBadge status={data.status} />}
            <UrgencyBadge urgency={data.urgency} />
          </span>
          <h1 id="srfq-title" className={rfqStyles.detailTitle}>
            {data.description}
          </h1>
          {data.part_number && <PartTag value={data.part_number} />}
        </header>

        <div className={authStyles.body}>
          {photos.length > 0 && (
            <ul className={rfqStyles.gallery} aria-label="صور القطعة">
              {photos.map((photo, index) => (
                <li key={photo.id}>
                  <a href={photo.url} target="_blank" rel="noreferrer" className={rfqStyles.galleryLink}>
                    <img src={photo.url} alt={`صورة القطعة ${index + 1}`} width={photo.width} height={photo.height} loading="lazy" className={rfqStyles.galleryImg} />
                    <span className="visually-hidden"> (تفتح بحجم كامل في نافذة جديدة)</span>
                  </a>
                </li>
              ))}
            </ul>
          )}

          <dl className={authStyles.facts}>
            <div className={authStyles.fact}>
              <dt>الكمية المطلوبة</dt>
              <dd>
                <span className="num">{formatNumber(data.quantity)}</span> {UNIT_LABELS[data.unit]}
              </dd>
            </div>
            <div className={authStyles.fact}>
              <dt>التصنيف</dt>
              <dd>{data.category?.name}</dd>
            </div>
            {(data.machine_make || data.machine_model) && (
              <div className={authStyles.fact}>
                <dt>الآلة</dt>
                <dd>
                  {data.machine_make}
                  {data.machine_make && data.machine_model && ' — '}
                  {data.machine_model && <bdi dir="ltr">{data.machine_model}</bdi>}
                </dd>
              </div>
            )}
            <div className={authStyles.fact}>
              <dt>منطقة المشتري</dt>
              <dd>{data.area.name}</dd>
            </div>
            <div className={authStyles.fact}>
              <dt>يستقبل العروض حتى</dt>
              <dd>
                <time dateTime={data.closes_at}>{formatDate(data.closes_at)}</time>
              </dd>
            </div>
          </dl>

          <p className={rfqStyles.groupHint}>
            لا نعرض اسم المشتري ولا رقمه. إذا اختار عرضك يتواصل معك هو عبر واتساب.
          </p>
        </div>

        <div className={`${authStyles.foot} ${styles.quoteArea}`}>
          <QuotePanel key={data.id} rfq={data} />
        </div>
      </section>
    </div>
  )
}
