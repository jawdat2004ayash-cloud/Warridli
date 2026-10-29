import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Wordmark } from '../components/brand/Wordmark'
import { Badge, RfqStatusBadge, UrgencyBadge, type RfqStatus } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, PartTag } from '../components/ui/Card'
import { Field, Select, TextArea, TextInput } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { EmptyState, SkeletonCard } from '../components/ui/States'
import { useToast } from '../components/ui/toastContext'
import { ApiError, getHealth } from '../lib/api'
import { Money } from '../components/ui/Money'
import { formatDate, type Currency } from '../lib/format'
import styles from './DesignSpecimenPage.module.css'

const PALETTE = [
  { token: '--c-graphite', hex: '#16191D', role: 'الحبر والشريط العلوي' },
  { token: '--c-paper', hex: '#F4F2ED', role: 'خلفية الصفحة' },
  { token: '--c-surface', hex: '#FFFFFF', role: 'البطاقات والحقول' },
  { token: '--c-line-strong', hex: '#8A857B', role: 'حدود الحقول' },
  { token: '--c-signal', hex: '#B93D0B', role: 'الإجراء الأساسي والتركيز فقط' },
  { token: '--c-ok', hex: '#1D6B43', role: 'نجاح' },
  { token: '--c-warn', hex: '#7A4E00', role: 'تنبيه' },
  { token: '--c-danger', hex: '#B42318', role: 'خطأ' },
  { token: '--c-info', hex: '#1F4E79', role: 'معلومة' },
]

const TYPE_SCALE = [
  { token: '--fs-3xl', px: 36, sample: 'عروض أسعار خلال ساعات' },
  { token: '--fs-2xl', px: 28, sample: 'طلب رقم 214 — بيلية' },
  { token: '--fs-xl', px: 22, sample: 'مقارنة العروض' },
  { token: '--fs-lg', px: 18, sample: 'بيلية لمحرك مضخة مياه' },
  { token: '--fs-md', px: 16, sample: 'الكمية المطلوبة 4 قطع، والتسليم في المنطقة الصناعية بعدرا.' },
  { token: '--fs-sm', px: 14, sample: 'صالح حتى 30 تشرين الأول' },
  { token: '--fs-xs', px: 12, sample: 'آخر تحديث قبل 5 دقائق' },
]

const STATUSES: RfqStatus[] = ['pending_review', 'open', 'closed', 'cancelled', 'expired', 'rejected']

type SampleQuote = {
  supplier: string
  price: number
  currency: Currency
  condition: string
  brand: string
  stock: string
  leadDays: number
  validUntil: string
  expired?: boolean
}

// Illustrative values for layout only — not real prices or suppliers.
const SAMPLE_QUOTES: SampleQuote[] = [
  { supplier: 'مورّد أ', price: 14.5, currency: 'USD', condition: 'جديد', brand: 'SKF', stock: 'متوفر', leadDays: 0, validUntil: '2026-11-02' },
  { supplier: 'مورّد ب', price: 120000, currency: 'SYP', condition: 'جديد', brand: 'بدون ماركة', stock: 'متوفر', leadDays: 1, validUntil: '2026-10-29' },
  { supplier: 'مورّد ج', price: 9, currency: 'USD', condition: 'مستعمل', brand: 'NSK', stock: 'بالطلب', leadDays: 5, validUntil: '2026-10-20', expired: true },
]

