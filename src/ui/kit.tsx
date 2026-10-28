import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RARITY_INFO, type Rarity } from '../core/fright'
import { thumbURL, silhouetteURL } from '../art/thumbs'
import { sfx } from '../audio/audio'

const INK = '#170a24'
type IconName = 'coin' | 'mutagen' | 'flame' | 'gear' | 'flask' | 'clip' | 'book' | 'trophy' | 'bag' | 'share' | 'close' | 'check' | 'lock' | 'star' | 'bolt' | 'skull' | 'play' | 'plus' | 'sort' | 'recycle' | 'swap' | 'gift' | 'info' | 'sound'

export function Icon({ n, size = 24, style }: { n: IconName; size?: number; style?: CSSProperties }) {
  const sp = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  let body: ReactNode
  switch (n) {
    case 'coin':
      body = (<><circle cx="16" cy="16" r="12" fill="#ffd84a" {...sp} /><circle cx="16" cy="16" r="7.4" fill="#ffb800" {...sp} strokeWidth={1.6} /><path d="M16 11.5l1.4 3 3.2.4-2.4 2.2.7 3.2-2.9-1.7-2.9 1.7.7-3.2-2.4-2.2 3.2-.4z" fill="#fff3a8" stroke="none" /></>)
      break
    case 'mutagen':
      body = (<><path d="M12 4h8v3h-1.5v6.2l5.6 10.2a3.2 3.2 0 01-2.8 4.8H10.7a3.2 3.2 0 01-2.8-4.8l5.6-10.2V7H12z" fill="#e8fff0" {...sp} /><path d="M10 21.5l-1.2 1.9a2 2 0 001.8 3.1h10.8a2 2 0 001.8-3.1L22 21.5c-2-1.3-4 1.2-6 0s-4-1.3-6 0z" fill="#7dff3a" {...sp} strokeWidth={1.8} /><circle cx="14" cy="24" r="1.2" fill="#fff" stroke="none" /><circle cx="18.5" cy="22.4" r="1" fill="#fff" stroke="none" /></>)
      break
    case 'flame':
      body = (<><path d="M16 3c1 5 7 8 7 15a7 7 0 01-14 0c0-3 1.5-4.5 3-6 .3 2 1.2 3 2.2 3.2C13.5 11 14 7 16 3z" fill="#ff7a1a" {...sp} /><path d="M16 15c.6 2.6 3.2 3.6 3.2 6.4a3.2 3.2 0 01-6.4 0c0-1.7 1-2.5 1.8-3.4.5.9 1 1.3 1.4 1.3-.1-1.6-.3-2.8 0-4.3z" fill="#ffd84a" stroke="none" /></>)
      break
    case 'gear':
      body = (<><path d="M16 3.5l2.4 3.2 3.9-.9.9 3.9 3.2 2.4-1.4 3.7 1.4 3.7-3.2 2.4-.9 3.9-3.9-.9L16 28.5l-2.4-3.2-3.9.9-.9-3.9-3.2-2.4L7 16l-1.4-3.7 3.2-2.4.9-3.9 3.9.9z" fill="#c9b6ff" {...sp} /><circle cx="16" cy="16" r="4.6" fill="#3b1a73" {...sp} /></>)
      break
    case 'flask':
      body = (<><path d="M12 4h8v2.4h-1.4v6.6l6.9 11.4a3 3 0 01-2.6 4.6H9.1a3 3 0 01-2.6-4.6l6.9-11.4V6.4H12z" fill="#e8fff0" {...sp} /><path d="M9.6 21.2l-2.2 3.6a1.8 1.8 0 001.6 2.8h14a1.8 1.8 0 001.6-2.8l-2.2-3.6c-2.1 1.4-3.7-1.2-6.4 0-2 .9-3.6-.2-4.4 0z" fill="#7dff3a" {...sp} strokeWidth={1.8} /><circle cx="13.5" cy="24.5" r="1.3" fill="#fff" stroke="none" /><circle cx="18.5" cy="23" r="1" fill="#fff" stroke="none" /></>)
      break
    case 'clip':
      body = (<><rect x="6" y="5.5" width="20" height="23" rx="3.5" fill="#fff7e0" {...sp} /><rect x="11.5" y="3" width="9" height="6" rx="2.4" fill="#ffb52e" {...sp} /><path d="M10.5 15h11M10.5 19.5h11M10.5 24h6" {...sp} strokeWidth={2} fill="none" /></>)
      break
    case 'book':
      body = (<><path d="M16 8c-3-2-7-2.5-11-1.5v18c4-1 8-.5 11 1.5 3-2 7-2.5 11-1.5v-18C23 5.5 19 6 16 8z" fill="#ff7ab8" {...sp} /><path d="M16 8v18" {...sp} fill="none" /><path d="M8.5 11.5c2-.4 4-.2 5.5.6M8.5 16c2-.4 4-.2 5.5.6" {...sp} strokeWidth={1.8} fill="none" stroke="#fff" opacity=".7" /></>)
      break
    case 'trophy':
      body = (<><path d="M9 5h14v7a7 7 0 01-14 0z" fill="#ffd84a" {...sp} /><path d="M9 7H4.5c0 4 2 6 5 6.4M23 7h4.5c0 4-2 6-5 6.4" fill="none" {...sp} /><path d="M14 19h4v4h-4z" fill="#e0a82a" {...sp} /><rect x="9.5" y="23" width="13" height="4.5" rx="1.8" fill="#ffb52e" {...sp} /><path d="M12.5 8v4.5" stroke="#fff" strokeWidth="2" opacity=".6" /></>)
      break
    case 'bag':
      body = (<><path d="M6 11h20l-1.6 16.2a2 2 0 01-2 1.8H9.6a2 2 0 01-2-1.8z" fill="#4cc9ff" {...sp} /><path d="M11 14V9a5 5 0 0110 0v5" fill="none" {...sp} /><circle cx="16" cy="19" r="3.2" fill="#fff7e0" {...sp} strokeWidth={1.8} /></>)
      break
    case 'share':
      body = (<><circle cx="23" cy="8" r="3.8" fill="#7dff3a" {...sp} /><circle cx="9" cy="16" r="3.8" fill="#7dff3a" {...sp} /><circle cx="23" cy="24" r="3.8" fill="#7dff3a" {...sp} /><path d="M12.4 14.2l7.2-4.4M12.4 17.8l7.2 4.4" fill="none" {...sp} /></>)
      break
    case 'close':
      body = <path d="M8 8l16 16M24 8L8 24" fill="none" {...sp} strokeWidth={4.2} />
      break
    case 'check':
      body = <path d="M6 17l7 7L26 9" fill="none" {...sp} strokeWidth={4.4} />
      break
    case 'lock':
      body = (<><path d="M10.5 14V10.5a5.5 5.5 0 0111 0V14" fill="none" {...sp} /><rect x="7" y="14" width="18" height="13" rx="3.4" fill="#ffd84a" {...sp} /><circle cx="16" cy="20" r="2" fill={INK} stroke="none" /></>)
      break
    case 'star':
      body = <path d="M16 3.5l3.8 8 8.7 1.1-6.4 6 1.7 8.7L16 23l-7.8 4.3 1.7-8.7-6.4-6 8.7-1.1z" fill="#ffd84a" {...sp} />
      break
    case 'bolt':
      body = <path d="M18.5 3L7 18h8l-2 11L25 13h-8z" fill="#ffd84a" {...sp} />
      break
    case 'skull':
      body = (<><path d="M16 4c-6 0-10 4-10 9.6 0 3.4 1.6 5.6 4 7V26h4v-2.4h4V26h4v-5.4c2.4-1.4 4-3.6 4-7C26 8 22 4 16 4z" fill="#fff7e0" {...sp} /><circle cx="11.6" cy="14" r="2.8" fill={INK} stroke="none" /><circle cx="20.4" cy="14" r="2.8" fill={INK} stroke="none" /></>)
      break
    case 'play':
      body = (<><circle cx="16" cy="16" r="12.5" fill="#ff4fa3" {...sp} /><path d="M13 10.5l9 5.5-9 5.5z" fill="#fff" {...sp} strokeWidth={2} /></>)
      break
    case 'plus':
      body = <path d="M16 6v20M6 16h20" fill="none" {...sp} strokeWidth={4.4} />
      break
    case 'sort':
      body = <path d="M6 9h20M9 16h14M12.5 23h7" fill="none" {...sp} strokeWidth={3.6} />
      break
    case 'recycle':
      body = (<><path d="M9 13a8.5 8.5 0 0114-3.5M23 19a8.5 8.5 0 01-14 3.5" fill="none" {...sp} strokeWidth={3.2} /><path d="M24.5 4.5v6h-6M7.5 27.5v-6h6" fill="none" {...sp} strokeWidth={3.2} /></>)
      break
    case 'swap':
      body = <path d="M5 11h19l-5-5M27 21H8l5 5" fill="none" {...sp} strokeWidth={3.4} />
      break
    case 'gift':
      body = (<><rect x="5" y="12" width="22" height="16" rx="2.6" fill="#ff4fa3" {...sp} /><rect x="3.5" y="8.5" width="25" height="6" rx="2.2" fill="#ff7ab8" {...sp} /><path d="M16 8.5V28" {...sp} /><path d="M16 8.5c-1-4-6.500-5-6.500-1.800 0 1.700 3.500 1.800 6.500 1.800zM16 8.5c1-4 6.500-5 6.500-1.800 0 1.700-3.500 1.800-6.500 1.800z" fill="#ffd84a" {...sp} strokeWidth={2} /></>)
      break
    case 'info':
      body = (<><circle cx="16" cy="16" r="12.5" fill="#4cc9ff" {...sp} /><path d="M16 14.5v7" {...sp} strokeWidth={3.4} /><circle cx="16" cy="10.4" r="1.8" fill={INK} stroke="none" /></>)
      break
    case 'sound':
      body = (<><path d="M5 12h5l7-6v20l-7-6H5z" fill="#c9b6ff" {...sp} /><path d="M21.500 11.500a6 6 0 010 9M24.500 8a10.500 10.500 0 010 16" fill="none" {...sp} /></>)
      break
  }
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 32 32" style={style} aria-hidden="true" focusable="false">
      {body}
    </svg>
  )
}

