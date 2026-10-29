import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { UrgencyBadge, type Urgency } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ErrorSummary, type SummaryItem } from '../../components/ui/ErrorSummary'
import { Field, Select, TextArea, TextInput } from '../../components/ui/Field'
import { Notice } from '../../components/ui/Notice'
import { flashState } from '../../features/auth/flash'
import { useAreas, useMe } from '../../features/auth/hooks'
import { useCategories, useCreateRfq } from '../../features/rfqs/hooks'
import { PhotoPicker, type PickedPhoto } from '../../features/rfqs/PhotoPicker'
import { ApiError } from '../../lib/api'
import { toLatinDigits } from '../../lib/phone'
import { UNIT_LABELS, UNKNOWN_CATEGORY, URGENCY_OPTIONS, type Unit } from '../../lib/rfqs'
import authStyles from '../auth/AuthPage.module.css'
import styles from './Rfq.module.css'

type FieldName = 'description' | 'photos' | 'part_number' | 'quantity' | 'unit' | 'urgency' | 'category' | 'area_id' | 'machine_make' | 'machine_model'
type Values = Omit<Record<FieldName, string>, 'photos' | 'unit' | 'urgency'> & { unit: Unit; urgency: Urgency }
type Errors = Partial<Record<FieldName, string>>

/** Visual order; also the order of the error summary. */
const ORDER: FieldName[] = ['description', 'photos', 'part_number', 'quantity', 'unit', 'urgency', 'category', 'area_id', 'machine_make', 'machine_model']

/** Where the error summary sends focus for each field (radio groups: their first option). */
const TARGET: Partial<Record<FieldName, string>> = { urgency: 'rfq-urgency-normal', category: 'rfq-category-first' }

function validate(v: Values): Errors {
  const e: Errors = {}
  if (!v.description.trim()) e.description = 'اكتب وصفاً للقطعة التي تحتاجها.'
  else if (v.description.trim().length < 3) e.description = 'اكتب وصفاً أوضح للقطعة (3 أحرف على الأقل).'
  const quantity = toLatinDigits(v.quantity.trim())
  if (!quantity) e.quantity = 'اكتب الكمية.'
  else if (!/^\d+$/.test(quantity) || Number(quantity) < 1) e.quantity = 'الكمية رقم صحيح أكبر من صفر، مثل 2.'
  else if (Number(quantity) > 100000) e.quantity = 'الكمية كبيرة جداً.'
  if (!v.category) e.category = 'اختر تصنيفاً، أو اختر «لا أعرف التصنيف».'
  if (!v.area_id) e.area_id = 'اختر المنطقة.'
  return e
}

/** Server keys for photos are `photos` or `photos.N`; show them on the picker. */
function fromServer(errors: Record<string, string[]>): Errors {
  const out: Errors = {}
  for (const [key, messages] of Object.entries(errors)) {
    const field = (key.startsWith('photos') ? 'photos' : key) as FieldName
    if (ORDER.includes(field) && messages[0] && !out[field]) out[field] = messages[0]
  }
  return out
}

