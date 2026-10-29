import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/ui/Button'
import { ErrorSummary } from '../../components/ui/ErrorSummary'
import { Field, TextInput } from '../../components/ui/Field'
import { Notice } from '../../components/ui/Notice'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { flashState, useFlash } from '../../features/auth/flash'
import { useLogin } from '../../features/auth/hooks'
import { ApiError } from '../../lib/api'
import { safeNextPath } from '../../lib/auth'
import styles from './AuthPage.module.css'

type Errors = { email?: string; password?: string }

function validate(email: string, password: string): Errors {
  const errors: Errors = {}
  if (!email.trim()) errors.email = 'اكتب بريدك الإلكتروني.'
  else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'اكتب البريد بشكل صحيح، مثل name@example.com.'
  if (!password) errors.password = 'اكتب كلمة المرور.'
  return errors
}

/** Server answers are mapped to our own wording (F4); the server's 422 text is already plain Arabic (D20). */
function failureMessage(error: unknown): { title: string; text?: string } {
  if (error instanceof ApiError) {
    if (error.status === 422) return { title: error.errors.email?.[0] ?? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' }
    if (error.status === 403) return { title: 'هذا الحساب موقوف.', text: 'تواصل مع إدارة ورّدلي لمعرفة السبب.' }
    return { title: error.message }
  }
  return { title: 'حدث خطأ غير متوقع. أعد المحاولة.' }
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [submits, setSubmits] = useState(0)
  const login = useLogin()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const flash = useFlash()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const found = validate(email, password)
    setErrors(found)
    if (Object.keys(found).length > 0) return setSubmits((n) => n + 1)

    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => navigate(safeNextPath(params.get('next')) ?? '/account', { replace: true, state: flashState('loggedIn') }),
        onError: () => setPassword(''),
      },
    )
  }

  const failure = login.isError ? failureMessage(login.error) : null

  return (
    <div className={styles.page}>
      {flash === 'loggedOut' && <Notice tone="ok" title="سجّلت الخروج بنجاح." />}
      {flash === 'passwordReset' && (
        <Notice tone="ok" title="تم تغيير كلمة المرور.">
          سجّل الدخول الآن بكلمة المرور الجديدة.
        </Notice>
      )}
      {params.get('next') && !flash && <Notice tone="info" title="سجّل الدخول للمتابعة." />}

      <section className={styles.sheet} aria-labelledby="login-title">
        <header className={styles.head}>
          <h1 id="login-title" className={styles.title}>
            تسجيل الدخول
          </h1>
          <p className={styles.lead}>ادخل ببريدك الإلكتروني وكلمة المرور.</p>
        </header>

        <div className={styles.body}>
          <ErrorSummary
            focusKey={submits}
            items={(Object.entries(errors) as [keyof Errors, string | undefined][]).filter((entry): entry is [keyof Errors, string] => Boolean(entry[1])).map(([field, message]) => ({ fieldId: `login-${field}`, message }))}
          />
          {failure && (
            <Notice focusOnMount tone="danger" title={failure.title}>
              {failure.text}
            </Notice>
          )}

          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <Field id="login-email" label="البريد الإلكتروني" error={errors.email} required>
              {(control) => (
                <TextInput
                  {...control}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setErrors((e) => ({ ...e, email: undefined }))
                  }}
                />
              )}
            </Field>

            <div className={styles.section}>
              <Field id="login-password" label="كلمة المرور" error={errors.password} required>
                {(control) => (
                  <PasswordInput
                    {...control}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setErrors((e) => ({ ...e, password: undefined }))
                    }}
                  />
                )}
              </Field>
              <Link to="/forgot-password" className={styles.inlineLink}>
                نسيت كلمة المرور؟
              </Link>
            </div>

            <Button type="submit" size="lg" block loading={login.isPending}>
              {login.isPending ? 'جارٍ الدخول…' : 'دخول'}
            </Button>
          </form>
        </div>

        <footer className={styles.foot}>
          <p>
            ليس لديك حساب؟ <Link to="/register">أنشئ حساباً جديداً</Link>
          </p>
        </footer>
      </section>
    </div>
  )
}
