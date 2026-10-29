import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { RfqStatusBadge, UrgencyBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { PartTag } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { Notice } from '../../components/ui/Notice'
import { EmptyState, SkeletonCard } from '../../components/ui/States'
import { useToast } from '../../components/ui/toastContext'
import { ConfirmAction } from '../../features/admin/ConfirmAction'
import { useAdminCategories, useAdminRfq, useRejectRfq, useTriageRfq } from '../../features/admin/hooks'
import { suppliersLabel, type AdminRfq } from '../../lib/admin'
import { ApiError } from '../../lib/api'
import { formatDate, formatNumber } from '../../lib/format'
import { UNIT_LABELS } from '../../lib/rfqs'
import authStyles from '../auth/AuthPage.module.css'
import rfqStyles from '../rfqs/Rfq.module.css'
import styles from './Admin.module.css'

function Decision({ rfq }: { rfq: AdminRfq }) {
  const categories = useAdminCategories()
  const triage = useTriageRfq(rfq.id)
  const reject = useRejectRfq(rfq.id)
  const toast = useToast()
  const [choice, setChoice] = useState<number | null>(null)
  const [missing, setMissing] = useState(false)

  if (categories.isPending) return <SkeletonCard />
  if (categories.isError) return <Notice tone="danger" title="تعذّر تحميل التصنيفات">{categories.error.message}</Notice>

  const active = categories.data.filter((c) => c.is_active)
  const chosen = active.find((c) => c.id === choice)

  return (
    <div className={authStyles.body}>
      <fieldset className={styles.categoryChoices} aria-describedby={missing ? 'triage-missing' : undefined}>
        <legend className={authStyles.legend}>ما تصنيف هذه القطعة؟</legend>
        {active.map((c) => (
          <label key={c.id} className={styles.choice}>
            <input
              type="radio"
              name="category"
              className={styles.radio}
              checked={choice === c.id}
              onChange={() => {
                setChoice(c.id)
                setMissing(false)
              }}
            />
            <span className={styles.choiceText}>
              {c.name}
              <span className={styles.choiceHint} data-none={c.suppliers_count === 0 ? '' : undefined}>
                {suppliersLabel(c.suppliers_count)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {missing && (
        <p id="triage-missing" className={rfqStyles.error} role="alert">
          اختر التصنيف أولاً.
        </p>
      )}
      <p className={styles.rowSub}>
        التصنيف المناسب غير موجود؟ <Link to="/admin/categories">أضفه من صفحة التصنيفات</Link> ثم عُد إلى هذا الطلب.
      </p>

      {chosen ? (
        <ConfirmAction
          variant="primary"
          label="صنّف الطلب وأرسله للمورّدين"
          question={`سيصل الطلب إلى ${suppliersLabel(chosen.suppliers_count)} في «${chosen.name}»، ويبقى مفتوحاً للعروض 7 أيام من الآن.${chosen.suppliers_count === 0 ? ' تنبيه: لا يوجد مورّد معتمد في هذا التصنيف حالياً، فلن يصل أي عرض حتى تعتمد مورّداً فيه.' : ''}`}
          confirmLabel="نعم، أرسله"
          onConfirm={async () => {
            await triage.mutateAsync(chosen.id)
            toast({ tone: 'ok', title: 'تم تصنيف الطلب وإرساله للمورّدين.', description: chosen.name })
          }}
        />
      ) : (
        <Button variant="primary" onClick={() => setMissing(true)}>
          صنّف الطلب وأرسله للمورّدين
        </Button>
      )}

      <details className={styles.reject}>
        <summary className={styles.rejectSummary}>ليس طلب قطعة غيار؟ (إعلان، رسالة تجريبية، طلب مكرر)</summary>
        <ConfirmAction
          variant="danger"
          label="ارفض الطلب"
          question="لن يصل الطلب إلى أي مورّد، وسيرى المشتري أنه «مرفوض». لا يمكن التراجع عن الرفض."
          confirmLabel="نعم، ارفض الطلب"
          reason="required"
          reasonHint="مثال: إعلان وليس طلب قطعة. يُحفظ في سجل العمليات."
          onConfirm={async (reason) => {
            await reject.mutateAsync(reason ?? '')
            toast({ tone: 'ok', title: 'تم رفض الطلب.' })
          }}
        />
      </details>
    </div>
  )
}

function Outcome({ rfq }: { rfq: AdminRfq }) {
  if (rfq.status === 'open' && rfq.category) {
    return (
      <Notice tone="ok" title={`الطلب مصنّف في «${rfq.category.name}» ووصل إلى المورّدين.`}>
        يبقى مفتوحاً للعروض حتى {formatDate(rfq.closes_at)}. <Link to="/admin/rfqs">إلى الطلب التالي</Link>
      </Notice>
    )
  }
  if (rfq.status === 'rejected') {
    return (
      <Notice tone="info" title="هذا الطلب مرفوض.">
        السبب محفوظ في <Link to={`/admin/audit?group=rfq`}>سجل العمليات</Link>. <Link to="/admin/rfqs">إلى الطلب التالي</Link>
      </Notice>
    )
  }
  return <Notice tone="info" title="هذا الطلب لم يعد بانتظار التصنيف." />
}

export function AdminTriagePage() {
  const { id = '' } = useParams()
  const rfq = useAdminRfq(id)

  if (rfq.isPending) return <SkeletonCard />
  if (rfq.isError) {
    const missing = rfq.error instanceof ApiError && rfq.error.status === 404
    return (
      <EmptyState
        tone={missing ? 'neutral' : 'danger'}
        icon={missing ? 'box' : 'alert'}
        title={missing ? 'لم نجد هذا الطلب' : 'تعذّر تحميل الطلب'}
        description={missing ? 'ربما الرابط غير صحيح.' : rfq.error.message}
        action={missing ? <Link to="/admin/rfqs">إلى الطلبات بلا تصنيف</Link> : <Button variant="secondary" onClick={() => void rfq.refetch()}>أعد المحاولة</Button>}
      />
    )
  }

  const data = rfq.data
  const photos = data.photos ?? []

  return (
    <div className={styles.page}>
      <Link to="/admin/rfqs" className={rfqStyles.back}>
        <Icon name="chevron" size={16} className={rfqStyles.backIcon} />
        طلبات بلا تصنيف
      </Link>

      {data.status !== 'pending_review' && <Outcome rfq={data} />}

      <section className={authStyles.sheet} aria-labelledby="triage-title">
        <header className={authStyles.head}>
          <span className={rfqStyles.rowBadges}>
            <RfqStatusBadge status={data.status} />
            <UrgencyBadge urgency={data.urgency} />
          </span>
          <h1 id="triage-title" className={rfqStyles.detailTitle}>
            {data.description}
          </h1>
          {data.part_number && <PartTag value={data.part_number} />}
        </header>

        <div className={authStyles.body}>
          {photos.length > 0 ? (
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
          ) : (
            <p className={styles.rowSub}>لم يرفق المشتري صوراً.</p>
          )}

          <dl className={authStyles.facts}>
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
              <dt>المشتري</dt>
              <dd>
                {data.buyer.name} — <bdi dir="ltr">{data.buyer.whatsapp_phone}</bdi>
                <span className={styles.rowSub}> (اتصل به إن لم يكن الوصف كافياً)</span>
              </dd>
            </div>
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

        {data.status === 'pending_review' && <Decision rfq={data} />}
      </section>
    </div>
  )
}
