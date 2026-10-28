import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { setTab, useApp, type Tab } from '../app/store'
import { LabScreen, Hud, DragLayer } from './Lab'
import { OrdersView, CodexView, RanksView, ShopView } from './Tabs'
import { ModalHost, ToastHost } from './Modals'
import { Icon } from './kit'
import { dailyOrders, orderMet } from '../core/orders'
import { dayKey } from '../core/daily'

function useDesktop() {
  const q = '(min-width: 980px) and (min-aspect-ratio: 5/4)'
  const [d, setD] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setD(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return d
}

const TABS: { id: Tab; label: string; icon: 'flask' | 'clip' | 'book' | 'trophy' | 'bag' }[] = [
  { id: 'lab', label: 'Lab', icon: 'flask' },
  { id: 'orders', label: 'Orders', icon: 'clip' },
  { id: 'codex', label: 'Codex', icon: 'book' },
  { id: 'ranks', label: 'Ranks', icon: 'trophy' },
  { id: 'shop', label: 'Shop', icon: 'bag' },
]

function TabBar() {
  const s = useApp()
  const orders = dailyOrders(dayKey(s.now))
  const deliverable = orders.some((o) => !s.game.daily.orders[o.id]?.done && s.game.pen.some((c) => orderMet(o, c)))
  const locked = s.busy || s.tutorial >= 0
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => {
        const on = s.tab === t.id
        const dis = locked && t.id !== 'lab'
        return (
          <button key={t.id} className={`tab ${on ? 'on' : ''}`} onClick={() => setTab(t.id)} disabled={dis} aria-current={on ? 'page' : undefined}>
            {on && <motion.span layoutId="tabglow" className="tab-bg" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />}
            <motion.span className="tab-i" animate={{ y: on ? -4 : 0, scale: on ? 1.12 : 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}>
              <Icon n={t.icon} size={28} />
            </motion.span>
            <span className="tab-l">{t.label}</span>
            {t.id === 'orders' && deliverable && !on && <i className="dot" />}
          </button>
        )
      })}
    </nav>
  )
}

export function App() {
  const s = useApp()
  const desktop = useDesktop()
  const showLab = desktop || s.tab === 'lab'
  return (
    <div className="app" data-tab={s.tab} data-busy={s.busy ? 1 : 0}>
      <Hud />
      <main className="body">
        {showLab && <LabScreen />}
        {s.tab !== 'lab' && (
          <section className="tabpanel" key={s.tab}>
            <motion.div className="tabpanel-in" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              {s.tab === 'orders' && <OrdersView />}
              {s.tab === 'codex' && <CodexView />}
              {s.tab === 'ranks' && <RanksView />}
              {s.tab === 'shop' && <ShopView />}
            </motion.div>
          </section>
        )}
      </main>
      <TabBar />
      <ModalHost />
      <DragLayer />
      <ToastHost />
      <AnimatePresence>
        {!s.ready && (
          <motion.div className="splash" exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <div className="logo big">
              <span className="logo-a">MASH-UP</span>
              <span className="logo-b">LAB</span>
            </div>
            <div className="spin" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

