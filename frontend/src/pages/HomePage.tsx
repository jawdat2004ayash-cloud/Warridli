import { Link } from 'react-router'
import { useMe } from '../features/auth/hooks'
import type { Me } from '../lib/auth'
import rfqStyles from './rfqs/Rfq.module.css'
import styles from './HomePage.module.css'

/** What a logged-in person most likely came to do — never "sign up / log in" again. */
function NextStep({ me }: { me: Me }) {
  if (me.is_admin) {
    return (
      <p className={styles.actions}>
        <Link to="/admin" className={rfqStyles.primaryLink}>
          افتح لوحة الإدارة
        </Link>
      </p>
    )
  }
  if (me.company?.type === 'buyer') {
    return (
      <p className={styles.actions}>
        <Link to="/rfqs/new" className={rfqStyles.primaryLink}>
          اطلب سعر قطعة الآن
        </Link>
        <Link to="/rfqs">طلباتي</Link>
      </p>
    )
  }
  if (me.company?.type === 'supplier') {
    return me.company.status === 'approved' ? (
      <p className={styles.actions}>
        <Link to="/supplier/rfqs" className={rfqStyles.primaryLink}>
          افتح طلبات الأسعار
        </Link>
        <Link to="/supplier/categories">تخصصاتي</Link>
      </p>
    ) : (
      <p className={styles.actions}>
        <Link to="/supplier/categories" className={rfqStyles.primaryLink}>
          اختر تخصصاتك
        </Link>
        <Link to="/account">حالة حسابي</Link>
      </p>
    )
  }
  return (
    <p className={styles.actions}>
      <Link to="/account">حسابي</Link>
    </p>
  )
}

export function HomePage() {
  const me = useMe()

  return (
    <section className={styles.home} aria-labelledby="home-title">
      <h1 id="home-title" className={styles.title}>
        صوّر القطعة، واستلم عروض أسعار من مورّدين موثّقين.
      </h1>
      <p className={styles.lead}>
        ورّدلي يربط المعامل والورش في دمشق وريفها بمورّدي قطع الغيار الصناعية. لا تحتاج إلى معرفة اسم القطعة
        التقني: صورة أو رقم مطبوع أو وصف قصير يكفي.
      </p>
      {me.data ? (
        <NextStep me={me.data} />
      ) : (
        // Nothing while the session is being checked, so a logged-in user never sees "create an account".
        !me.isPending && (
          <p className={styles.actions}>
            <Link to="/register" className={rfqStyles.primaryLink}>
              أنشئ حساباً جديداً
            </Link>
            <Link to="/login">تسجيل الدخول</Link>
          </p>
        )
      )}
    </section>
  )
}
