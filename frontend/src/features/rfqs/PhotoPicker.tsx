import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Icon } from '../../components/ui/Icon'
import { MAX_PHOTOS, PhotoError, preparePhoto } from '../../lib/images'
import styles from './PhotoPicker.module.css'

export type PickedPhoto = { key: string; file: File; preview: string }

type Props = {
  id: string
  photos: PickedPhoto[]
  /** Receives an updater, because photos are added after async processing. */
  onChange: (update: (current: PickedPhoto[]) => PickedPhoto[]) => void
  error?: string
  describedBy?: string
  onBusyChange?: (busy: boolean) => void
}

let counter = 0

/**
 * Up to MAX_PHOTOS photos, each shrunk in the browser before upload. On phones the native picker
 * offers the camera. Previews use object URLs that are revoked when removed / unmounted.
 */
export function PhotoPicker({ id, photos, onChange, error, describedBy, onBusyChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // Only for revoking previews on unmount.
  const latest = useRef(photos)
  useEffect(() => {
    latest.current = photos
  })
  useEffect(() => () => latest.current.forEach((p) => URL.revokeObjectURL(p.preview)), [])

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const files = Array.from(input.files ?? [])
    input.value = '' // allow picking the same file again after removing it
    if (files.length === 0) return

    const room = MAX_PHOTOS - photos.length
    setProblem(files.length > room ? `يمكنك إرفاق ${MAX_PHOTOS} صور كحد أقصى؛ أُضيفت أول ${room > 0 ? room : 0} فقط.` : null)

    setBusy(true)
    onBusyChange?.(true)
    const added: PickedPhoto[] = []
    for (const file of files.slice(0, Math.max(0, room))) {
      try {
        const prepared = await preparePhoto(file)
        added.push({ key: `p${++counter}`, file: prepared, preview: URL.createObjectURL(prepared) })
      } catch (e) {
        setProblem(e instanceof PhotoError ? e.message : 'تعذّر تجهيز إحدى الصور. جرّب صورة أخرى.')
      }
    }
    setBusy(false)
    onBusyChange?.(false)
    onChange((current) => [...current, ...added].slice(0, MAX_PHOTOS))
  }

  function remove(photo: PickedPhoto) {
    URL.revokeObjectURL(photo.preview)
    onChange((current) => current.filter((p) => p.key !== photo.key))
  }

  const message = error ?? problem
  const full = photos.length >= MAX_PHOTOS

  return (
    <div className={styles.picker}>
      {photos.length > 0 && (
        <ul className={styles.grid} aria-label="الصور المرفقة">
          {photos.map((photo, index) => (
            <li key={photo.key} className={styles.item}>
              <img src={photo.preview} alt={`الصورة ${index + 1}`} className={styles.thumb} />
              <button type="button" className={styles.remove} onClick={() => remove(photo)}>
                <Icon name="close" size={16} />
                <span className="visually-hidden">احذف الصورة {index + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <label className={styles.add} data-busy={busy ? '' : undefined}>
          <input
            id={id}
            type="file"
            accept="image/*"
            multiple
            className="visually-hidden"
            onChange={(e) => void onPick(e)}
            disabled={busy}
            aria-describedby={[message ? `${id}-problem` : '', describedBy].filter(Boolean).join(' ') || undefined}
            aria-invalid={message ? true : undefined}
          />
          <Icon name="camera" size={22} />
          <span>{busy ? 'جارٍ تجهيز الصور…' : photos.length === 0 ? 'صوّر القطعة أو اختر صوراً' : 'أضف صورة أخرى'}</span>
          <span className={styles.count}>
            {photos.length}/{MAX_PHOTOS}
          </span>
        </label>
      )}

      <output className={styles.status}>{busy ? 'جارٍ تجهيز الصور…' : ''}</output>
      {message && (
        <p id={`${id}-problem`} className={styles.error} role={error ? undefined : 'alert'}>
          {message}
        </p>
      )}
    </div>
  )
}
