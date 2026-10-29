import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Select, TextInput } from '../../components/ui/Field'
import { EmptyState, SkeletonCard } from '../../components/ui/States'
import { useAuditLogs } from '../../features/admin/hooks'
import { AUDIT_ACTION_LABELS, AUDIT_GROUPS, META_LABELS, META_VALUE_LABELS, type AuditEntry, type AuditFilter } from '../../lib/admin'
import { formatDate, formatDateTime } from '../../lib/format'
import { Pager } from '../../components/ui/Pager'
import styles from './Admin.module.css'

const SUBJECT_NAMES: Record<string, string> = { company: 'الشركة', user: 'المستخدم', rfq: 'الطلب', quote: 'العرض', category: 'التصنيف' }

function metaValue(key: string, value: string | number | boolean | null): string {
  if (value === null) return '—'
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا'
  if (key === 'closes_at' && typeof value === 'string') return formatDate(value)
  if ((key === 'from' || key === 'to' || key === 'was' || key === 'status' || key === 'company_type' || key === 'source') && typeof value === 'string') {
    return META_VALUE_LABELS[value] ?? value
  }
  return String(value)
}

function Subject({ subject }: { subject: NonNullable<AuditEntry['subject']> }) {
  const name = SUBJECT_NAMES[subject.type] ?? subject.type
  const label = subject.label ?? `رقم ${subject.id}`
  if (subject.type === 'rfq' && subject.ref) return <>{name}: <Link to={`/admin/rfqs/${subject.ref}`}>{label}</Link></>
  if (subject.type === 'company') return <>{name}: <Link to={`/admin/audit?subject_type=company&subject_id=${subject.id}`}>{label}</Link></>
  return <>{name}: {label}</>
}

function Entry({ entry }: { entry: AuditEntry }) {
  const meta = Object.entries(entry.meta ?? {})
  return (
    <li className={`${styles.card} ${styles.entry}`}>
      <div className={styles.entryHead}>
        <span className={styles.entryAction}>{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</span>
        <time className={styles.entryTime} dateTime={entry.created_at}>
          {formatDateTime(entry.created_at)}
        </time>
      </div>
      <dl className={styles.meta}>
        <div>
          <dt>من نفّذه:</dt>
          <dd>
            {entry.actor ? (
              <>
                {entry.actor.name} {entry.actor.is_admin && <Badge tone="info">مدير</Badge>}{' '}
                <bdi dir="ltr" className={styles.rowSub}>
                  {entry.actor.email}
                </bdi>
              </>
            ) : (
              'النظام (مهمة تلقائية أو سطر الأوامر)'
            )}
          </dd>
        </div>
        {entry.subject && (
          <div>
            <dt>على:</dt>
            <dd>
              <Subject subject={entry.subject} />
            </dd>
          </div>
        )}
        {meta.map(([key, value]) => (
          <div key={key}>
            <dt>{META_LABELS[key] ?? key}:</dt>
            <dd>{metaValue(key, value)}</dd>
          </div>
        ))}
        {entry.ip && (
          <div>
            <dt>عنوان IP:</dt>
            <dd>
              <bdi dir="ltr" className="num">
                {entry.ip}
              </bdi>
            </dd>
          </div>
        )}
      </dl>
      <span className={styles.code} dir="ltr">
        {entry.action}
      </span>
    </li>
  )
}

const FILTER_KEYS = ['group', 'actor', 'from', 'to', 'subject_type', 'subject_id'] as const

export function AdminAuditPage() {
  const [params, setParams] = useSearchParams()
  const filter: AuditFilter = { page: Math.max(1, Number(params.get('page')) || 1) }
  for (const key of FILTER_KEYS) {
    const value = params.get(key)
    if (value) filter[key] = value
  }
  const logs = useAuditLogs(filter)
  const [draft, setDraft] = useState({ group: filter.group ?? '', actor: filter.actor ?? '', from: filter.from ?? '', to: filter.to ?? '' })

  const apply = (event: FormEvent) => {
    event.preventDefault()
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(draft)) if (value) next.set(key, value)
    if (filter.subject_type && filter.subject_id) {
      next.set('subject_type', filter.subject_type)
      next.set('subject_id', filter.subject_id)
    }
    setParams(next)
  }

  const clearSubject = () => {
    const next = new URLSearchParams(params)
    next.delete('subject_type')
    next.delete('subject_id')
    next.delete('page')
    setParams(next)
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>سجل العمليات</h1>
        <p className={styles.lead}>كل قرار وإجراء مهم: من نفّذه، على ماذا، ومتى (بتوقيت دمشق). السجل للقراءة فقط ولا يمكن تعديله. لا تُعرض فيه كلمات مرور أو رموز سرية.</p>
      </header>

      <form className={styles.filters} onSubmit={apply} aria-label="تصفية السجل">
        <Field label="نوع العملية">
          {(control) => (
            <Select {...control} value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })}>
              <option value="">كل العمليات</option>
              {AUDIT_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="من نفّذها">
          {(control) => (
            <Select {...control} value={draft.actor} onChange={(e) => setDraft({ ...draft, actor: e.target.value })}>
              <option value="">الجميع</option>
              <option value="admin">المدراء فقط</option>
              <option value="system">النظام فقط</option>
            </Select>
          )}
        </Field>
        <Field label="من تاريخ">
          {(control) => <TextInput {...control} type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />}
        </Field>
        <Field label="إلى تاريخ">
          {(control) => <TextInput {...control} type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />}
        </Field>
        <div className={styles.filterActions}>
          <Button type="submit" variant="secondary">
            اعرض
          </Button>
          {params.toString() !== '' && (
            <Button
              variant="ghost"
              onClick={() => {
                setDraft({ group: '', actor: '', from: '', to: '' })
                setParams({})
              }}
            >
              امسح التصفية
            </Button>
          )}
        </div>
      </form>

      {filter.subject_type && filter.subject_id && (
        <p className={styles.rowSub}>
          تعرض العمليات على {SUBJECT_NAMES[filter.subject_type] ?? filter.subject_type} رقم <span className="num">{filter.subject_id}</span> فقط.{' '}
          <Button variant="ghost" onClick={clearSubject}>
            اعرض الكل
          </Button>
        </p>
      )}

      {logs.isPending && <SkeletonCard />}
      {logs.isError && (
        <EmptyState
          tone="danger"
          icon="alert"
          title="تعذّر تحميل السجل"
          description={logs.error.message}
          action={<Button variant="secondary" onClick={() => void logs.refetch()}>أعد المحاولة</Button>}
        />
      )}
      {logs.data && logs.data.data.length === 0 && <EmptyState title="لا توجد عمليات مطابقة" description="غيّر التصفية أو وسّع الفترة." />}
      {logs.data && logs.data.data.length > 0 && (
        <>
          <ul className={styles.list} aria-label="العمليات" aria-busy={logs.isPlaceholderData || undefined}>
            {logs.data.data.map((entry) => (
              <Entry key={entry.id} entry={entry} />
            ))}
          </ul>
          <Pager
            page={filter.page}
            lastPage={logs.data.meta.last_page}
            onPage={(p) => {
              const next = new URLSearchParams(params)
              if (p > 1) next.set('page', String(p))
              else next.delete('page')
              setParams(next)
            }}
          />
        </>
      )}
    </div>
  )
}
