import { Link, useSearchParams } from 'react-router'
import { UrgencyBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { EmptyState, SkeletonCard } from '../../components/ui/States'
import { useAdminRfqs } from '../../features/admin/hooks'
import { durationLabel } from '../../lib/admin'
import { formatNumber } from '../../lib/format'
import { UNIT_LABELS } from '../../lib/rfqs'
import rfqStyles from '../rfqs/Rfq.module.css'
import { Pager } from '../../components/ui/Pager'
import styles from './Admin.module.css'

const waited = (createdAt: string) => durationLabel((Date.now() - new Date(createdAt).getTime()) / 60_000)

export function AdminTriageListPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const rfqs = useAdminRfqs('pending_review', page)

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>طلبات بلا تصنيف</h1>
        <p className={styles.lead}>
          أصحاب هذه الطلبات لم يعرفوا نوع القطعة. افتح الطلب، انظر إلى الصور والوصف، واختر التصنيف ليصل إلى المورّدين المختصين. الأقدم أولاً.
        </p>
      </header>

      {rfqs.isPending && <SkeletonCard />}
      {rfqs.isError && (
        <EmptyState
          tone="danger"
          icon="alert"
          title="تعذّر تحميل الطلبات"
          description={rfqs.error.message}
          action={<Button variant="secondary" onClick={() => void rfqs.refetch()}>أعد المحاولة</Button>}
        />
      )}
      {rfqs.data && rfqs.data.data.length === 0 && (
        <EmptyState icon="check" title="لا توجد طلبات بانتظار التصنيف" description="كل الطلبات وصلت إلى المورّدين. تظهر هنا الطلبات الجديدة التي يختار أصحابها «لا أعرف التصنيف»." />
      )}
      {rfqs.data && rfqs.data.data.length > 0 && (
        <>
          <ul className={rfqStyles.list} aria-label="طلبات بانتظار التصنيف">
            {rfqs.data.data.map((rfq) => (
              <li key={rfq.id}>
                <Link to={`/admin/rfqs/${rfq.id}`} className={rfqStyles.row}>
                  <span className={rfqStyles.rowBadges}>
                    {rfq.urgency !== 'normal' && <UrgencyBadge urgency={rfq.urgency} />}
                    <span className={rfqStyles.rowMeta}>ينتظر منذ {waited(rfq.created_at)}</span>
                  </span>
                  <span className={rfqStyles.rowTitle}>{rfq.description}</span>
                  <span className={rfqStyles.rowMeta}>
                    <span>{rfq.buyer.name}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      <span className="num">{formatNumber(rfq.quantity)}</span> {UNIT_LABELS[rfq.unit]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{rfq.area.name}</span>
                    {rfq.photos_count > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className={rfqStyles.rowPhotos}>
                          <Icon name="camera" size={16} />
                          <span className="num">{rfq.photos_count}</span>
                          <span className="visually-hidden"> صور</span>
                        </span>
                      </>
                    )}
                  </span>
                  <Icon name="chevron" size={18} className={rfqStyles.rowGo} />
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={page} lastPage={rfqs.data.meta.last_page} onPage={(p) => setParams(p > 1 ? { page: String(p) } : {})} />
        </>
      )}
    </div>
  )
}
