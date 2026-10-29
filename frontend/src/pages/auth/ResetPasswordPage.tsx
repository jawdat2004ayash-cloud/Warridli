import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/ui/Button'
import { ErrorSummary, type SummaryItem } from '../../components/ui/ErrorSummary'
import { Field } from '../../components/ui/Field'
import { Notice } from '../../components/ui/Notice'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { flashState } from '../../features/auth/flash'
import { ApiError } from '../../lib/api'
import { resetPassword } from '../../lib/auth'
import styles from './AuthPage.module.css'

type Errors = { password?: string; password_confirmation?: string }

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [submits, setSubmits] = useState(0)
  const navigate = useNavigate()
  const reset = useMutation({ mutationFn: resetPassword })

  const linkBroken = !token || !email
  const tokenRejected = reset.error instanceof ApiError && reset.error.isValidation && Boolean(reset.error.errors.token)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const found: Errors = {}
    if (password.length < 8) found.password = 'كلمة المرور قصيرة: 8 أحرف على الأقل.'
    else if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) found.password = 'كلمة المرور يجب أن تحتوي على حرف ورقم على الأقل.'
    if (confirmation !== password) found.password_confirmation = 'كلمتا المرور غير متطابقتين. اكتبها مرة أخرى.'
    setErrors(found)
    if (Object.keys(found).length > 0) return setSubmits((n) => n + 1)

    reset.mutate(
      { token, email, password, password_confirmation: confirmation },
      {
        onSuccess: () => navigate('/login', { replace: true, state: flashState('passwordReset') }),
        onError: (error) => {
          if (error instanceof ApiError && error.errors.password?.[0]) {
            setErrors({ password: error.errors.password[0] })
            setSubmits((n) => n + 1)
          }
        },
      },
    )
  }

  const summary: SummaryItem[] = (['password', 'password_confirmation'] as const)
    .filter((field) => errors[field]).map((field) => ({ fieldId: `reset-${field}`, message: errors[field]! }))

  return (
    <div className={styles.page}>
      <section className={styles.sheet} aria-labelledby="reset-title">
        <header className={styles.head}>
          <h1 id="reset-title" className={styles.title}>
            تعيين كلمة مرور جديدة
          </h1>
          {!linkBroken && (
            <p className={styles.lead}>
              للحساب <bdi dir="ltr">{email}</bdi>
            </p>
          )}
        </header>

        <div className={styles.body}>
          {linkBroken || tokenRejected ? (
            <Notice tone="danger" title={linkBroken ? 'الرابط غير مكتمل.' : 'الرابط غير صالح أو انتهت صلاحيته.'}>
              <p>
                افتح الرابط من الرسالة كما هو، أو <Link to="/forgot-password">اطلب رابطاً جديداً</Link>.
              </p>
            </Notice>
          ) : (
            <>
              {reset.isError && !(reset.error instanceof ApiError && reset.error.isValidation) && (
                <Notice tone="danger" title={reset.error.message} focusOnMount />
              )}
              <form className={styles.form} onSubmit={onSubmit} noValidate>
                <ErrorSummary items={summary} focusKey={submits} />
                <Field id="reset-password" label="كلمة المرور الجديدة" hint="8 أحرف على الأقل، فيها حرف ورقم." error={errors.password} required>
                  {(c) => <PasswordInput {...c} autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setErrors((old) => ({ ...old, password: undefined })) }} />}
                </Field>
                <Field id="reset-password_confirmation" label="أعد كتابة كلمة المرور" error={errors.password_confirmation} required>
                  {(c) => (
                    <PasswordInput {...c} autoComplete="new-password" value={confirmation} onChange={(e) => { setConfirmation(e.target.value); setErrors((old) => ({ ...old, password_confirmation: undefined })) }} />
                  )}
                </Field>
                <Button type="submit" size="lg" block loading={reset.isPending}>
                  احفظ كلمة المرور
                </Button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
