import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { Notice } from '../../components/ui/Notice'
import { requestPasswordReset } from '../../lib/auth'
import { useMutation } from '@tanstack/react-query'
import styles from './AuthPage.module.css'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const request = useMutation({ mutationFn: requestPasswordReset })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const value = email.trim()
    if (!value) return setError('اكتب بريدك الإلكتروني.')
    if (!/^\S+@\S+\.\S+$/.test(value)) return setError('اكتب البريد بشكل صحيح، مثل name@example.com.')
    setError(undefined)
    request.mutate(value)
  }

  return (
    <div className={styles.page}>
      <section className={styles.sheet} aria-labelledby="forgot-title">
        <header className={styles.head}>
          <h1 id="forgot-title" className={styles.title}>
            استعادة كلمة المرور
          </h1>
          <p className={styles.lead}>اكتب بريدك الإلكتروني، وسنرسل لك رابطاً لتعيين كلمة مرور جديدة.</p>
        </header>

        <div className={styles.body}>
          {request.isSuccess ? (
            // Same wording whether or not the email exists (D5).
            <Notice focusOnMount tone="ok" title="تم استلام طلبك.">
              إذا كان هذا البريد مسجّلاً لدينا فستصلك رسالة فيها الرابط خلال دقائق. تحقّق أيضاً من مجلد الرسائل غير المرغوب
              فيها. الرابط صالح لمدة ساعة واحدة.
            </Notice>
          ) : (
            <>
              {request.isError && <Notice tone="danger" title={request.error.message} />}
              <form className={styles.form} onSubmit={onSubmit} noValidate>
                <Field id="forgot-email" label="البريد الإلكتروني" error={error} required>
                  {(c) => (
                    <TextInput
                      {...c}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  )}
                </Field>
                <Button type="submit" size="lg" block loading={request.isPending}>
                  أرسل الرابط
                </Button>
              </form>
            </>
          )}
        </div>

        <footer className={styles.foot}>
          <p>
            تذكّرت كلمة المرور؟ <Link to="/login">سجّل الدخول</Link>
          </p>
        </footer>
      </section>
    </div>
  )
}
