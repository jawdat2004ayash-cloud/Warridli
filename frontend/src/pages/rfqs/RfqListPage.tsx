import { Link, useSearchParams } from 'react-router'
import { RfqStatusBadge, UrgencyBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { EmptyState, SkeletonCard } from '../../components/ui/States'
import { useRfqs } from '../../features/rfqs/hooks'
import { formatDate, formatNumber } from '../../lib/format'
import { UNIT_LABELS } from '../../lib/rfqs'
import styles from './Rfq.module.css'

export function RfqListPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const rfqs = useRfqs(page)

  const goTo = (next: number) => setParams(next === 1 ? {} : { page: String(next) })

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <p className={styles.kicker}>المشتري</p>
          <h1 className={styles.pageTitle}>طلباتي</h1>
        </div>
        <Link to="/rfqs/new" className={styles.primaryLink}>
          <Icon name="plus" size={18} />
          اطلب قطعة
        </Link>
      </header>

      {rfqs.isPending && (
        <div className={styles.list} aria-busy="true">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {rfqs.isError && (
        <EmptyState
          tone="danger"
          icon="alert"
          title="تعذّر تحميل طلباتك"
          description={rfqs.error.message}
          action={<Button variant="secondary" onClick={() => void rfqs.refetch()}>أعد المحاولة</Button>}
        />
      )}

      {rfqs.data && rfqs.data.data.length === 0 && (
        <EmptyState
          icon="box"
          title="لم ترسل أي طلب بعد"
          description="صوّر القطعة التي تحتاجها واكتب وصفاً قصيراً، وستصلك عروض الأسعار هنا."
          action={<Link to="/rfqs/new">اطلب قطعتك الأولى</Link>}
        />
      )}

      {rfqs.data && rfqs.data.data.length > 0 && (
        <>
          <ul className={styles.list} aria-label="طلبات الأسعار">
            {rfqs.data.data.map((rfq) => (
              <li key={rfq.id}>
                <Link to={`/rfqs/${rfq.id}`} className={styles.row}>
                  <span className={styles.rowBadges}>
                    <RfqStatusBadge status={rfq.status} />
                    {rfq.urgency !== 'normal' && <UrgencyBadge urgency={rfq.urgency} />}
                  </span>
                  <span className={styles.rowTitle}>{rfq.description}</span>
                  <span className={styles.rowMeta}>
                    <span>{rfq.category?.name ?? 'بانتظار التصنيف'}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      <span className="num">{formatNumber(rfq.quantity)}</span> {UNIT_LABELS[rfq.unit]}
                    </span>
                    {rfq.photos_count > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className={styles.rowPhotos}>
                          <Icon name="camera" size={16} />
                          <span className="num">{rfq.photos_count}</span>
                          <span className="visually-hidden"> صور</span>
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <time dateTime={rfq.created_at}>{formatDate(rfq.created_at)}</time>
                  </span>
                  <Icon name="chevron" size={18} className={styles.rowGo} />
                </Link>
              </li>
            ))}
          </ul>

          {rfqs.data.meta.last_page > 1 && (
            <nav className={styles.pager} aria-label="الصفحات">
              <Button variant="secondary" disabled={page <= 1} onClick={() => goTo(page - 1)}>
                السابق
              </Button>
              <span className={styles.pagerText}>
                صفحة <span className="num">{page}</span> من <span className="num">{rfqs.data.meta.last_page}</span>
              </span>
              <Button variant="secondary" disabled={page >= rfqs.data.meta.last_page} onClick={() => goTo(page + 1)}>
                التالي
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