export function Btn({ children, onClick, variant = 'sun', size = 'md', disabled, className = '', style, label }: { children: ReactNode; onClick?: (e: React.MouseEvent) => void; variant?: 'sun' | 'slime' | 'candy' | 'ghost' | 'cyan' | 'violet'; size?: 'sm' | 'md' | 'lg'; disabled?: boolean; className?: string; style?: CSSProperties; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={disabled}
      style={style}
      onPointerDown={() => !disabled && sfx('tap')}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** number that tweens when it changes */
export function Count({ value, className = '' }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value)
  const [bump, setBump] = useState(0)
  const from = useRef(value)
  useEffect(() => {
    if (value === from.current) return
    const start = from.current
    const t0 = performance.now()
    const dur = Math.min(900, 250 + Math.abs(value - start) * 8)
    let raf = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur)
      const e = 1 - Math.pow(1 - k, 3)
      setShown(Math.round(start + (value - start) * e))
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    setBump((b) => b + 1)
    from.current = value
    return () => cancelAnimationFrame(raf)
  }, [value])
  return (
    <motion.span key={bump} className={`count ${className}`} initial={bump ? { scale: 1.35 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }}>
      {shown.toLocaleString('en-US')}
    </motion.span>
  )
}

export function RarityTag({ r, small }: { r: Rarity; small?: boolean }) {
  const i = RARITY_INFO[r]
  return (
    <span className={`rtag ${small ? 'sm' : ''}`} style={{ ['--rc' as any]: i.color }}>
      {i.label}
    </span>
  )
}

