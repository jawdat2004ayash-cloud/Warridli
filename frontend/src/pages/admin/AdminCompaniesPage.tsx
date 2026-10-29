import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Badge, type Tone } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { EmptyState, SkeletonCard } from '../../components/ui/States'
import { useToast } from '../../components/ui/toastContext'
import { ConfirmAction } from '../../features/admin/ConfirmAction'
import { useCompanies, useCompanyTransition, useSpecialtyReview, useUserSuspension } from '../../features/admin/hooks'
import { COMPANY_STATUS_LABELS, type AdminCompany, type AdminMember, type CompanyFilter } from '../../lib/admin'
import type { CompanyStatus } from '../../lib/auth'
import { formatDate } from '../../lib/format'
import { Pager } from '../../components/ui/Pager'
import styles from './Admin.module.css'

type View = 'pending' | 'specialties' | 'approved' | 'suspended' | 'rejected'

const VIEWS: { value: View; label: string; filter: Omit<CompanyFilter, 'page'>; empty: string }[] = [
  { value: 'pending', label: 'مورّدون بانتظار المراجعة', filter: { status: 'pending' }, empty: 'لا يوجد مورّد جديد بانتظار المراجعة.' },
  { value: 'specialties', label: 'تخصصات بانتظار الاعتماد', filter: { pending_categories: true }, empty: 'لا توجد تخصصات بانتظار الاعتماد.' },
  { value: 'approved', label: 'المعتمدة', filter: { status: 'approved' }, empty: 'لا توجد شركات معتمدة بعد.' },
  { value: 'suspended', label: 'الموقوفة', filter: { status: 'suspended' }, empty: 'لا توجد شركات موقوفة.' },
  { value: 'rejected', label: 'المرفوضة', filter: { status: 'rejected' }, empty: 'لا توجد شركات مرفوضة.' },
]

const STATUS_TONE: Record<CompanyStatus, Tone> = { pending: 'warn', approved: 'ok', rejected: 'danger', suspended: 'danger' }
const CARD_TONE: Partial<Record<CompanyStatus, string>> = { pending: 'warn', suspended: 'danger', rejected: 'muted' }

function useDone() {
  const toast = useToast()
  return (title: string, description?: string) => toast({ tone: 'ok', title, description })
}

function CompanyActions({ company }: { company: AdminCompany }) {
  const transition = useCompanyTransition()
  const done = useDone()
  const run = (t: 'approve' | 'reject' | 'suspend' | 'reactivate', message: string) => async (reason?: string) => {
    await transition.mutateAsync({ id: company.id, transition: t, reason })
    done(message, company.name)
  }
  const supplier = company.type === 'supplier'

  return (
    <div className={styles.actions}>
      {supplier && (company.status === 'pending' || company.status === 'rejected') && (
        <ConfirmAction
          variant="primary"
          label={company.status === 'pending' ? 'وافق على المورّد' : 'وافق بعد إعادة المراجعة'}
          question={`ستُفعَّل «${company.name}» كمورّد معتمد. ستصله طلبات الأسعار في تخصصاته بعد اعتماد كل تخصص منها.`}
          confirmLabel="نعم، وافق"
          reason="optional"
          reasonLabel="ملاحظة"
          onConfirm={run('approve', 'تمت الموافقة على المورّد.')}
        />
      )}
      {supplier && company.status === 'pending' && (
        <ConfirmAction
          variant="danger"
          label="ارفض"
          question={`لن يستطيع «${company.name}» استقبال طلبات الأسعار. يمكنك الموافقة عليه لاحقاً إن تغيّر الوضع.`}
          confirmLabel="نعم، ارفض"
          reason="required"
          reasonHint="مثال: لم نتمكن من التحقق من وجود المحل. يُحفظ في سجل العمليات."
          onConfirm={run('reject', 'تم رفض المورّد.')}
        />
      )}
      {company.status === 'approved' && (
        <ConfirmAction
          variant="danger"
          label="أوقف الشركة"
          question={`سيُسجَّل خروج كل مستخدمي «${company.name}» فوراً ولن يستطيعوا الدخول حتى تعيد تفعيلها.${supplier ? ' تختفي عروضها من مقارنات المشترين.' : ''}`}
          confirmLabel="نعم، أوقفها"
          reason="required"
          reasonHint="مثال: شكاوى متكررة من أسعار وهمية. يُحفظ في سجل العمليات."
          onConfirm={run('suspend', 'تم إيقاف الشركة وتسجيل خروج مستخدميها.')}
        />
      )}
      {company.status === 'suspended' && (
        <ConfirmAction
          variant="primary"
          label="أعد تفعيل الشركة"
          question={`سيتمكن مستخدمو «${company.name}» من الدخول والعمل من جديد.`}
          confirmLabel="نعم، أعد التفعيل"
          reason="optional"
          reasonLabel="ملاحظة"
          onConfirm={run('reactivate', 'أُعيد تفعيل الشركة.')}
        />
      )}
    </div>
  )
}

