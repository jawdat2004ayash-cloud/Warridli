import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Notice } from '../../components/ui/Notice'
import { Pager } from '../../components/ui/Pager'
import { EmptyState, SkeletonCard } from '../../components/ui/States'
import { useMarkAllRead, useMarkRead, useNotifications } from '../../features/notifications/hooks'
import { formatDateTime, formatNumber } from '../../lib/format'
import { describeNotification, type AppNotification } from '../../lib/notifications'
import rfqStyles from '../rfqs/Rfq.module.css'
import styles from './Notifications.module.css'

function Item({ n }: { n: AppNotification }) {
  const markRead = useMarkRead()
  const navigate = useNavigate()
  const { title, text, link } = describeNotification(n)

  const body = (
    <>
      <span className={styles.head}>
        {!n.read && (
          <span className={styles.dot}>
            <span className="visually-hidden">جديد: </span>
          </span>
        )}
        <span className={styles.title}>{title}</span>
      </span>
      {text && <span className={styles.text}>{text}</span>}
      <time className={styles.time} dateTime={n.created_at}>
        {formatDateTime(n.created_at)}
      </time>
    </>
  )

  return (
    <li>
      {link ? (
        <Link
          to={link}
          className={styles.item}
          data-unread={n.read ? undefined : ''}
          onClick={(event) => {
            if (n.read) return
            // Mark as read first, so the badge is right when the next page shows; navigate either way.
            event.preventDefault()
            markRead.mutate(n.id, { onSettled: () => void navigate(link) })
          }}
        >
          {body}
          <Icon name="chevron" size={18} className={rfqStyles.rowGo} />
        </Link>
      ) : (
        <div className={styles.item} data-unread={n.read ? undefined : ''}>
          {body}
        </div>
      )}
    </li>
  )
}

export function NotificationsPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const list = useNotifications(page)
  const markAll = useMarkAllRead()
  const unread = list.data?.meta.unread ?? 0

  return (
    <div className={rfqStyles.page}>
      <header className={rfqStyles.pageHead}>
        <div>
          <h1 className={rfqStyles.pageTitle}>الإشعارات</h1>
          <p className={styles.lead} aria-live="polite">
            {list.data && (unread > 0 ? <>لديك <span className="num">{formatNumber(unread)}</span> غير مقروءة.</> : 'قرأت كل الإشعارات.')}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="secondary" loading={markAll.isPending} onClick={() => markAll.mutate()} icon={<Icon name="check" size={18} />}>
            علّم الكل كمقروء
          </Button>
        )}
      </header>

      {markAll.isError && <Notice tone="danger" title={markAll.error.message} focusOnMount />}

      {list.isPending && (
        <div className={rfqStyles.list} aria-busy="true">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
      {list.isError && (
        <EmptyState
          tone="danger"
          icon="alert"
          title="تعذّر تحميل الإشعارات"
          description={list.error.message}
          action={<Button variant="secondary" onClick={() => void list.refetch()}>أعد المحاولة</Button>}
        />
      )}
      {list.data && list.data.data.length === 0 && (
        <EmptyState
          icon="bell"
          title="لا توجد إشعارات بعد"
          description="نخبرك هنا عندما يصل عرض سعر على طلبك، أو طلب جديد في تخصصك، أو عندما تراجع الإدارة حسابك."
        />
      )}
      {list.data && list.data.data.length > 0 && (
        <>
          <ul className={rfqStyles.list} aria-label="الإشعارات">
            {list.data.data.map((n) => (
              <Item key={n.id} n={n} />
            ))}
          </ul>
          <Pager page={page} lastPage={list.data.meta.last_page} onPage={(p) => setParams(p > 1 ? { page: String(p) } : {})} />
        </>
      )}
    </div>
  )
}
