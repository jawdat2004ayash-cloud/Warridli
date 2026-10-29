import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { ErrorSummary, type SummaryItem } from '../../components/ui/ErrorSummary'
import { Field, Select, TextInput } from '../../components/ui/Field'
import { Notice } from '../../components/ui/Notice'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { flashState } from '../../features/auth/flash'
import { useAreas, useRegister } from '../../features/auth/hooks'
import { ApiError } from '../../lib/api'
import type { CompanyType } from '../../lib/auth'
import { isSyrianMobile } from '../../lib/phone'
import styles from './AuthPage.module.css'

type FieldName = 'name' | 'email' | 'password' | 'password_confirmation' | 'company_name' | 'whatsapp_phone' | 'area_id' | 'address_text'
type Values = Record<FieldName, string>
type Errors = Partial<Record<FieldName, string>>

/** Visual order; also the order of the error summary. */
const ORDER: FieldName[] = ['name', 'email', 'password', 'password_confirmation', 'company_name', 'whatsapp_phone', 'area_id', 'address_text']

const EMPTY: Values = Object.fromEntries(ORDER.map((f) => [f, ''])) as Values

const COPY = {
  buyer: {
    kicker: 'حساب مشترٍ',
    title: 'سجّل ورشتك أو معملك',
    lead: 'بعد التسجيل تستطيع طلب أسعار القطع التي تحتاجها.',
    company: 'اسم الورشة أو المعمل',
    companyHint: 'كما يعرفه الناس، مثل: ورشة الأمل للصيانة.',
    phoneHint: 'رقم موبايل سوري مثل 0944123456. لا يظهر رقمك للمورّدين؛ أنت من يبدأ التواصل معهم.',
    switchText: 'تبيع قطع غيار؟',
    switchLink: 'سجّل كمورّد',
    switchTo: '/register/supplier',
  },
  supplier: {
    kicker: 'حساب مورّد',
    title: 'سجّل محلك أو شركتك',
    lead: 'بعد مراجعة حسابك تصلك طلبات الأسعار من الورش والمعامل.',
    company: 'اسم المحل أو الشركة',
    companyHint: 'الاسم التجاري الذي يعرفك به الزبائن.',
    phoneHint: 'رقم موبايل سوري مثل 0944123456. يتواصل معك المشترون عليه عبر واتساب.',
    switchText: 'تبحث عن قطعة؟',
    switchLink: 'سجّل كمشترٍ',
    switchTo: '/register/buyer',
  },
} as const

function validate(v: Values): Errors {
  const e: Errors = {}
  if (!v.name.trim()) e.name = 'اكتب اسمك.'
  else if (v.name.trim().length < 2) e.name = 'الاسم قصير جداً.'
  if (!v.email.trim()) e.email = 'اكتب بريدك الإلكتروني.'
  else if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'اكتب البريد بشكل صحيح، مثل name@example.com.'
  if (!v.password) e.password = 'اختر كلمة مرور.'
  else if (v.password.length < 8) e.password = 'كلمة المرور قصيرة: 8 أحرف على الأقل.'
  else if (!/\p{L}/u.test(v.password) || !/\p{N}/u.test(v.password)) e.password = 'كلمة المرور يجب أن تحتوي على حرف ورقم على الأقل.'
  if (v.password && v.password_confirmation !== v.password) e.password_confirmation = 'كلمتا المرور غير متطابقتين. اكتبها مرة أخرى.'
  if (!v.company_name.trim()) e.company_name = 'اكتب اسم المنشأة.'
  if (!v.whatsapp_phone.trim()) e.whatsapp_phone = 'اكتب رقم الواتساب.'
  else if (!isSyrianMobile(v.whatsapp_phone)) e.whatsapp_phone = 'رقم الواتساب غير صحيح. اكتب رقم موبايل سوري مثل 0944123456.'
  if (!v.area_id) e.area_id = 'اختر المنطقة.'
  return e
}

function toSummary(errors: Errors): SummaryItem[] {
  return ORDER.filter((f) => errors[f]).map((f) => ({ fieldId: `reg-${f}`, message: errors[f]! }))
}

