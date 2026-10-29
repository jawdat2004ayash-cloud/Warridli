import { Link } from 'react-router'
import { Icon, type IconName } from '../../components/ui/Icon'
import styles from './AuthPage.module.css'

const CHOICES: { to: string; icon: IconName; title: string; text: string; go: string }[] = [
  {
    to: '/register/buyer',
    icon: 'wrench',
    title: 'أحتاج قطعة غيار',
    text: 'لأصحاب الورش والمعامل وأقسام الصيانة: اطلب سعر قطعة واستلم عروضاً من عدة مورّدين.',
    go: 'حساب مشترٍ',
  },
  {
    to: '/register/supplier',
    icon: 'store',
    title: 'أبيع قطع غيار',
    text: 'لمحلات ومورّدي القطع الصناعية: تصلك طلبات الأسعار وتقدّم عروضك. يُراجَع الحساب قبل تفعيله.',
    go: 'حساب مورّد',
  },
]

export function RegisterChoicePage() {
  return (
    <div className={`${styles.page} ${styles.wide}`}>
      <header className={styles.intro}>
        <h1 className={styles.title}>إنشاء حساب جديد</h1>
        <p className={styles.lead}>اختر ما يناسب عملك. يستغرق التسجيل دقيقتين تقريباً.</p>
      </header>

      <ul className={styles.choices}>
        {CHOICES.map((choice) => (
          <li key={choice.to} className={styles.choiceItem}>
            <Link to={choice.to} className={styles.choice}>
              <span className={styles.choiceIcon}>
                <Icon name={choice.icon} size={26} />
              </span>
              <span className={styles.choiceTitle}>{choice.title}</span>
              <span className={styles.choiceText}>{choice.text}</span>
              <span className={styles.choiceGo}>
                {choice.go}
                <Icon name="chevron" size={18} />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className={styles.lead}>
        لديك حساب؟ <Link to="/login">سجّل الدخول</Link>
      </p>
    </div>
  )
}
