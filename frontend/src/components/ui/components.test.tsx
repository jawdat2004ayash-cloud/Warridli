import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PartTag } from './Card'
import { Button } from './Button'
import { Field, TextInput } from './Field'
import { ToastProvider } from './Toast'
import { useToast } from './toastContext'

describe('Button', () => {
  it('fires onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>أرسل</Button>)

    await userEvent.click(screen.getByRole('button', { name: 'أرسل' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled and busy while loading, so double submits are impossible', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        أرسل
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'أرسل' })

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('defaults to type="button" so it never submits forms by accident', () => {
    render(<Button>إلغاء</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })
})

describe('Field', () => {
  it('associates the label and hint with the control', () => {
    render(<Field label="رقم القطعة" hint="كما هو مطبوع">{(p) => <TextInput {...p} />}</Field>)

    const input = screen.getByLabelText('رقم القطعة')
    expect(input).toHaveAccessibleDescription('كما هو مطبوع')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('marks the control invalid and announces the error', () => {
    render(
      <Field label="الكمية" required error="أدخل كمية أكبر من صفر.">
        {(p) => <TextInput {...p} />}
      </Field>,
    )

    const input = screen.getByLabelText(/الكمية/)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-required', 'true')
    expect(input).toHaveAccessibleDescription('أدخل كمية أكبر من صفر.')
  })
})

describe('PartTag', () => {
  it('isolates the part number as LTR so bidi cannot reorder it', () => {
    render(<PartTag value="6205-2RS" />)
    const value = screen.getByText('6205-2RS')
    expect(value.tagName).toBe('BDI')
    expect(value).toHaveAttribute('dir', 'ltr')
  })
})

describe('Toast', () => {
  function Trigger() {
    const notify = useToast()
    return <button onClick={() => notify({ tone: 'ok', title: 'أُرسل الطلب' })}>notify</button>
  }

  it('announces toasts in a polite live region and can be dismissed', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')

    await userEvent.click(screen.getByText('notify'))
    expect(region).toHaveTextContent('أُرسل الطلب')

    await userEvent.click(screen.getByRole('button', { name: 'إغلاق التنبيه' }))
    expect(region).not.toHaveTextContent('أُرسل الطلب')
  })

  it('throws a clear error when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger />)).toThrow('useToast must be used inside <ToastProvider>')
  })
})
