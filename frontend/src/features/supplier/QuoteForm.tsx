import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { ErrorSummary, type SummaryItem } from '../../components/ui/ErrorSummary'
import { Field, Select, TextArea, TextInput } from '../../components/ui/Field'
import { Money } from '../../components/ui/Money'
import { Notice } from '../../components/ui/Notice'
import { ApiError } from '../../lib/api'
import type { Currency } from '../../lib/format'
import { toLatinDigits } from '../../lib/phone'
import { UNIT_LABELS } from '../../lib/rfqs'
import {
  CONDITION_LABELS,
  CURRENCY_OPTIONS,
  damascusDate,
  MAX_VALID_DAYS,
  FULFILLMENT_LABELS,
  normalizePrice,
  STOCK_LABELS,
  type Fulfillment,
  type Quote,
  type QuoteCondition,
  type StockStatus,
  type SupplierRfq,
} from '../../lib/supplier'
import { useSaveQuote } from './hooks'
import rfqStyles from '../../pages/rfqs/Rfq.module.css'
import authStyles from '../../pages/auth/AuthPage.module.css'

type FieldName = 'unit_price' | 'currency' | 'condition' | 'stock_status' | 'lead_time_days' | 'fulfillment' | 'valid_until' | 'brand' | 'origin' | 'notes'
type Values = {
  unit_price: string
  currency: Currency
  condition: QuoteCondition
  stock_status: StockStatus
  lead_time_days: string
  fulfillment: Fulfillment
  valid_until: string
  brand: string
  origin: string
  notes: string
}
type Errors = Partial<Record<FieldName, string>>

const ORDER: FieldName[] = ['unit_price', 'currency', 'condition', 'stock_status', 'lead_time_days', 'fulfillment', 'valid_until', 'brand', 'origin', 'notes']
const TARGET: Partial<Record<FieldName, string>> = { condition: 'q-condition-new', stock_status: 'q-stock-in_stock' }
const CONDITION_OPTIONS = (Object.keys(CONDITION_LABELS) as QuoteCondition[]).map((value) => ({ value, ...CONDITION_LABELS[value] }))
const STOCK_OPTIONS = (Object.keys(STOCK_LABELS) as StockStatus[]).map((value) => ({ value, ...STOCK_LABELS[value] }))


function initial(quote: Quote | null): Values {
  return {
    unit_price: quote ? quote.unit_price.replace(/\.00$/, '') : '',
    currency: quote?.currency ?? 'SYP',
    condition: quote?.condition ?? 'new',
    stock_status: quote?.stock_status ?? 'in_stock',
    lead_time_days: quote && quote.stock_status === 'on_order' ? String(quote.lead_time_days) : '',
    fulfillment: quote?.fulfillment ?? 'pickup',
    // An expired date from an old quote is replaced by a fresh default.
    valid_until: quote && quote.valid_until >= damascusDate() ? quote.valid_until : damascusDate(7),
    brand: quote?.brand ?? '',
    origin: quote?.origin ?? '',
    notes: quote?.notes ?? '',
  }
}

function validate(v: Values): Errors {
  const e: Errors = {}
  const price = normalizePrice(v.unit_price)
  if (!v.unit_price.trim()) e.unit_price = 'اكتب سعر القطعة الواحدة.'
  else if (price === null) e.unit_price = 'اكتب السعر أرقاماً فقط، مثل 125000 أو 12.50.'
  else if (Number(price) <= 0) e.unit_price = 'السعر يجب أن يكون أكبر من صفر.'
  else if (Number(price) > 999_999_999_999.99) e.unit_price = 'السعر كبير جداً. تحقّق من عدد الأصفار.'
  if (v.stock_status === 'on_order') {
    const days = toLatinDigits(v.lead_time_days.trim())
    if (!days) e.lead_time_days = 'اكتب خلال كم يوم تتوفر القطعة.'
    else if (!/^\d+$/.test(days) || Number(days) < 1 || Number(days) > 365) e.lead_time_days = 'اكتب عدد أيام بين 1 و365.'
  }
  if (!v.valid_until) e.valid_until = 'اختر حتى متى يبقى سعرك صالحاً.'
  else if (v.valid_until < damascusDate()) e.valid_until = 'تاريخ صلاحية العرض لا يمكن أن يكون في الماضي.'
  else if (v.valid_until > damascusDate(MAX_VALID_DAYS)) e.valid_until = `صلاحية العرض ${MAX_VALID_DAYS} يوماً كحد أقصى.`
  return e
}

