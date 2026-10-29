import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { RfqStatusBadge, UrgencyBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmationPanel } from '../../components/ui/ConfirmationPanel'
import { PartTag } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { Notice } from '../../components/ui/Notice'
import { EmptyState, SkeletonCard } from '../../components/ui/States'
import { useFlash } from '../../features/auth/flash'
import { useCancelRfq, useCloseRfq, useRfq } from '../../features/rfqs/hooks'
import { QuoteComparison } from '../../features/rfqs/QuoteComparison'
import { ApiError } from '../../lib/api'
import { formatDate, formatNumber } from '../../lib/format'
import { isClosable, UNIT_LABELS, type Rfq } from '../../lib/rfqs'
import authStyles from '../auth/AuthPage.module.css'
import styles from './Rfq.module.css'

/** What the current status means for the buyer, in one sentence. */
function StatusExplanation({ rfq, justCreated }: { rfq: Rfq; justCreated: boolean }) {
  if (rfq.status === 'pending_review') {
    return (
      <Notice tone="warn" title={justCreated ? 'تم إرسال طلبك، وهو الآن قيد التصنيف.' : 'طلبك قيد التصنيف'}>
        لأنك اخترت «لا أعرف التصنيف»، تحدد إدارة ورّدلي نوع القطعة أولاً، ثم يصل الطلب إلى المورّدين المختصين.
      </Notice>
    )
  }
  if (rfq.status === 'open' && rfq.accepts_quotes) {
    return (
      <Notice tone={justCreated ? 'ok' : 'info'} title={justCreated ? 'تم إرسال طلبك بنجاح.' : 'طلبك مفتوح لعروض الأسعار'}>
        يصل الطلب إلى المورّدين المعتمدين في تصنيف «{rfq.category?.name}». يبقى مفتوحاً حتى {formatDate(rfq.closes_at)}.
      </Notice>
    )
  }
  if (rfq.status === 'open' || rfq.status === 'expired') {
    // closes_at passed (the scheduler may not have marked it expired yet): same meaning for the buyer.
    return (
      <Notice tone="info" title="انتهت مدة استقبال العروض">
        لن تصل عروض جديدة. يمكنك اختيار أحد العروض التي وصلتك، أو إغلاق الطلب إن لم يناسبك أي منها.
      </Notice>
    )
  }
  if (rfq.status === 'closed') {
    return rfq.selected_quote_id !== null ? (
      <Notice tone="ok" title="اخترت عرضاً وأغلقت الطلب.">تواصل مع المورّد عبر واتساب من بطاقة العرض لترتيب الاستلام والدفع مباشرة معه.</Notice>
    ) : (
      <Notice tone="info" title="أغلقت هذا الطلب دون اختيار عرض." />
    )
  }
  if (rfq.status === 'cancelled') return <Notice tone="info" title="ألغيت هذا الطلب. لن تصل إليه عروض جديدة." />
  return null
}

/** Cancel (nothing received yet) or close without choosing — one footer action, with confirmation. */
function EndRequest({ rfq }: { rfq: Rfq }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cancel = useCancelRfq()
  const close = useCloseRfq(rfq.id)
  const [confirming, setConfirming] = useState(false)

  const closeInstead = isClosable(rfq) && (rfq.quotes_count > 0 || !rfq.accepts_quotes)
  const cancellable = rfq.status === 'pending_review' || rfq.status === 'open'
  if (!closeInstead && !cancellable) return null

  const action = closeInstead ? close : cancel
  const copy = closeInstead
    ? { button: 'أغلق الطلب دون اختيار عرض', question: 'هل تريد إغلاق الطلب دون اختيار أي عرض؟ لن تصل عروض جديدة، ولا يمكن فتحه من جديد.', yes: 'نعم، أغلق الطلب' }
    : { button: 'إلغاء الطلب', question: 'هل تريد إلغاء هذا الطلب؟ لن يستطيع المورّدون إرسال عروض عليه بعد الإلغاء.', yes: 'نعم، ألغِ الطلب' }
  const run = () => (closeInstead ? close.mutate(undefined, { onSettled: () => setConfirming(false) }) : cancel.mutate(rfq.id, { onSettled: () => setConfirming(false) }))

  return (
    <footer className={authStyles.foot}>
      {action.isError && <Notice focusOnMount tone="danger" title={action.error.message} />}
      {!confirming ? (
        <Button ref={triggerRef} variant="secondary" onClick={() => setConfirming(true)}>
          {copy.button}
        </Button>
      ) : (
        <ConfirmationPanel className={styles.confirm} labelledBy="end-request-question" pending={action.isPending} onCancel={() => setConfirming(false)} returnFocus={triggerRef}>
          <p id="end-request-question" className={styles.confirmText}>{copy.question}</p>
          <div className={styles.confirmActions}>
            <Button variant="danger" loading={action.isPending} onClick={run}>
              {copy.yes}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={action.isPending}>
              تراجع
            </Button>
          </div>
        </ConfirmationPanel>
      )}
    </footer>
  )
}

