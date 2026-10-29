import type { SVGProps } from 'react'

/** Small stroke icon set (24px grid, 1.75 stroke). Directional icons mirror automatically in RTL. */
const PATHS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 8v5M12 16.5v.5M10.3 3.9L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  camera: 'M4 8h3l2-2.5h6L17 8h3v11H4zM12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7',
  box: 'M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5L12 12l8.5-4.5M12 12v9',
  chevron: 'M9 5l7 7-7 7',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M3.5 3.5l17 17M10.6 5.6A9 9 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 01-2.9 3.7M6.6 6.7C3.9 8.5 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 004.9-1.4M9.9 9.9a3 3 0 004.2 4.2',
  wrench: 'M14.5 6.5a4 4 0 00-5.2 5.2l-5.6 5.6a1.6 1.6 0 002.2 2.2l5.6-5.6a4 4 0 005.2-5.2l-2.4 2.4-2.2-.5-.5-2.2z',
  store: 'M4 10.5V20h16v-9.5M3 4h18l-1 5a2.7 2.7 0 01-5 0 2.7 2.7 0 01-6 0 2.7 2.7 0 01-5 0zM10 20v-5h4v5',
  bell: 'M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15zM10 20.5a2 2 0 004 0',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5a7.5 7.5 0 0115 0',
  whatsapp:'M4 20l1.2-4A8 8 0 1112 20a8 8 0 01-3.9-1zM9 8.5c0 3 2.5 6.5 6.5 6.5l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z',
} as const

export type IconName = keyof typeof PATHS

const DIRECTIONAL: ReadonlySet<IconName> = new Set(['chevron'])

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number; label?: string }

export function Icon({ name, size = 20, label, style, ...rest }: IconProps) {
  const mirror = DIRECTIONAL.has(name)
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={mirror ? { transform: 'scaleX(var(--dir-flip, -1))', ...style } : style}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