function MemberRow({ member }: { member: AdminMember }) {
  const suspension = useUserSuspension()
  const done = useDone()

  return (
    <li className={styles.rowItem}>
      <span className={styles.rowMain}>
        <span>
          {member.name} {member.role === 'owner' && <Badge tone="muted">صاحب الحساب</Badge>} {member.suspended && <Badge tone="danger">موقوف</Badge>}
        </span>
        <bdi dir="ltr" className={styles.rowSub}>
          {member.email}
        </bdi>
      </span>
      {member.suspended ? (
        <ConfirmAction
          label="أعد تفعيل المستخدم"
          question={`سيتمكن ${member.name} من الدخول من جديد.`}
          confirmLabel="نعم، أعد التفعيل"
          reason="optional"
          reasonLabel="ملاحظة"
          onConfirm={async (reason) => {
            await suspension.mutateAsync({ userId: member.user_id, suspend: false, reason })
            done('أُعيد تفعيل المستخدم.', member.name)
          }}
        />
      ) : (
        <ConfirmAction
          variant="danger"
          label="أوقف هذا المستخدم"
          question={`سيُسجَّل خروج ${member.name} فوراً ولن يستطيع الدخول. بقية مستخدمي الشركة لا يتأثرون.`}
          confirmLabel="نعم، أوقفه"
          reason="required"
          onConfirm={async (reason) => {
            await suspension.mutateAsync({ userId: member.user_id, suspend: true, reason })
            done('تم إيقاف المستخدم.', member.name)
          }}
        />
      )}
    </li>
  )
}