function Section({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  const id = `spec-${index}`
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>
        <span className={styles.sectionIndex} aria-hidden="true">
          {index}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function ApiHealth() {
  const health = useQuery({ queryKey: ['health'], queryFn: ({ signal }) => getHealth(signal) })

  if (health.isPending) return <SkeletonCard />

  if (health.isError) {
    const message = health.error instanceof ApiError ? health.error.message : 'خطأ غير متوقع.'
    return (
      <EmptyState
        tone="danger"
        icon="alert"
        title="الخادم غير متاح"
        description={`${message} شغّل Laravel على المنفذ 8000 ثم أعد المحاولة.`}
        action={
          <Button variant="secondary" icon={<Icon name="refresh" />} onClick={() => health.refetch()} loading={health.isFetching}>
            إعادة المحاولة
          </Button>
        }
      />
    )
  }

  return (
    <div className={styles.healthRow}>
      <Badge tone={health.data.status === 'ok' ? 'ok' : 'warn'}>
        الخادم: {health.data.status === 'ok' ? 'يعمل' : 'متعثّر'}
      </Badge>
      <Badge tone={health.data.database === 'ok' ? 'ok' : 'danger'}>
        قاعدة البيانات: {health.data.database === 'ok' ? 'متصلة' : 'غير متاحة'}
      </Badge>
      <code className={styles.endpoint} dir="ltr">
        GET /api/health
      </code>
    </div>
  )
}

export function DesignSpecimenPage() {
  const notify = useToast()

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.kicker}>نظام التصميم · الإصدار 0.1</p>
        <h1 className={styles.title}>دليل الواجهة</h1>
        <p className={styles.lead}>
          هوية «ورقة المواصفات»: حبر غرافيتي على ورق تقني، ولون إشارة برتقالي واحد مخصّص للإجراء الأساسي والتركيز
          والاستعجال. الحواف حادة، والفواصل خطوط رفيعة بدلاً من الظلال.
        </p>
      </header>

      <Section index="01" title="الهوية">
        <div className={styles.brandRow}>
          <div className={styles.brandTile}>
            <Wordmark />
          </div>
          <div className={`${styles.brandTile} ${styles.brandTileDark}`}>
            <Wordmark inverse />
          </div>
        </div>
      </Section>

      <Section index="02" title="الألوان">
        <ul className={styles.swatches}>
          {PALETTE.map((c) => (
            <li key={c.token} className={styles.swatch}>
              <span className={styles.chip} style={{ background: `var(${c.token})` }} />
              <span className={styles.swatchText}>
                <strong>{c.role}</strong>
                <code dir="ltr">
                  {c.token} · {c.hex}
                </code>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section index="03" title="الخط والمقاسات">
        <p className={styles.note}>
          IBM Plex Sans Arabic للنصوص، وIBM Plex Mono للأرقام الآلية (أرقام القطع والأسعار). الأرقام لاتينية لأنها
          تُنسخ وتُقارن كما هي في السوق.
        </p>
        <ol className={styles.typeScale}>
          {TYPE_SCALE.map((t) => (
            <li key={t.token} className={styles.typeRow}>
              <code dir="ltr" className={styles.typeToken}>
                {t.px}px
              </code>
              <span style={{ fontSize: `var(${t.token})` }}>{t.sample}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section index="04" title="الأزرار">
        <div className={styles.row}>
          <Button icon={<Icon name="plus" />}>أرسل الطلب</Button>
          <Button variant="secondary" icon={<Icon name="camera" />}>
            أضف صورة
          </Button>
          <Button variant="ghost">إلغاء</Button>
          <Button variant="danger">سحب العرض</Button>
          <Button loading>جارٍ الإرسال</Button>
          <Button disabled>غير متاح</Button>
        </div>
        <div className={styles.narrow}>
          <Button size="lg" block>
            اطلب عروض أسعار
          </Button>
        </div>
      </Section>

      <Section index="05" title="الحقول">
        <form className={styles.form} onSubmit={(e) => e.preventDefault()} noValidate>
          <Field label="صف القطعة المطلوبة" required hint="اكتب ما تعرفه: مكانها في الآلة، شكلها، المشكلة. لا يلزم الاسم التقني.">
            {(p) => <TextArea {...p} placeholder="مثال: بيلية في محرك مضخة المياه، صارت تصدر صوتاً عالياً" />}
          </Field>
          <Field label="رقم القطعة" optional hint="انسخه كما هو مطبوع على القطعة أو العلبة.">
            {(p) => <TextInput {...p} dir="ltr" placeholder="6205-2RS" autoComplete="off" />}
          </Field>
          <Field label="التصنيف" required>
            {(p) => (
              <Select {...p} defaultValue="unknown">
                <option value="unknown">لا أعرف — سيصنّفه فريق ورّدلي</option>
                <option value="bearings">بيليات (رولمان)</option>
                <option value="belts">سيور</option>
                <option value="seals">جوانات وكوبلنغ</option>
              </Select>
            )}
          </Field>
          <Field label="الكمية" required error="أدخل كمية أكبر من صفر.">
            {(p) => <TextInput {...p} type="number" inputMode="numeric" defaultValue="0" min={1} />}
          </Field>
        </form>
      </Section>

      <Section index="06" title="الحالات والاستعجال">
        <div className={styles.row}>
          {STATUSES.map((s) => (
            <RfqStatusBadge key={s} status={s} />
          ))}
        </div>
        <div className={styles.row}>
          <UrgencyBadge urgency="normal" />
          <UrgencyBadge urgency="urgent" />
          <UrgencyBadge urgency="line_stopped" />
        </div>
      </Section>

      <Section index="07" title="بطاقة طلب">
        <div className={styles.narrow}>
          <Card
            title="بيلية لمحرك مضخة مياه"
            meta={
              <>
                <RfqStatusBadge status="open" />
                <UrgencyBadge urgency="line_stopped" />
              </>
            }
            footer={
              <>
                <Badge tone="info">3 عروض</Badge>
                <span className={styles.metaText}>
                  <Icon name="clock" size={16} /> يُغلق {formatDate('2026-10-30T12:00:00Z')}
                </span>
              </>
            }
          >
            <div className={styles.cardBody}>
              <PartTag value="6205-2RS" />
              <dl className={styles.specs}>
                <div>
                  <dt>الكمية</dt>
                  <dd className="num">4</dd>
                </div>
                <div>
                  <dt>الآلة</dt>
                  <dd>مضخة طرد مركزي</dd>
                </div>
                <div>
                  <dt>المنطقة</dt>
                  <dd>عدرا الصناعية</dd>
                </div>
              </dl>
            </div>
          </Card>
        </div>
      </Section>

      <Section index="08" title="مقارنة العروض">
        <p className={styles.note}>بيانات توضيحية لاختبار التخطيط فقط، ولا تمثّل أسعاراً أو مورّدين حقيقيين.</p>
        {/* Scrollable region must be keyboard-focusable (WCAG 2.1.1), hence tabIndex on a non-interactive element. */}
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <section className={styles.tableWrap} aria-label="جدول مقارنة العروض" tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">المورّد</th>
                <th scope="col">سعر الوحدة</th>
                <th scope="col">الحالة</th>
                <th scope="col">الماركة</th>
                <th scope="col">التوفّر</th>
                <th scope="col">التوريد</th>
                <th scope="col">صالح حتى</th>
                <th scope="col">
                  <span className="visually-hidden">إجراء</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_QUOTES.map((q) => (
                <tr key={q.supplier} className={q.expired ? styles.expired : undefined}>
                  <th scope="row">{q.supplier}</th>
                  <td className={styles.price}>
                    <Money amount={q.price} currency={q.currency} />
                  </td>
                  <td>
                    <Badge tone={q.condition === 'جديد' ? 'ok' : 'warn'}>{q.condition}</Badge>
                  </td>
                  <td>
                    <bdi>{q.brand}</bdi>
                  </td>
                  <td>{q.stock}</td>
                  <td>{q.leadDays === 0 ? 'فوري' : `${q.leadDays} أيام`}</td>
                  <td>{q.expired ? <Badge tone="muted">منتهي الصلاحية</Badge> : formatDate(q.validUntil)}</td>
                  <td>
                    <Button variant="secondary" icon={<Icon name="whatsapp" />} disabled={q.expired}>
                      تواصل
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </Section>

      <Section index="09" title="فارغ، تحميل، خطأ">
        <div className={styles.grid3}>
          <EmptyState
            title="لا توجد طلبات بعد"
            description="أنشئ أول طلب عرض سعر، وسيصلك إشعار عند وصول العروض."
            action={<Button icon={<Icon name="plus" />}>طلب جديد</Button>}
          />
          <SkeletonCard />
          <EmptyState
            tone="danger"
            icon="alert"
            title="تعذّر تحميل العروض"
            description="تحقّق من الاتصال ثم أعد المحاولة."
            action={
              <Button variant="secondary" icon={<Icon name="refresh" />}>
                إعادة المحاولة
              </Button>
            }
          />
        </div>
      </Section>

      <Section index="10" title="التنبيهات">
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => notify({ tone: 'ok', title: 'أُرسل الطلب', description: 'سنُعلمك عند وصول أول عرض.' })}>
            تنبيه نجاح
          </Button>
          <Button variant="secondary" onClick={() => notify({ tone: 'danger', title: 'تعذّر رفع الصورة', description: 'الحد الأقصى 5 ميغابايت.' })}>
            تنبيه خطأ
          </Button>
          <Button variant="secondary" onClick={() => notify({ title: 'وصل عرض جديد على طلبك' })}>
            تنبيه معلومة
          </Button>
        </div>
      </Section>

      <Section index="11" title="الاتصال بالخادم">
        <ApiHealth />
      </Section>
    </div>
  )
}
