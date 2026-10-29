import { Link, useNavigate } from 'react-router'
import { Badge, type Tone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'
import { flashState, useFlash } from '../features/auth/flash'
import { useLogout, useMe } from '../features/auth/hooks'
import type { CompanyStatus } from '../lib/auth'
import styles from './auth/AuthPage.module.css'

const STATUS: Record<CompanyStatus, { label: string; tone: Tone }> = {
  approved: { label: 'مفعّل', tone: 'ok' },
  pending: { label: 'قيد المراجعة', tone: 'warn' },
  rejected: { label: 'مرفوض', tone: 'danger' },
  suspended: { label: 'موقوف', tone: 'danger' },
}

/** Rendered inside <RequireAuth>, so the user is known. */
export function AccountPage() {
  const me = useMe().data
  const logout = useLogout()
  const navigate = useNavigate()
  const flash = useFlash()

  if (!me) return null
  const company = me.company

  return (
    <div className={`${styles.page} ${styles.wide}`}>
      {flash === 'registered' && (
        <Notice tone="ok" title="تم إنشاء حسابك بنجاح.">
          أنت الآن مسجّل الدخول في ورّدلي.
        </Notice>
      )}
      {flash === 'loggedIn' && <Notice tone="ok" title={`أهلاً ${me.name}، تم تسجيل دخولك.`} />}

      {me.is_admin && (
        <Notice tone="info" title="لوحة الإدارة">
          <Link to="/admin">افتح لوحة الإدارة</Link> لمراجعة المورّدين وتصنيف الطلبات.
        </Notice>
      )}

      {company?.type === 'buyer' && (
        <Notice tone="info" title="تحتاج قطعة غيار؟">
          <Link to="/rfqs/new">اطلب سعر قطعة الآن</Link> · <Link to="/rfqs">طلباتي</Link>
        </Notice>
      )}

      {company?.type === 'supplier' && company.status === 'pending' && (
        <Notice tone="warn" title="حسابك قيد المراجعة">
          تراجع إدارة ورّدلي بيانات محلك. بعد التفعيل تبدأ طلبات الأسعار بالوصول إليك.{' '}
          <Link to="/supplier/categories">اختر تخصصاتك الآن</Link>
        </Notice>
      )}

      {company?.type === 'supplier' && company.status === 'approved' && (
        <Notice tone="info" title="حسابك مفعّل">
          <Link to="/supplier/rfqs">طلبات الأسعار</Link> · <Link to="/supplier/categories">تخصصاتي</Link>
        </Notice>
      )}

      <section className={styles.sheet} aria-labelledby="account-title">
        <header className={styles.head}>
          <p className={styles.kicker}>{me.is_admin ? 'حساب إدارة' : company?.type === 'supplier' ? 'حساب مورّد' : 'حساب مشترٍ'}</p>
          <h1 id="account-title" className={styles.title}>
            حسابي
          </h1>
        </header>

        <div className={styles.body}>
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>الاسم</dt>
              <dd>{me.name}</dd>
            </div>
            <div className={styles.fact}>
              <dt>البريد الإلكتروني</dt>
              <dd>
                <bdi dir="ltr">{me.email}</bdi>
              </dd>
            </div>
            {company && (
              <>
                <div className={styles.fact}>
                  <dt>المنشأة</dt>
                  <dd>{company.name}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>حالة الحساب</dt>
                  <dd>
                    <Badge tone={STATUS[company.status].tone}>{STATUS[company.status].label}</Badge>
                  </dd>
                </div>
                <div className={styles.fact}>
                  <dt>رقم الواتساب</dt>
                  <dd>
                    <bdi dir="ltr" className="num">
                      {company.whatsapp_phone}
                    </bdi>
                  </dd>
                </div>
                <div className={styles.fact}>
                  <dt>المنطقة</dt>
                  <dd>{company.area.name}</dd>
                </div>
                {company.address_text && (
                  <div className={styles.fact}>
                    <dt>العنوان</dt>
                    <dd>{company.address_text}</dd>
                  </div>
                )}
              </>
            )}
          </dl>

          {logout.isError && <Notice tone="danger" title={logout.error.message} />}
        </div>

        <footer className={styles.foot}>
          <Button
            variant="secondary"
            loading={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true, state: flashState('loggedOut') }) })
            }
          >
            تسجيل الخروج
          </Button>
        </footer>
      </section>
    </div>
  )
}