export function RegisterPage({ type }: { type: CompanyType }) {
  const copy = COPY[type]
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [submits, setSubmits] = useState(0)
  const areas = useAreas()
  const register = useRegister()
  const navigate = useNavigate()

  const set = (field: FieldName) => (event: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: event.target.value }))
    // An edited field is no longer "wrong" until the next submit checks it again.
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return setSubmits((n) => n + 1)

    register.mutate(
      {
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        password_confirmation: values.password_confirmation,
        account_type: type,
        company_name: values.company_name.trim(),
        whatsapp_phone: values.whatsapp_phone.trim(),
        area_id: Number(values.area_id),
        address_text: values.address_text.trim() || undefined,
      },
      {
        onSuccess: () => navigate('/account', { replace: true, state: flashState('registered') }),
        onError: (error) => {
          if (error instanceof ApiError && error.isValidation) {
            // Server messages are plain Arabic (D20); show them on the matching fields.
            const server: Errors = {}
            for (const field of ORDER) {
              const message = error.errors[field]?.[0]
              if (message) server[field] = message
            }
            setErrors(server)
            setSubmits((n) => n + 1)
          }
        },
      },
    )
  }

  const failure = register.error instanceof Error && !(register.error instanceof ApiError && register.error.isValidation)
    ? register.error.message
    : null

  return (
    <div className={`${styles.page} ${styles.wide}`}>
      <section className={styles.sheet} aria-labelledby="reg-title">
        <header className={styles.head}>
          <p className={styles.kicker}>{copy.kicker}</p>
          <h1 id="reg-title" className={styles.title}>
            {copy.title}
          </h1>
          <p className={styles.lead}>{copy.lead}</p>
        </header>

        <div className={styles.body}>
          <ErrorSummary items={toSummary(errors)} focusKey={submits} />
          {failure && <Notice focusOnMount tone="danger" title={failure} />}

          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <fieldset className={styles.section}>
              <legend className={styles.legend}>
                <span className={styles.step}>1</span>
                معلوماتك
              </legend>
              <Field id="reg-name" label="الاسم" hint="اسمك الكامل أو الاسم الذي تُعرف به." error={errors.name} required>
                {(c) => <TextInput {...c} autoComplete="name" value={values.name} onChange={set('name')} />}
              </Field>
              <Field id="reg-email" label="البريد الإلكتروني" hint="تحتاجه لتسجيل الدخول ولاستعادة كلمة المرور إن نسيتها." error={errors.email} required>
                {(c) => (
                  <TextInput {...c} type="email" inputMode="email" autoComplete="email" dir="ltr" value={values.email} onChange={set('email')} />
                )}
              </Field>
              <div className={styles.pair}>
                <Field id="reg-password" label="كلمة المرور" hint="8 أحرف على الأقل، فيها حرف ورقم." error={errors.password} required>
                  {(c) => <PasswordInput {...c} autoComplete="new-password" value={values.password} onChange={set('password')} />}
                </Field>
                <Field id="reg-password_confirmation" label="أعد كتابة كلمة المرور" error={errors.password_confirmation} required>
                  {(c) => (
                    <PasswordInput {...c} autoComplete="new-password" value={values.password_confirmation} onChange={set('password_confirmation')} />
                  )}
                </Field>
              </div>
            </fieldset>

            <fieldset className={styles.section}>
              <legend className={styles.legend}>
                <span className={styles.step}>2</span>
                معلومات المنشأة
              </legend>
              <Field id="reg-company_name" label={copy.company} hint={copy.companyHint} error={errors.company_name} required>
                {(c) => <TextInput {...c} autoComplete="organization" value={values.company_name} onChange={set('company_name')} />}
              </Field>
              <Field id="reg-whatsapp_phone" label="رقم الواتساب" hint={copy.phoneHint} error={errors.whatsapp_phone} required>
                {(c) => (
                  <TextInput
                    {...c}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    dir="ltr"
                    placeholder="09XX XXX XXX"
                    value={values.whatsapp_phone}
                    onChange={set('whatsapp_phone')}
                  />
                )}
              </Field>
              <div className={styles.pair}>
                <Field
                  id="reg-area_id"
                  label="المنطقة"
                  hint={areas.isError ? undefined : 'إن لم تجد منطقتك فاختر «مناطق أخرى».'}
                  error={errors.area_id ?? (areas.isError ? 'تعذّر تحميل قائمة المناطق. تحقّق من الاتصال.' : undefined)}
                  required
                >
                  {(c) => (
                    <Select {...c} value={values.area_id} onChange={set('area_id')} disabled={!areas.data}>
                      <option value="">{areas.isPending ? 'جارٍ تحميل المناطق…' : 'اختر المنطقة'}</option>
                      {areas.data?.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field id="reg-address_text" label="العنوان" hint="مثال: المنطقة الصناعية، الشارع الثالث." error={errors.address_text} optional>
                  {(c) => <TextInput {...c} autoComplete="street-address" value={values.address_text} onChange={set('address_text')} />}
                </Field>
              </div>
              {areas.isError && (
                <Button variant="secondary" onClick={() => void areas.refetch()} className={styles.inlineLink}>
                  أعد تحميل المناطق
                </Button>
              )}
            </fieldset>

            {type === 'supplier' && (
              <Notice tone="info" title="يُراجَع حساب المورّد قبل تفعيله">
                تراجع إدارة ورّدلي بيانات محلك أولاً، ثم تبدأ طلبات الأسعار بالوصول إليك. ستجد حالة المراجعة في صفحة حسابك.
              </Notice>
            )}

            <Button type="submit" size="lg" block loading={register.isPending}>
              {register.isPending ? 'جارٍ إنشاء الحساب…' : 'إنشاء الحساب'}
            </Button>
          </form>
        </div>

        <footer className={styles.foot}>
          <p>
            {copy.switchText} <Link to={copy.switchTo}>{copy.switchLink}</Link>
          </p>
          <p>
            لديك حساب؟ <Link to="/login">سجّل الدخول</Link>
          </p>
        </footer>
      </section>
    </div>
  )
}