type Props = { rfq: SupplierRfq; onDone: (rfq: SupplierRfq) => void; onCancel?: () => void }

/**
 * Price first, then the few facts a buyer compares (condition, availability, pickup/delivery, validity);
 * brand/origin/notes are optional and folded away. The server validates everything again.
 */
export function QuoteForm({ rfq, onDone, onCancel }: Props) {
  const editing = rfq.my_quote?.status === 'submitted'
  const [values, setValues] = useState<Values>(() => initial(rfq.my_quote))
  const [errors, setErrors] = useState<Errors>({})
  const [submits, setSubmits] = useState(0)
  const save = useSaveQuote(rfq.id)

  const set = (field: keyof Values) => (event: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: event.target.value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return setSubmits((n) => n + 1)

    save.mutate(
      {
        unit_price: normalizePrice(values.unit_price)!,
        currency: values.currency,
        condition: values.condition,
        stock_status: values.stock_status,
        lead_time_days: values.stock_status === 'on_order' ? Number(toLatinDigits(values.lead_time_days.trim())) : undefined,
        fulfillment: values.fulfillment,
        valid_until: values.valid_until,
        brand: values.brand.trim() || undefined,
        origin: values.origin.trim() || undefined,
        notes: values.notes.trim() || undefined,
      },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (error instanceof ApiError && error.isValidation) {
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

  const price = normalizePrice(values.unit_price)
  const total = price !== null && Number(price) > 0 ? Number(price) * rfq.quantity : null
  const failure = save.error instanceof Error && !(save.error instanceof ApiError && save.error.isValidation) ? save.error.message : null
  const summary: SummaryItem[] = ORDER.filter((f) => errors[f]).map((f) => ({ fieldId: TARGET[f] ?? `q-${f}`, message: errors[f]! }))

  return (
    <form className={authStyles.form} onSubmit={onSubmit} noValidate aria-labelledby="quote-form-title">
      <h2 id="quote-form-title" className={rfqStyles.sectionTitle}>
        {editing ? 'تعديل عرضك' : 'عرض سعرك'}
      </h2>
      <ErrorSummary items={summary} focusKey={submits} />
      {failure && <Notice focusOnMount tone="danger" title={failure} />}

      <div className={rfqStyles.quantityRow}>
        <Field id="q-unit_price" label="سعر القطعة الواحدة" error={errors.unit_price} required>
          {(c) => <TextInput {...c} inputMode="decimal" dir="ltr" autoComplete="off" value={values.unit_price} onChange={set('unit_price')} />}
        </Field>
        <Field id="q-currency" label="العملة" error={errors.currency}>
          {(c) => (
            <Select {...c} value={values.currency} onChange={set('currency')}>
              {CURRENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <p className={rfqStyles.groupHint} aria-live="polite">
        {total !== null ? (
          <>
            المجموع لـ <span className="num">{rfq.quantity}</span> {UNIT_LABELS[rfq.unit]}: <strong><Money amount={total} currency={values.currency} /></strong>
          </>
        ) : (
          `الطلب: ${rfq.quantity} ${UNIT_LABELS[rfq.unit]}. اكتب سعر القطعة الواحدة ونحسب المجموع.`
        )}
      </p>

      <fieldset className={rfqStyles.choiceGroup}>
        <legend className={rfqStyles.groupLabel}>حالة القطعة</legend>
        <div className={rfqStyles.choices}>
          {CONDITION_OPTIONS.map((option) => (
            <label key={option.value} className={rfqStyles.choice}>
              <input id={`q-condition-${option.value}`} type="radio" name="condition" value={option.value} checked={values.condition === option.value} onChange={set('condition')} className={rfqStyles.radio} />
              <span className={`${rfqStyles.choiceText} ${rfqStyles.choiceStrong}`}>
                {option.label}
                <span className={rfqStyles.choiceHint}>{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={rfqStyles.choiceGroup}>
        <legend className={rfqStyles.groupLabel}>هل القطعة متوفرة؟</legend>
        <div className={rfqStyles.choices}>
          {STOCK_OPTIONS.map((option) => (
            <label key={option.value} className={rfqStyles.choice}>
              <input id={`q-stock-${option.value}`} type="radio" name="stock_status" value={option.value} checked={values.stock_status === option.value} onChange={set('stock_status')} className={rfqStyles.radio} />
              <span className={`${rfqStyles.choiceText} ${rfqStyles.choiceStrong}`}>
                {option.label}
                <span className={rfqStyles.choiceHint}>{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {values.stock_status === 'on_order' && (
        <Field id="q-lead_time_days" label="خلال كم يوم تتوفر؟" hint="عدد الأيام، مثل 3." error={errors.lead_time_days} required>
          {(c) => <TextInput {...c} inputMode="numeric" dir="ltr" value={values.lead_time_days} onChange={set('lead_time_days')} />}
        </Field>
      )}

      <div className={authStyles.pair}>
        <Field id="q-fulfillment" label="الاستلام" error={errors.fulfillment}>
          {(c) => (
            <Select {...c} value={values.fulfillment} onChange={set('fulfillment')}>
              {(Object.keys(FULFILLMENT_LABELS) as Fulfillment[]).map((value) => (
                <option key={value} value={value}>
                  {FULFILLMENT_LABELS[value]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="q-valid_until" label="السعر صالح حتى" hint={`حتى ${MAX_VALID_DAYS} يوماً من اليوم.`} error={errors.valid_until} required>
          {(c) => <TextInput {...c} type="date" dir="ltr" min={damascusDate()} max={damascusDate(MAX_VALID_DAYS)} value={values.valid_until} onChange={set('valid_until')} />}
        </Field>
      </div>

      <details className={rfqStyles.more} open={Boolean(values.brand || values.origin || values.notes || errors.brand || errors.origin || errors.notes) || undefined}>
        <summary className={rfqStyles.moreSummary}>تفاصيل إضافية (اختياري)</summary>
        <div className={authStyles.form}>
          <div className={authStyles.pair}>
            <Field id="q-brand" label="الماركة" hint="مثل SKF أو FAG." error={errors.brand} optional>
              {(c) => <TextInput {...c} maxLength={100} value={values.brand} onChange={set('brand')} />}
            </Field>
            <Field id="q-origin" label="بلد المنشأ" hint="كما هو مذكور على العلبة أو الفاتورة." error={errors.origin} optional>
              {(c) => <TextInput {...c} maxLength={100} value={values.origin} onChange={set('origin')} />}
            </Field>
          </div>
          <Field id="q-notes" label="ملاحظات للمشتري" hint="مثل: كفالة، أو بديل مكافئ." error={errors.notes} optional>
            {(c) => <TextArea {...c} rows={3} maxLength={1000} value={values.notes} onChange={set('notes')} />}
          </Field>
        </div>
      </details>

      <div className={rfqStyles.confirmActions}>
        <Button type="submit" size="lg" loading={save.isPending}>
          {save.isPending ? 'جارٍ الإرسال…' : editing ? 'احفظ التعديل' : 'أرسل العرض'}
        </Button>
        {onCancel && (
          <Button variant="secondary" size="lg" onClick={onCancel} disabled={save.isPending}>
            تراجع
          </Button>
        )}
      </div>
    </form>
  )
}