export function NewRfqPage() {
  const me = useMe().data
  const areas = useAreas()
  const categories = useCategories()
  const create = useCreateRfq()
  const navigate = useNavigate()

  const [values, setValues] = useState<Values>(() => ({
    description: '',
    part_number: '',
    quantity: '1',
    unit: 'piece',
    urgency: 'normal',
    category: '',
    area_id: me?.company ? String(me.company.area.id) : '',
    machine_make: '',
    machine_model: '',
  }))
  const [photos, setPhotos] = useState<PickedPhoto[]>([])
  const [preparing, setPreparing] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [submits, setSubmits] = useState(0)

  const set = (field: keyof Values) => (event: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: event.target.value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return setSubmits((n) => n + 1)

    create.mutate(
      {
        description: values.description.trim(),
        part_number: values.part_number.trim() || undefined,
        machine_make: values.machine_make.trim() || undefined,
        machine_model: values.machine_model.trim() || undefined,
        quantity: Number(toLatinDigits(values.quantity.trim())),
        unit: values.unit,
        urgency: values.urgency,
        area_id: Number(values.area_id),
        category: values.category,
        photos: photos.map((p) => p.file),
      },
      {
        onSuccess: (rfq) => navigate(`/rfqs/${rfq.id}`, { replace: true, state: flashState('rfqCreated') }),
        onError: (error) => {
          if (error instanceof ApiError && error.isValidation) {
            setErrors(fromServer(error.errors))
            setSubmits((n) => n + 1)
          }
        },
      },
    )
  }

  const failure =
    create.error instanceof Error && !(create.error instanceof ApiError && create.error.isValidation) ? create.error.message : null
  const categoryOptions: { value: string; label: string; hint?: string }[] = categories.data
    ? [
        ...categories.data.map((c) => ({ value: String(c.id), label: c.name })),
        { value: UNKNOWN_CATEGORY, label: 'لا أعرف التصنيف', hint: 'لا مشكلة: تحدد إدارة ورّدلي التصنيف المناسب أولاً، ثم يصل طلبك إلى المورّدين.' },
      ]
    : []
  const summary: SummaryItem[] = ORDER.filter((f) => errors[f]).map((f) => ({ fieldId: TARGET[f] ?? `rfq-${f}`, message: errors[f]! }))

  return (
    <div className={`${authStyles.page} ${authStyles.wide}`}>
      <section className={authStyles.sheet} aria-labelledby="rfq-title">
        <header className={authStyles.head}>
          <p className={authStyles.kicker}>طلب سعر جديد</p>
          <h1 id="rfq-title" className={authStyles.title}>
            ما القطعة التي تحتاجها؟
          </h1>
          <p className={authStyles.lead}>لا تحتاج إلى معرفة الاسم التقني. صورة واضحة ووصف بكلماتك يكفيان ليفهم المورّد طلبك.</p>
        </header>

        <div className={authStyles.body}>
          <ErrorSummary items={summary} focusKey={submits} />
          {failure && <Notice focusOnMount tone="danger" title={failure} />}

          <form className={authStyles.form} onSubmit={onSubmit} noValidate>
            <fieldset className={authStyles.section}>
              <legend className={authStyles.legend}>
                <span className={authStyles.step}>1</span>
                القطعة
              </legend>
              <Field
                id="rfq-description"
                label="صف القطعة"
                hint="بكلماتك: اسمها إن كنت تعرفه، في أي آلة هي، وما الذي تعطّل. مثال: بيليا محرك مضخة المياه، صار لها صوت."
                error={errors.description}
                required
              >
                {(c) => <TextArea {...c} rows={4} maxLength={2000} value={values.description} onChange={set('description')} />}
              </Field>

              <div className={styles.group}>
                <p className={styles.groupLabel} id="rfq-photos-label">
                  صور القطعة <span className={styles.optional}>(اختياري، وننصح بها)</span>
                </p>
                <p className={styles.groupHint} id="rfq-photos-hint">
                  صوّر القطعة القديمة أو اللوحة المكتوب عليها الرقم. حتى 5 صور، ونصغّرها تلقائياً لتوفير الإنترنت.
                </p>
                <PhotoPicker
                  id="rfq-photos"
                  photos={photos}
                  onChange={(update) => {
                    setPhotos(update)
                    setErrors((e) => ({ ...e, photos: undefined }))
                  }}
                  error={errors.photos}
                  describedBy="rfq-photos-label rfq-photos-hint"
                  onBusyChange={setPreparing}
                />
              </div>

              <Field
                id="rfq-part_number"
                label="رقم القطعة أو الكتابة عليها"
                // LRI…PDI isolate the Latin example, otherwise the bidi algorithm shows "2RS-6205" (F3).
                hint={'إن وجدت رقماً أو حروفاً مطبوعة على القطعة فاكتبها كما هي، مثل ⁦6205-2RS⁩.'}
                error={errors.part_number}
                optional
              >
                {(c) => <TextInput {...c} dir="ltr" maxLength={100} autoComplete="off" value={values.part_number} onChange={set('part_number')} />}
              </Field>
            </fieldset>

            <fieldset className={authStyles.section}>
              <legend className={authStyles.legend}>
                <span className={authStyles.step}>2</span>
                الكمية والاستعجال
              </legend>
              <div className={styles.quantityRow}>
                <Field id="rfq-quantity" label="الكمية" error={errors.quantity} required>
                  {(c) => <TextInput {...c} inputMode="numeric" dir="ltr" value={values.quantity} onChange={set('quantity')} />}
                </Field>
                <Field id="rfq-unit" label="الوحدة" error={errors.unit}>
                  {(c) => (
                    <Select {...c} value={values.unit} onChange={set('unit')}>
                      {(Object.keys(UNIT_LABELS) as Unit[]).map((unit) => (
                        <option key={unit} value={unit}>
                          {UNIT_LABELS[unit]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>

              <fieldset className={styles.choiceGroup} aria-describedby={errors.urgency ? 'rfq-urgency-error' : undefined}>
                <legend className={styles.groupLabel}>متى تحتاجها؟</legend>
                <div className={styles.choices}>
                  {URGENCY_OPTIONS.map((option) => (
                    <label key={option.value} className={styles.choice}>
                      <input
                        id={`rfq-urgency-${option.value}`}
                        type="radio"
                        name="urgency"
                        value={option.value}
                        checked={values.urgency === option.value}
                        onChange={set('urgency')}
                        className={styles.radio}
                      />
                      <span className={styles.choiceText}>
                        <UrgencyBadge urgency={option.value} />
                        <span className={styles.choiceHint}>{option.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {errors.urgency && (
                  <p id="rfq-urgency-error" className={styles.error}>
                    {errors.urgency}
                  </p>
                )}
              </fieldset>
            </fieldset>

            <fieldset className={authStyles.section}>
              <legend className={authStyles.legend}>
                <span className={authStyles.step}>3</span>
                التصنيف
              </legend>
              <fieldset
                className={styles.choiceGroup}
                aria-describedby={['rfq-category-hint', errors.category ? 'rfq-category-error' : ''].filter(Boolean).join(' ')}
                aria-invalid={errors.category ? true : undefined}
              >
                <legend className={styles.groupLabel}>
                  من أي نوع هذه القطعة؟ <span className={styles.required} aria-hidden="true">*</span>
                </legend>
                <p id="rfq-category-hint" className={styles.groupHint}>
                  نرسل الطلب للمورّدين المختصين بهذا النوع. إن لم تكن متأكداً فاختر «لا أعرف التصنيف».
                </p>
                {errors.category && (
                  <p id="rfq-category-error" className={styles.error}>
                    {errors.category}
                  </p>
                )}
                {categories.isPending && <p className={styles.groupHint}>جارٍ تحميل التصنيفات…</p>}
                {categories.isError && (
                  <Notice tone="danger" title="تعذّر تحميل التصنيفات.">
                    <Button variant="secondary" onClick={() => void categories.refetch()}>
                      أعد المحاولة
                    </Button>
                  </Notice>
                )}
                <div className={styles.choices}>
                  {categoryOptions.map((option, index) => (
                    <label key={option.value} className={styles.choice} data-unknown={option.value === UNKNOWN_CATEGORY ? '' : undefined}>
                      <input
                        id={index === 0 ? 'rfq-category-first' : `rfq-category-${option.value}`}
                        type="radio"
                        name="category"
                        value={option.value}
                        checked={values.category === option.value}
                        onChange={set('category')}
                        className={styles.radio}
                      />
                      <span className={styles.choiceText}>
                        <span className={styles.choiceLabel}>{option.label}</span>
                        {option.hint && <span className={styles.choiceHint}>{option.hint}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </fieldset>

            <fieldset className={authStyles.section}>
              <legend className={authStyles.legend}>
                <span className={authStyles.step}>4</span>
                المكان
              </legend>
              <Field
                id="rfq-area_id"
                label="أين تحتاج القطعة؟"
                hint="اخترنا منطقة منشأتك تلقائياً؛ غيّرها إن كانت القطعة لمكان آخر."
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

              <details className={styles.more} open={Boolean(errors.machine_make || errors.machine_model) || undefined}>
                <summary className={styles.moreSummary}>معلومات عن الآلة (اختياري)</summary>
                <div className={authStyles.pair}>
                  <Field id="rfq-machine_make" label="ماركة الآلة" hint="مثل: سيمنس، دايو." error={errors.machine_make} optional>
                    {(c) => <TextInput {...c} maxLength={100} value={values.machine_make} onChange={set('machine_make')} />}
                  </Field>
                  <Field id="rfq-machine_model" label="موديل الآلة" error={errors.machine_model} optional>
                    {(c) => <TextInput {...c} dir="ltr" maxLength={100} value={values.machine_model} onChange={set('machine_model')} />}
                  </Field>
                </div>
              </details>
            </fieldset>

            <Notice tone="info" title="طلبك خاص">
              لا يرى المورّدون اسم منشأتك ولا رقمك. أنت من يقرر التواصل مع من يعجبك عرضه.
            </Notice>

            <Button type="submit" size="lg" block loading={create.isPending} disabled={preparing}>
              {create.isPending ? 'جارٍ إرسال الطلب…' : preparing ? 'انتظر تجهيز الصور…' : 'أرسل الطلب'}
            </Button>
          </form>
        </div>
      </section>
    </div>
  )
}
