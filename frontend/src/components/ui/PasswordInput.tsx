import { useState, type InputHTMLAttributes } from 'react'
import { Icon } from './Icon'
import { TextInput } from './Field'
import styles from './PasswordInput.module.css'

/** Password field with a show/hide toggle — typing blind on a phone keyboard causes most login failures. */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={styles.wrap}>
      <TextInput {...props} type={visible ? 'text' : 'password'} className={styles.input} />
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-controls={props.id}
      >
        <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
        <span>{visible ? 'إخفاء' : 'إظهار'}</span>
      </button>
    </div>
  )
}