export function RfqDetailPage() {
  const { id = '' } = useParams()
  const rfq = useRfq(id)
  const flash = useFlash()

  if (rfq.isPending) return <SkeletonCard />

  if (rfq.isError) {
    const missing = rfq.error instanceof ApiError && rfq.error.status === 404
    return (
      <EmptyState
        tone={missing ? 'neutral' : 'danger'}
        icon={missing ? 'box' : 'alert'}
        title={missing ? 'لم نجد هذا الطلب' : 'تعذّر تحميل الطلب'}
        description={missing ? 'ربما الرابط غير صحيح، أو أن الطلب ليس من طلبات منشأتك.' : rfq.error.message}
        action={missing ? <Link to="/rfqs">إلى طلباتي</Link> : <Button variant="secondary" onClick={() => void rfq.refetch()}>أعد المحاولة</Button>}
      />
    )
  }

  const data = rfq.data
  const photos = data.photos ?? []

  return (
    <div className={styles.detailPage}>
      <Link to="/rfqs" className={styles.back}>
        <Icon name="chevron" size={16} className={styles.backIcon} />
        طلباتي
      </Link>

      <StatusExplanation rfq={data} justCreated={flash === 'rfqCreated'} />

      <section className={authStyles.sheet} aria-labelledby="rfq-detail-title">
        <header className={authStyles.head}>
          <span className={styles.rowBadges}>
            <RfqStatusBadge status={data.status} />
            <UrgencyBadge urgency={data.urgency} />
          </span>
          <h1 id="rfq-detail-title" className={styles.detailTitle}>
            {data.description}
          </h1>
          {data.part_number && <PartTag value={data.part_number} />}
        </header>

        <div className={authStyles.body}>
          {photos.length > 0 && (
            <ul className={styles.gallery} aria-label="صور القطعة">
              {photos.map((photo, index) => (
                <li key={photo.id}>
                  <a href={photo.url} target="_blank" rel="noreferrer" className={styles.galleryLink}>
                    <img src={photo.url} alt={`صورة القطعة ${index + 1}`} width={photo.width} height={photo.height} loading="lazy" className={styles.galleryImg} />
                    <span className="visually-hidden"> (تفتح بحجم كامل في نافذة جديدة)</span>
                  </a>
                </li>
              ))}
            </ul>
          )}

          <dl className={authStyles.facts}>
            <div className={authStyles.fact}>
              <dt>التصنيف</dt>
              <dd>{data.category?.name ?? 'بانتظار التصنيف من الإدارة'}</dd>
            </div>
            <div className={authStyles.fact}>
              <dt>الكمية</dt>
              <dd>
                <span className="num">{formatNumber(data.quantity)}</span> {UNIT_LABELS[data.unit]}
              </dd>
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
              <dt>المنطقة</dt>
              <dd>{data.area.name}</dd>
            </div>
            <div className={authStyles.fact}>
              <dt>تاريخ الطلب</dt>
              <dd>
                <time dateTime={data.created_at}>{formatDate(data.created_at)}</time>
              </dd>
            </div>
          </dl>
        </div>

        <EndRequest rfq={data} />
      </section>

      <section aria-labelledby="quotes-title" className={styles.quotesSection}>
        <h2 id="quotes-title" className={styles.sectionTitle}>
          عروض الأسعار
        </h2>
        <QuoteComparison rfq={data} />
      </section>
    </div>
  )
}
