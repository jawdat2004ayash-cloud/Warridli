import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '../../components/ui/Button'
import { EmptyState, SkeletonCard } from '../../components/ui/States'
import { useMetrics } from '../../features/admin/hooks'
import { durationLabel, type Metrics, type MetricsPeriod } from '../../lib/admin'
import { formatDate, formatNumber } from '../../lib/format'
import styles from './Admin.module.css'

const PERIODS: { value: MetricsPeriod; label: string }[] = [
  { value: '7', label: 'آخر 7 أيام' },
  { value: '30', label: 'آخر 30 يوماً' },
  { value: '90', label: 'آخر 90 يوماً' },
  { value: 'all', label: 'منذ البداية' },
]

function QueueTile({ n, label, to, go }: { n: number; label: string; to: string; go: string }) {
  return (
    <li>
      <Link to={to} className={styles.queueTile} data-waiting={n > 0 ? '' : undefined}>
        <span className={`${styles.queueNumber} num`}>{formatNumber(n)}</span>
        <span className={styles.queueLabel}>{label}</span>
        <span className={styles.queueGo}>{n > 0 ? go : 'لا شيء بانتظارك'}</span>
      </Link>
    </li>
  )
}

function Figure({ label, definition, children }: { label: string; definition: string; children: ReactNode }) {
  return (
    <div className={styles.figure}>
      <dt>
        {label}
        <span className={styles.definition}>{definition}</span>
      </dt>
      <dd>{children}</dd>
    </div>
  )
}

const Num = ({ n }: { n: number }) => <span className="num">{formatNumber(n)}</span>

function Figures({ m }: { m: Metrics }) {
  const r = m.rfqs
  return (
    <dl className={styles.figures}>
      <Figure label="طلبات الأسعار المُرسلة" definition="كل الطلبات التي أنشأها المشترون خلال الفترة، بأي حالة.">
        <Num n={r.created} />
      </Figure>
      <Figure label="وصلت إلى المورّدين" definition="طلبات لها تصنيف (اختاره المشتري أو حدّدته الإدارة). لا تشمل المرفوضة ولا التي ما زالت بانتظار التصنيف.">
        <Num n={r.published} />
      </Figure>
      <Figure label="تلقّت عرض سعر واحداً على الأقل" definition="من الطلبات التي وصلت إلى المورّدين. يُحتسب العرض حتى لو سحبه المورّد لاحقاً.">
        {r.with_quote_rate === null ? (
          '—'
        ) : (
          <>
            <Num n={Math.round(r.with_quote_rate * 100)} />٪
            <span className={styles.small}>
              <Num n={r.with_quote} /> من <Num n={r.published} />
            </span>
          </>
        )}
      </Figure>
      <Figure label="الوقت حتى أول عرض (الوسيط)" definition="من لحظة إرسال المشتري للطلب حتى وصول أول عرض. نصف الطلبات أسرع من هذا الرقم ونصفها أبطأ.">
        {m.first_quote.median_minutes === null ? (
          '—'
        ) : (
          <>
            {durationLabel(m.first_quote.median_minutes)}
            <span className={styles.small}>
              محسوب على <Num n={m.first_quote.sample} /> طلب
            </span>
          </>
        )}
      </Figure>
      <Figure label="انتظار التصنيف (الوسيط)" definition="للطلبات التي اختار أصحابها «لا أعرف التصنيف»: من الإرسال حتى قرار الإدارة.">
        {m.triage.median_minutes === null ? (
          '—'
        ) : (
          <>
            {durationLabel(m.triage.median_minutes)}
            <span className={styles.small}>
              محسوب على <Num n={m.triage.sample} /> طلب
            </span>
          </>
        )}
      </Figure>
      <Figure label="اختار المشتري عرضاً" definition="طلبات أُغلقت باختيار أحد العروض.">
        <Num n={r.with_selection} />
      </Figure>
      <Figure label="إظهار رقم واتساب المورّد" definition="عدد مرات ضغط المشترين على «أظهر رقم واتساب المورّد» خلال الفترة.">
        <Num n={m.contacts.reveals} />
        <span className={styles.small}>
          على <Num n={m.contacts.rfqs} /> طلب
        </span>
      </Figure>
    </dl>
  )
}

export function AdminOverviewPage() {
  const [params] = useSearchParams()
  const period = (PERIODS.find((p) => p.value === params.get('period'))?.value ?? '30') as MetricsPeriod
  const metrics = useMetrics(period)

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>نظرة عامة</h1>
        <p className={styles.lead}>ما ينتظر قرارك الآن، وكيف تعمل المنصة خلال الفترة المختارة.</p>
      </header>

      {metrics.isPending && <SkeletonCard />}
      {metrics.isError && (
        <EmptyState
          tone="danger"
          icon="alert"
          title="تعذّر تحميل الأرقام"
          description={metrics.error.message}
          action={<Button variant="secondary" onClick={() => void metrics.refetch()}>أعد المحاولة</Button>}
        />
      )}

      {metrics.data && (
        <>
          <section aria-labelledby="queue-title" className={styles.page}>
            <h2 id="queue-title" className={styles.subhead}>
              بانتظار قرارك
            </h2>
            <ul className={styles.queue}>
              <QueueTile n={metrics.data.queue.suppliers_pending} label="مورّدون جدد بانتظار المراجعة" to="/admin/companies" go="راجعهم الآن" />
              <QueueTile n={metrics.data.queue.specialties_pending} label="تخصصات بانتظار الاعتماد" to="/admin/companies?view=specialties" go="راجعها الآن" />
              <QueueTile n={metrics.data.queue.rfqs_pending_review} label="طلبات بلا تصنيف" to="/admin/rfqs" go="صنّفها الآن" />
            </ul>
          </section>

          <section aria-labelledby="figures-title" className={styles.page}>
            <div className={styles.cardHead}>
              <h2 id="figures-title" className={styles.subhead}>
                أداء المنصة
              </h2>
              <nav className={styles.chips} aria-label="الفترة">
                {PERIODS.map((p) => (
                  <Link
                    key={p.value}
                    to={{ search: p.value === '30' ? '' : `?period=${p.value}` }}
                    className={styles.chip}
                    replace
                    aria-current={period === p.value ? 'page' : undefined}
                  >
                    {p.label}
                  </Link>
                ))}
              </nav>
            </div>
            <p className={styles.lead} aria-live="polite">
              {metrics.data.since ? <>الطلبات المُرسلة منذ {formatDate(metrics.data.since)}.</> : <>كل الطلبات منذ بداية المنصة.</>}{' '}
              الأرقام الصغيرة لا تكفي للحكم؛ انظر دائماً إلى عدد الطلبات المحسوب عليها.
            </p>
            <Figures m={metrics.data} />
          </section>
        </>
      )}
    </div>
  )
}
