import { Link, useSearchParams } from 'react-router'
import { Badge, RfqStatusBadge, UrgencyBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Money } from '../../components/ui/Money'
import { EmptyState, SkeletonCard } from '../../components/ui/States'
import { useInbox } from '../../features/supplier/hooks'
import { formatDate, formatNumber } from '../../lib/format'
import { UNIT_LABELS } from '../../lib/rfqs'
import type { InboxTab, SupplierRfq } from '../../lib/supplier'
import rfqStyles from '../rfqs/Rfq.module.css'
import styles from './Supplier.module.css'

const TABS: { value: InboxTab; label: string }[] = [
  { value: 'new', label: 'طلبات جديدة' },
  { value: 'quoted', label: 'عروضي' },
]

function MyQuoteBadge({ rfq }: { rfq: SupplierRfq }) {
  const quote = rfq.my_quote
  if (!quote) return null
  if (quote.status === 'withdrawn') return <Badge tone="muted">سحبت عرضك</Badge>
  if (quote.selected) return <Badge tone="ok">اختار المشتري عرضك</Badge>
  return (
    <Badge tone="ok">
      عرضك: <Money amount={Number(quote.unit_price)} currency={quote.currency} />
    </Badge>
  )
}

export function SupplierInboxPage() {
  const [params, setParams] = useSearchParams()
  const tab: InboxTab = params.get('tab') === 'quoted' ? 'quoted' : 'new'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const inbox = useInbox(tab, page)

  const goToPage = (p: number) => setParams({ ...(tab === 'quoted' ? { tab } : {}), ...(p > 1 ? { page: String(p) } : {}) })

  return (
    <div className={rfqStyles.page}>
      <header className={rfqStyles.pageHead}>
        <div>
          <p className={rfqStyles.kicker}>المورّد</p>
          <h1 className={rfqStyles.pageTitle}>طلبات الأسعار</h1>
        </div>
        <Link to="/supplier/categories" className={styles.secondaryLink}>
          تخصصاتي
        </Link>
      </header>

      <nav className={styles.tabs} aria-label="القوائم">
        {TABS.map((t) => (
          <Link
            key={t.value}
            to={{ search: t.value === 'quoted' ? '?tab=quoted' : '' }}
            className={styles.tab}
            aria-current={tab === t.value ? 'page' : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {inbox.isPending && (
        <div className={rfqStyles.list} aria-busy="true">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {inbox.isError && (
        <EmptyState
          tone="danger"
          icon="alert"
          title="تعذّر تحميل الطلبات"
          description={inbox.error.message}
          action={<Button variant="secondary" onClick={() => void inbox.refetch()}>أعد المحاولة</Button>}
        />
      )}

      {inbox.data && inbox.data.data.length === 0 && (
        tab === 'new' ? (
          <EmptyState
            icon="box"
            title="لا توجد طلبات جديدة الآن"
            description="تظهر هنا طلبات الورش والمعامل في تخصصاتك المعتمدة فور إرسالها. تأكد أن تخصصاتك صحيحة."
            action={<Link to="/supplier/categories">راجع تخصصاتي</Link>}
          />
        ) : (
          <EmptyState icon="box" title="لم تقدّم أي عرض بعد" description="افتح طلباً من «طلبات جديدة» واكتب سعرك." />
        )
      )}

      {inbox.data && inbox.data.data.length > 0 && (
        <>
          <ul className={rfqStyles.list} aria-label={tab === 'new' ? 'طلبات جديدة' : 'الطلبات التي قدّمت عليها عروضاً'}>
            {inbox.data.data.map((rfq) => (
              <li key={rfq.id}>
                <Link to={`/supplier/rfqs/${rfq.id}`} className={rfqStyles.row}>
                  <span className={rfqStyles.rowBadges}>
                    {tab === 'quoted' && rfq.status !== 'open' && <RfqStatusBadge status={rfq.status} />}
                    {rfq.urgency !== 'normal' && <UrgencyBadge urgency={rfq.urgency} />}
                    <MyQuoteBadge rfq={rfq} />
                  </span>
                  <span className={rfqStyles.rowTitle}>{rfq.description}</span>
                  <span className={rfqStyles.rowMeta}>
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
                    <span aria-hidden="true">·</span>
                    <span>
                      حتى <time dateTime={rfq.closes_at}>{formatDate(rfq.closes_at)}</time>
                    </span>
                  </span>
                  <Icon name="chevron" size={18} className={rfqStyles.rowGo} />
                </Link>
              </li>
            ))}
          </ul>

          {inbox.data.meta.last_page > 1 && (
            <nav className={rfqStyles.pager} aria-label="الصفحات">
              <Button variant="secondary" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                السابق
              </Button>
              <span className={rfqStyles.pagerText}>
                صفحة <span className="num">{page}</span> من <span className="num">{inbox.data.meta.last_page}</span>
              </span>
              <Button variant="secondary" disabled={page >= inbox.data.meta.last_page} onClick={() => goToPage(page + 1)}>
                التالي
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
