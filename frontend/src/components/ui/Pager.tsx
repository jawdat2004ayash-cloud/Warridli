import { Button } from '../../components/ui/Button'
import rfqStyles from '../../pages/rfqs/Rfq.module.css'

/** Previous / next with "page X of Y" — same as the buyer and supplier lists. Nothing for a single page. */
export function Pager({ page, lastPage, onPage }: { page: number; lastPage: number; onPage: (page: number) => void }) {
  if (lastPage <= 1) return null
  return (
    <nav className={rfqStyles.pager} aria-label="الصفحات">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        السابق
      </Button>
      <span className={rfqStyles.pagerText}>
        صفحة <span className="num">{page}</span> من <span className="num">{lastPage}</span>
      </span>
      <Button variant="secondary" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
        التالي
      </Button>
    </nav>
  )
}
