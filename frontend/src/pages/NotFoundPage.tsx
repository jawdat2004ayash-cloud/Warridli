import { Link } from 'react-router'
import { EmptyState } from '../components/ui/States'

export function NotFoundPage() {
  return (
    <EmptyState
      icon="alert"
      title="الصفحة غير موجودة"
      description="ربما تغيّر الرابط أو حُذفت الصفحة."
      action={<Link to="/">العودة إلى الرئيسية</Link>}
    />
  )
}