function Specialties({ company }: { company: AdminCompany }) {
  const review = useSpecialtyReview()
  const done = useDone()
  if (company.type !== 'supplier') return null

  return (
    <section aria-label={`تخصصات ${company.name}`}>
      <h3 className={styles.subhead}>التخصصات</h3>
      {company.categories.length === 0 ? (
        <p className={styles.rowSub}>لم يختر المورّد أي تخصص بعد. لن تصله طلبات حتى يختار تخصصاً وتعتمده.</p>
      ) : (
        <ul className={styles.rows}>
          {company.categories.map((c) => (
            <li key={c.id} className={styles.rowItem}>
              <span>
                {c.name} {c.status === 'approved' ? <Badge tone="ok">معتمد</Badge> : <Badge tone="warn">بانتظار الاعتماد</Badge>}
              </span>
              {c.status === 'pending' && (
                <span className={styles.actions}>
                  <ConfirmAction
                    variant="primary"
                    label="اعتمد التخصص"
                    question={`ستصل إلى «${company.name}» طلبات تصنيف «${c.name}»${company.status === 'approved' ? ' من الآن.' : ' بعد الموافقة على حسابه.'}`}
                    confirmLabel="نعم، اعتمد"
                    onConfirm={async () => {
                      await review.mutateAsync({ companyId: company.id, categoryId: c.id, decision: 'approve' })
                      done('تم اعتماد التخصص.', `${company.name} — ${c.name}`)
                    }}
                  />
                  <ConfirmAction
                    variant="danger"
                    label="ارفض التخصص"
                    question="سيُحذف طلب هذا التخصص، ويستطيع المورّد طلبه مرة أخرى لاحقاً."
                    confirmLabel="نعم، ارفض"
                    reason="optional"
                    onConfirm={async (reason) => {
                      await review.mutateAsync({ companyId: company.id, categoryId: c.id, decision: 'reject', reason })
                      done('تم رفض طلب التخصص.', `${company.name} — ${c.name}`)
                    }}
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function CompanyCard({ company }: { company: AdminCompany }) {
  return (
    <li className={styles.card} data-tone={CARD_TONE[company.status]}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{company.name}</h2>
        <span className={styles.badges}>
          <Badge tone="muted">{company.type === 'supplier' ? 'مورّد' : 'مشترٍ'}</Badge>
          <Badge tone={STATUS_TONE[company.status]}>{COMPANY_STATUS_LABELS[company.status]}</Badge>
        </span>
      </div>
      <dl className={styles.meta}>
        <div>
          <dt>المنطقة:</dt>
          <dd>{company.area.name}</dd>
        </div>
        <div>
          <dt>واتساب:</dt>
          <dd>
            <bdi dir="ltr">{company.whatsapp_phone}</bdi>
          </dd>
        </div>
        {company.address_text && (
          <div>
            <dt>العنوان:</dt>
            <dd>{company.address_text}</dd>
          </div>
        )}
        <div>
          <dt>سُجّل في:</dt>
          <dd>
            <time dateTime={company.created_at}>{formatDate(company.created_at)}</time>
          </dd>
        </div>
      </dl>

      <CompanyActions company={company} />
      <Specialties company={company} />

      <section aria-label={`مستخدمو ${company.name}`}>
        <h3 className={styles.subhead}>المستخدمون</h3>
        <ul className={styles.rows}>
          {company.members.map((m) => (
            <MemberRow key={m.user_id} member={m} />
          ))}
        </ul>
      </section>

      <Link to={`/admin/audit?subject_type=company&subject_id=${company.id}`} className={styles.rowSub}>
        سجل العمليات على هذه الشركة
      </Link>
    </li>
  )
}

export function AdminCompaniesPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q')?.trim() ?? ''
  const view = VIEWS.find((v) => v.value === params.get('view')) ?? VIEWS[0]!
  const page = Math.max(1, Number(params.get('page')) || 1)
  const filter: CompanyFilter = q.length >= 2 ? { q, page } : { ...view.filter, page }
  const companies = useCompanies(filter)
  const [search, setSearch] = useState(q)

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    const term = search.trim()
    setParams(term.length >= 2 ? { q: term } : {})
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>المورّدون والشركات</h1>
        <p className={styles.lead}>
          تحقّق من المورّد (اتصال، زيارة، سجل تجاري) قبل الموافقة عليه، ثم اعتمد تخصصاته واحداً واحداً. كل قرار يُحفظ في سجل العمليات مع اسمك.
        </p>
      </header>

      <form className={styles.filters} onSubmit={submitSearch} aria-label="البحث عن شركة">
        <Field label="ابحث باسم الشركة أو بريد أحد مستخدميها" hint="حرفان على الأقل.">
          {(control) => <TextInput {...control} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />}
        </Field>
        <div className={styles.filterActions}>
          <Button type="submit" variant="secondary">
            ابحث
          </Button>
          {q && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('')
                setParams({})
              }}
            >
              امسح البحث
            </Button>
          )}
        </div>
      </form>

      {!q && (
        <nav className={styles.chips} aria-label="القوائم">
          {VIEWS.map((v) => (
            <Link key={v.value} to={{ search: v.value === 'pending' ? '' : `?view=${v.value}` }} className={styles.chip} aria-current={view.value === v.value ? 'page' : undefined}>
              {v.label}
            </Link>
          ))}
        </nav>
      )}

      {companies.isPending && <SkeletonCard />}
      {companies.isError && (
        <EmptyState
          tone="danger"
          icon="alert"
          title="تعذّر تحميل الشركات"
          description={companies.error.message}
          action={<Button variant="secondary" onClick={() => void companies.refetch()}>أعد المحاولة</Button>}
        />
      )}
      {companies.data && companies.data.data.length === 0 && (
        <EmptyState icon="check" title={q ? `لا توجد نتائج لـ«${q}»` : view.empty} description={q ? 'جرّب جزءاً من الاسم أو البريد.' : undefined} />
      )}
      {companies.data && companies.data.data.length > 0 && (
        <>
          <ul className={styles.list} aria-label={q ? 'نتائج البحث' : view.label} aria-busy={companies.isPlaceholderData || undefined}>
            {companies.data.data.map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </ul>
          <Pager page={page} lastPage={companies.data.meta.last_page} onPage={(p) => setParams((prev) => {
            const next = new URLSearchParams(prev)
            if (p > 1) next.set('page', String(p))
            else next.delete('page')
            return next
          })} />
        </>
      )}
    </div>
  )
}
