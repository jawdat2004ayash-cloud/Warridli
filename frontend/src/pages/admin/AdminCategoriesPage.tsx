import { useState, type FormEvent } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { Notice } from '../../components/ui/Notice'
import { EmptyState, SkeletonCard } from '../../components/ui/States'
import { useToast } from '../../components/ui/toastContext'
import { ConfirmAction } from '../../features/admin/ConfirmAction'
import { useAdminCategories, useCreateCategory, useUpdateCategory } from '../../features/admin/hooks'
import { suppliersLabel, type AdminCategory } from '../../lib/admin'
import { ApiError } from '../../lib/api'
import { formatNumber } from '../../lib/format'
import styles from './Admin.module.css'

type FormErrors = { name_ar?: string; sort?: string; form?: string }

function toErrors(error: unknown): FormErrors {
  if (error instanceof ApiError && error.isValidation) {
    return { name_ar: error.errors.name_ar?.[0], sort: error.errors.sort?.[0] }
  }
  return { form: error instanceof ApiError ? error.message : 'حدث خطأ غير متوقع. أعد المحاولة.' }
}

/** Name + order, shared by "add" and "edit". Order is optional: new categories go to the end. */
function CategoryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: AdminCategory
  submitLabel: string
  onSubmit: (input: { name_ar: string; sort?: number }) => Promise<unknown>
  onCancel?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [sort, setSort] = useState(initial ? String(initial.sort) : '')
  const [errors, setErrors] = useState<FormErrors>({})
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setErrors({ name_ar: 'اكتب اسم التصنيف (حرفان على الأقل).' })
      return
    }
    setPending(true)
    try {
      await onSubmit({ name_ar: trimmed, ...(sort.trim() === '' ? {} : { sort: Number(sort) }) })
      if (!initial) {
        setName('')
        setSort('')
      }
      setErrors({})
    } catch (error) {
      setErrors(toErrors(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <form className={styles.inlineForm} onSubmit={(e) => void submit(e)} noValidate>
      <Field label="اسم التصنيف" required error={errors.name_ar} hint={initial ? undefined : 'كما يقوله أهل السوق، مثال: «بيليا ورولمان (محامل)».'}>
        {(control) => <TextInput {...control} value={name} maxLength={100} onChange={(e) => { setName(e.target.value); setErrors({}) }} />}
      </Field>
      <Field label="الترتيب" optional error={errors.sort}>
        {(control) => (
          <TextInput {...control} value={sort} inputMode="numeric" dir="ltr" onChange={(e) => { setSort(e.target.value.replace(/[^\d]/g, '')); setErrors({}) }} />
        )}
      </Field>
      <div className={styles.formActions}>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            إلغاء
          </Button>
        )}
      </div>
      {errors.form && <Notice tone="danger" title={errors.form} focusOnMount />}
    </form>
  )
}

function CategoryRow({ category }: { category: AdminCategory }) {
  const update = useUpdateCategory()
  const toast = useToast()
  const [editing, setEditing] = useState(false)

  return (
    <li className={styles.card} data-tone={category.is_active ? undefined : 'muted'}>
      {editing ? (
        <CategoryForm
          initial={category}
          submitLabel="احفظ التعديل"
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            await update.mutateAsync({ id: category.id, ...input })
            setEditing(false)
            toast({ tone: 'ok', title: 'تم حفظ التصنيف.', description: input.name_ar })
          }}
        />
      ) : (
        <>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>{category.name}</h2>
            {category.is_active ? <Badge tone="ok">مفعّل</Badge> : <Badge tone="muted">معطّل</Badge>}
          </div>
          <ul className={styles.counts}>
            <li>{suppliersLabel(category.suppliers_count)}</li>
            <li>
              طلبات مفتوحة: <span className="num">{formatNumber(category.open_rfqs_count)}</span>
            </li>
            <li>
              كل الطلبات: <span className="num">{formatNumber(category.rfqs_count)}</span>
            </li>
            <li>
              الترتيب: <span className="num">{formatNumber(category.sort)}</span>
            </li>
          </ul>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              عدّل الاسم أو الترتيب
            </Button>
            {category.is_active ? (
              <ConfirmAction
                variant="danger"
                label="عطّل التصنيف"
                question={`لن يظهر «${category.name}» للمشترين عند طلب جديد ولا للمورّدين عند اختيار تخصصاتهم. الطلبات الحالية (${formatNumber(category.open_rfqs_count)} مفتوحة) والمورّدون المعتمدون فيه يبقون كما هم.`}
                confirmLabel="نعم، عطّله"
                onConfirm={async () => {
                  await update.mutateAsync({ id: category.id, is_active: false })
                  toast({ tone: 'ok', title: 'تم تعطيل التصنيف.', description: category.name })
                }}
              />
            ) : (
              <ConfirmAction
                variant="primary"
                label="فعّل التصنيف"
                question={`سيظهر «${category.name}» من جديد للمشترين والمورّدين.`}
                confirmLabel="نعم، فعّله"
                onConfirm={async () => {
                  await update.mutateAsync({ id: category.id, is_active: true })
                  toast({ tone: 'ok', title: 'تم تفعيل التصنيف.', description: category.name })
                }}
              />
            )}
          </div>
        </>
      )}
    </li>
  )
}

export function AdminCategoriesPage() {
  const categories = useAdminCategories()
  const create = useCreateCategory()
  const toast = useToast()

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>تصنيفات القطع</h1>
        <p className={styles.lead}>
          التصنيف يحدد أي مورّدين يستلمون الطلب. لا يمكن حذف تصنيف حتى تبقى الطلبات السابقة سليمة؛ عطّله بدلاً من ذلك. الترتيب الأصغر يظهر أولاً للمشترين.
        </p>
      </header>

      <section className={styles.card} aria-labelledby="new-category">
        <h2 id="new-category" className={styles.subhead}>
          أضف تصنيفاً
        </h2>
        <CategoryForm
          submitLabel="أضف التصنيف"
          onSubmit={async (input) => {
            const created = await create.mutateAsync(input)
            toast({ tone: 'ok', title: 'تمت إضافة التصنيف.', description: `${created.name} — يظهر الآن للمشترين.` })
          }}
        />
      </section>

      {categories.isPending && <SkeletonCard />}
      {categories.isError && (
        <EmptyState
          tone="danger"
          icon="alert"
          title="تعذّر تحميل التصنيفات"
          description={categories.error.message}
          action={<Button variant="secondary" onClick={() => void categories.refetch()}>أعد المحاولة</Button>}
        />
      )}
      {categories.data && categories.data.length === 0 && <EmptyState title="لا توجد تصنيفات بعد" description="أضف أول تصنيف من النموذج أعلاه." />}
      {categories.data && categories.data.length > 0 && (
        <ul className={styles.list} aria-label="التصنيفات">
          {categories.data.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </ul>
      )}
    </div>
  )
}
