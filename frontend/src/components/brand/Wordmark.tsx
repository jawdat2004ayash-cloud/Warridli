import styles from './Wordmark.module.css'

/** Hex-nut mark + Arabic wordmark. Latin transliteration as a quiet mono sub-label. */
export function Wordmark({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <span className={`${styles.wordmark} ${inverse ? styles.inverse : ''}`}>
      <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M16 3.5 26.8 9.75v12.5L16 28.5 5.2 22.25V9.75z" className={styles.nut} />
        <circle cx="16" cy="16" r="5" className={styles.bore} />
      </svg>
      <span className={styles.text}>
        <span className={styles.name}>ورّدلي</span>
        {!compact && (
          <span className={styles.latin} lang="en" dir="ltr">
            WARRIDLI
          </span>
        )}
      </span>
    </span>
  )
}
