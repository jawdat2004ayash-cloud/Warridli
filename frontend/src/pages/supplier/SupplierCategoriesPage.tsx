import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Notice } from '../../components/ui/Notice'
import { EmptyState, SkeletonCard } from '../../components/ui/States'
import { useMe } from '../../features/auth/hooks'
import { useSaveSpecialties, useSpecialties } from '../../features/supplier/hooks'
import type { Specialty } from '../../lib/supplier'
import authStyles from '../auth/AuthPage.module.css'
import rfqStyles from '../rfqs/Rfq.module.css'
import styles from './Supplier.module.css'

function SpecialtyForm({ specialties }: { specialties: Specialty[] }) {
  const [selected, setSelected] = useState(() => new Set(specialties.filter((s) => s.status !== null).map((s) => s.id)))
  const [saved, setSaved] = useState(false)
  const save = useSaveSpecialties()

  function toggle(id: number) {
    setSaved(false)
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate([...selected], { onSuccess: () => setSaved(true) })
  }

  return (
    <form className={authStyles.form} onSubmit={onSubmit}>
      {saved && <Notice focusOnMount tone="ok" title="تم حفظ تخصصاتك.">التخصصات الجديدة تبقى «قيد المراجعة» حتى توافق عليها إدارة ورّدلي.</Notice>}
      {save.isError && <Notice focusOnMount tone="danger" title={save.error.message} />}

      <fieldset className={rfqStyles.choiceGroup}>
        <legend className={rfqStyles.groupLabel}>ما الذي تبيعه؟ اختر كل ما ينطبق.</legend>
        <div className={rfqStyles.choices}>
          {specialties.map((s) => (
            <label key={s.id} className={rfqStyles.choice}>
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className={rfqStyles.radio} />
              <span className={rfqStyles.choiceText}>
                <span className={rfqStyles.choiceLabel}>{s.name}</span>
                {s.status === 'approved' && <Badge tone="ok">معتمد</Badge>}
                {s.status === 'pending' && <Badge tone="warn">قيد المراجعة</Badge>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" size="lg" loading={save.isPending}>
        {save.isPending ? 'جارٍ الحفظ…' : 'احفظ التخصصات'}
      </Button>
    </form>
  )
}

/** Any supplier (also under review) can set its specialties; only approved ones bring requests. */
export function SupplierCategoriesPage() {
  const company = useMe().data?.company
  const specialties = useSpecialties()

  return (
    <div className={`${authStyles.page} ${authStyles.wide}`}>
      <section className={authStyles.sheet} aria-labelledby="spec-title">
        <header className={authStyles.head}>
          <p className={authStyles.kicker}>المورّد</p>
          <h1 id="spec-title" className={authStyles.title}>
            تخصصاتي
          </h1>
          <p className={authStyles.lead}>تصلك طلبات الأسعار في التخصصات التي توافق عليها إدارة ورّدلي فقط. اختر ما تبيعه فعلاً.</p>
        </header>
        <div className={authStyles.body}>
          {company?.status === 'pending' && (
            <Notice tone="warn" title="حسابك قيد المراجعة">تُراجَع تخصصاتك مع حسابك. بعد الموافقة تظهر لك الطلبات.</Notice>
          )}
          {specialties.isPending && <SkeletonCard />}
          {specialties.isError && (
            <EmptyState
              tone="danger"
              icon="alert"
              title="تعذّر تحميل التصنيفات"
              description={specialties.error.message}
              action={<Button variant="secondary" onClick={() => void specialties.refetch()}>أعد المحاولة</Button>}
            />
          )}
          {specialties.data && <SpecialtyForm specialties={specialties.data} />}
        </div>
        {company?.status === 'approved' && (
          <footer className={authStyles.foot}>
            <Link to="/supplier/rfqs" className={styles.secondaryLink}>
              إلى طلبات الأسعار
            </Link>
          </footer>
        )}
      </section>
    </div>
  )
}