export function Portrait({ code, size = 72, mood = 'idle', silhouette = false, className = '' }: { code: string; size?: number; mood?: 'idle' | 'happy'; silhouette?: boolean; className?: string }) {
  const [src, setSrc] = useState<string>('')
  useEffect(() => {
    const px = Math.min(256, Math.round(size * Math.min(2, window.devicePixelRatio || 1)))
    const id = requestAnimationFrame(() => setSrc(silhouette ? silhouetteURL(code, px) : thumbURL(code, px, mood)))
    return () => cancelAnimationFrame(id)
  }, [code, size, mood, silhouette])
  return src ? <img className={`portrait ${className}`} src={src} width={size} height={size} alt="" draggable={false} /> : <span className={`portrait ph ${className}`} style={{ width: size, height: size }} />
}

export function Sheet({ open, onClose, children, title, wide, tone }: { open: boolean; onClose?: () => void; children: ReactNode; title?: ReactNode; wide?: boolean; tone?: string }) {
  useEffect(() => {
    if (!open || !onClose) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
          <motion.div className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" style={tone ? ({ ['--tone' as any]: tone } as CSSProperties) : undefined} initial={{ y: 80, scale: 0.92, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 60, scale: 0.95, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }}>
            {title && (
              <header className="sheet-h">
                <h2>{title}</h2>
                {onClose && (
                  <button className="x" onClick={onClose} aria-label="Close">
                    <Icon n="close" size={20} />
                  </button>
                )}
              </header>
            )}
            <div className="sheet-b">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Meter({ value, max, color = 'var(--slime)' }: { value: number; max: number; color?: string }) {
  return (
    <div className="meter">
      <div className="meter-f" style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%`, background: color }} />
    </div>
  )
}
