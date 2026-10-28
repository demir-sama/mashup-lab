import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Stage, type StageLayout } from '../stage/Stage'
import {
  advanceTutorial, clearSlot, dismissReveal, fuse, getApp, openModal, penOf, placeAt, resolveFull, rushLeft, setMode, setSetting, setSort, setTab, shareCreature, skipTutorial, slotCreatures, stageHandle, syncStage, tapCreature, toggleBoost, useApp, type App,
} from '../app/store'
import { Btn, Count, Icon, Portrait, RarityTag } from './kit'
import { RARITY_INFO, rarityRank } from '../core/fright'
import type { Creature } from '../core/creature'
import { genomeOf } from '../core/creature'
import { SLOTS, partAt, PARTS_BY_SLOT, type Slot } from '../core/parts'
import { partIconURL } from '../art/thumbs'
import { penPrice, recycleValue, RUSH_FREE_ATTEMPTS } from '../core/state'
import { RUSH_FUSIONS } from '../core/rush'
import { sfx } from '../audio/audio'

// ---------- HUD ----------
export function Hud() {
  const s = useApp()
  const e = s.game.eco
  return (
    <header className="hud">
      <div className="logo" aria-label="Mash-Up Lab">
        <span className="logo-a">MASH-UP</span>
        <span className="logo-b">LAB</span>
      </div>
      <div className="pills">
        <div className="pill coin" title="Coins">
          <Icon n="coin" size={22} />
          <Count value={e.coins} />
        </div>
        <button className="pill mut" onClick={() => setTab('shop')} title="Mutagen" aria-label={`Mutagen ${e.mutagens}. Open shop`}>
          <Icon n="mutagen" size={22} />
          <Count value={e.mutagens} />
        </button>
        <button className="pill streak" onClick={() => openModal({ kind: 'gift' })} title="Daily streak" aria-label={`Streak ${s.game.streak.streak} days`}>
          <Icon n="flame" size={22} />
          <Count value={s.game.streak.streak} />
          {s.giftPending && <i className="dot" />}
        </button>
      </div>
      <button className="gear" onClick={() => openModal({ kind: 'settings' })} aria-label="Settings">
        <Icon n="gear" size={26} />
      </button>
    </header>
  )
}

// ---------- mode bar ----------
export function ModeBar() {
  const s = useApp()
  const rush = s.rush
  return (
    <div className="modebar">
      <div className="seg" role="tablist" aria-label="Mode">
        <button role="tab" aria-selected={s.mode === 'lab'} className={s.mode === 'lab' ? 'on' : ''} onClick={() => setMode('lab')} disabled={s.busy}>
          <Icon n="flask" size={18} /> Lab
        </button>
        <button role="tab" aria-selected={s.mode === 'rush'} className={s.mode === 'rush' ? 'on rush' : 'rush'} onClick={() => setMode('rush')} disabled={s.busy}>
          <Icon n="bolt" size={18} /> Rush
        </button>
      </div>
      {s.mode === 'rush' && rush ? (
        <div className="rushbar" aria-live="polite">
          <span className="rb-kind">{rush.kind === 'daily' ? 'Daily Rush' : 'Challenge'}</span>
          <span className="rb-n">
            Fusion <b>{Math.min(rush.state.used + (s.busy ? 1 : 0), RUSH_FUSIONS)}</b>/{RUSH_FUSIONS}
          </span>
          <span className="rb-best">
            Best <b>{rush.state.best}</b>
            {rush.challenge ? <em> / {rush.challenge.target}</em> : null}
          </span>
        </div>
      ) : (
        <div className="rushbar lab">
          <span className="rb-kind">{s.game.pen.length}/{s.game.eco.capacity} in pen</span>
        </div>
      )}
    </div>
  )
}

// ---------- drag state ----------
interface DragState {
  id: string
  x: number
  y: number
  code: string
  over: 0 | 1 | 2
}
let drag: DragState | null = null
const dragSubs = new Set<() => void>()
function setDrag(d: DragState | null) {
  drag = d
  dragSubs.forEach((f) => f())
}
function useDrag() {
  return useSyncExternalStore(
    (f) => (dragSubs.add(f), () => dragSubs.delete(f)),
    () => drag,
  )
}

function slotAtPoint(x: number, y: number): 0 | 1 | 2 {
  const st = stageHandle.stage
  if (!st) return 0
  const r = st.cv.getBoundingClientRect()
  if (x < r.left || x > r.right || y < r.top - 10 || y > r.bottom + 10) return 0
  return x < r.left + r.width / 2 ? 1 : 2
}

export function DragLayer() {
  const d = useDrag()
  if (!d) return null
  return (
    <div className="draglayer" style={{ transform: `translate(${d.x - 48}px, ${d.y - 70}px)` }}>
      <motion.div initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: 1.15, rotate: 6 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
        <Portrait code={d.code} size={96} />
      </motion.div>
    </div>
  )
}

// ---------- stage ----------
export function StageView() {
  const s = useApp()
  const ref = useRef<HTMLCanvasElement>(null)
  const [lay, setLay] = useState<StageLayout | null>(null)
  const d = useDrag()
  const [ca, cb] = slotCreatures(s)

  useEffect(() => {
    const st = new Stage(ref.current!)
    stageHandle.stage = st
    st.onLayout = setLay
    setLay(st.getLayout())
    syncStage()
    const a = getApp()
    const [x, y] = slotCreatures(a)
    st.setSlots(x, y)
    if (a.reveal) st.showChild(a.reveal.child)
    st.start()
    return () => {
      st.destroy()
      stageHandle.stage = null
    }
  }, [])

  useEffect(() => {
    stageHandle.stage?.setSlots(ca, cb)
    advanceTutorial()
  }, [ca?.id, cb?.id])
  useEffect(() => {
    stageHandle.stage?.setPod(s.game.eco.pod)
  }, [s.game.eco.pod])
  useEffect(() => {
    stageHandle.stage?.setReduced(s.reduced)
  }, [s.reduced])
  useEffect(() => {
    stageHandle.stage?.setHover(d ? d.over : 0)
  }, [d?.over])
  const [hint, setHint] = useState(false)
  useEffect(() => {
    if (!s.busy) return setHint(false)
    const t = setTimeout(() => setHint(true), 900)
    return () => clearTimeout(t)
  }, [s.busy])

  return (
    <div className="stagebox">
      <canvas
        ref={ref}
        className="stage"
        aria-label="The Mash-O-Matic fusion machine"
        onPointerDown={() => {
          if (getApp().busy) stageHandle.stage?.skip()
        }}
      />
      {lay &&
        ([ca, cb] as const).map((c, i) => {
          if (!c || s.busy || s.reveal) return null
          const r = i === 0 ? lay.a : lay.b
          return (
            <motion.div key={c.id} className="slotchip" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ left: r.x + r.w / 2, top: Math.max(4, r.y - 2), ['--rc' as any]: RARITY_INFO[c.rarity].color }}>
              <button className="sc-name" onClick={() => openModal({ kind: 'creature', id: c.id })} aria-label={`Details for ${c.name}`}>
                <b>{c.name}</b>
                <i>{c.fright}</i>
              </button>
              <button className="sc-x" onClick={() => clearSlot(i as 0 | 1)} aria-label={`Remove ${c.name}`}>
                <Icon n="close" size={14} />
              </button>
            </motion.div>
          )
        })}
      {lay && s.reveal && (
        <button className="childpoke" style={{ left: lay.child.x, top: lay.child.y, width: lay.child.w, height: lay.child.h }} onClick={() => stageHandle.stage?.nudge()} aria-label="Poke your new monster" />
      )}
      <AnimatePresence>
        {s.busy && hint && (
          <motion.div className="skiphint" initial={{ opacity: 0 }} animate={{ opacity: 0.85 }} exit={{ opacity: 0 }}>
            tap to skip
          </motion.div>
        )}
      </AnimatePresence>
      <TutorialBubble />
    </div>
  )
}

// ---------- controls ----------
export function Controls() {
  const s = useApp()
  const [ca, cb] = slotCreatures(s)
  const ready = !!ca && !!cb && !s.busy
  const rushOut = s.mode === 'rush' && !s.rush
  const e = s.game.eco
  const label = s.busy ? 'MASHING…' : ready ? 'MASH IT!' : ca || cb ? 'Pick one more' : 'Pick two monsters'
  return (
    <div className="controls">
      {s.mode === 'lab' ? (
        <button className={`boost ${s.boost ? 'on' : ''}`} onClick={toggleBoost} disabled={s.busy} aria-pressed={s.boost} aria-label="Mutagen boost: raises mutation odds">
          <Icon n="mutagen" size={28} />
          <span className="b-t">{s.boost ? 'Boost ON' : 'Mutagen'}</span>
          <span className="b-n">×{e.mutagens}</span>
        </button>
      ) : (
        <div className="boost rushinfo" aria-label="Rush rules">
          <Icon n="bolt" size={26} />
          <span className="b-t">Rush</span>
          <span className="b-n">{RUSH_FUSIONS} fusions</span>
        </div>
      )}
      <button className={`mash ${ready ? 'ready' : ''} ${s.busy ? 'busy' : ''}`} onClick={() => fuse()} disabled={!ready || rushOut} data-tut="mash">
        <span className="mash-in">{label}</span>
      </button>
      <button className="ctl-clear" onClick={() => (clearSlot(0), clearSlot(1))} disabled={s.busy || (!ca && !cb)} aria-label="Clear both pedestals">
        <Icon n="close" size={22} />
      </button>
    </div>
  )
}

// ---------- tray ----------
const SORTS: Record<App['sort'], string> = { new: 'Newest', fright: 'Fright', rarity: 'Rarity' }
function sorted(pen: Creature[], sort: App['sort']): Creature[] {
  const a = [...pen]
  if (sort === 'fright') a.sort((x, y) => y.fright - x.fright)
  else if (sort === 'rarity') a.sort((x, y) => rarityRank(y.rarity) - rarityRank(x.rarity) || y.fright - x.fright)
  else a.reverse()
  return a
}

const Card = memo(function Card({ c, slot, dim, pulse }: { c: Creature; slot: 0 | 1 | -1; dim?: boolean; pulse?: boolean }) {
  const down = useRef<{ x: number; y: number; t: number; started: boolean; long: number } | null>(null)
  const onDown = (ev: React.PointerEvent) => {
    if (ev.button !== 0 && ev.pointerType === 'mouse') return
    const el = ev.currentTarget as HTMLElement
    const st = { x: ev.clientX, y: ev.clientY, t: performance.now(), started: false, long: 0 }
    down.current = st
    st.long = window.setTimeout(() => {
      if (down.current === st && !st.started) {
        down.current = null
        cleanup()
        openModal({ kind: 'creature', id: c.id })
      }
    }, 520)
    const move = (e: PointerEvent) => {
      const dx = e.clientX - st.x
      const dy = e.clientY - st.y
      if (!st.started) {
        const dist = Math.hypot(dx, dy)
        const mouse = e.pointerType === 'mouse'
        if (dist > (mouse ? 6 : 12) && (mouse || Math.abs(dy) > Math.abs(dx) * 0.8)) {
          st.started = true
          clearTimeout(st.long)
          sfx('pick')
          try {
            el.setPointerCapture(ev.pointerId)
          } catch {
            /* ignore */
          }
        } else if (dist > 14) clearTimeout(st.long)
      }
      if (st.started) {
        e.preventDefault()
        setDrag({ id: c.id, code: c.code, x: e.clientX, y: e.clientY, over: slotAtPoint(e.clientX, e.clientY) })
      }
    }
    const up = (e: PointerEvent) => {
      clearTimeout(st.long)
      cleanup()
      if (down.current !== st) return
      down.current = null
      if (st.started) {
        const over = slotAtPoint(e.clientX, e.clientY)
        setDrag(null)
        if (over) placeAt(c.id, (over - 1) as 0 | 1)
        else sfx('swap')
      } else if (performance.now() - st.t < 500) tapCreature(c.id)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  const rc = RARITY_INFO[c.rarity]
  return (
    <div
      className={`card r-${c.rarity} ${slot >= 0 ? 'sel' : ''} ${dim ? 'dim' : ''} ${pulse ? 'pulse' : ''}`}
      style={{ ['--rc' as any]: rc.color }}
      onPointerDown={onDown}
      onContextMenu={(e) => (e.preventDefault(), openModal({ kind: 'creature', id: c.id }))}
      role="button"
      tabIndex={0}
      aria-label={`${c.name}, ${rc.label}, Fright ${c.fright}${slot >= 0 ? `, on pedestal ${slot ? 'B' : 'A'}` : ''}`}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tapCreature(c.id))}
    >
      <Portrait code={c.code} size={64} />
      <span className="c-f">{c.fright}</span>
      {slot >= 0 && <span className="c-slot">{slot ? 'B' : 'A'}</span>}
      {c.mythic && <span className="c-m"><Icon n="star" size={14} /></span>}
      <span className="c-n">{c.name}</span>
    </div>
  )
})

export function Tray() {
  const s = useApp()
  const pen = penOf(s)
  const list = useMemo(() => sorted(pen, s.mode === 'rush' ? 'new' : s.sort), [pen, s.sort, s.mode])
  const slotOf = (id: string): 0 | 1 | -1 => (s.slots[0] === id ? 0 : s.slots[1] === id ? 1 : -1)
  const cap = s.mode === 'lab' ? s.game.eco.capacity : null
  const tut0 = s.tutorial >= 0 && s.tutorial < 3
  return (
    <section className="tray" aria-label="Your monsters">
      <div className="tray-h">
        <h3>{s.mode === 'rush' ? 'Rush monsters' : 'Your pen'}</h3>
        <span className="tray-c">
          {pen.length}
          {cap ? `/${cap}` : ''}
        </span>
        {s.mode === 'lab' && (
          <button className="sortb" onClick={() => setSort(s.sort === 'new' ? 'fright' : s.sort === 'fright' ? 'rarity' : 'new')} aria-label={`Sort: ${SORTS[s.sort]}`}>
            <Icon n="sort" size={16} /> {SORTS[s.sort]}
          </button>
        )}
      </div>
      <div className="tray-g" data-tut="tray">
        {list.map((c, i) => (
          <Card key={c.id} c={c} slot={slotOf(c.id)} pulse={tut0 && i < 2 && s.sort === 'new'} />
        ))}
        {list.length === 0 && <p className="empty">No monsters yet.</p>}
      </div>
    </section>
  )
}

// ---------- reveal ----------
const SLOT_NAME: Record<Slot, string> = { body: 'Body', head: 'Head', eyes: 'Eyes', limbs: 'Limbs', tail: 'Tail', aura: 'Aura' }
const RARITY_CHEER: Record<string, string> = { common: 'A new friend!', uncommon: 'Ooh, nice!', rare: 'Rare find!', epic: 'EPIC mash!', legendary: 'LEGENDARY!!', mythic: 'MYTHIC!!!' }

export function RevealCard({ r }: { r: NonNullable<App['reveal']> }) {
  const s = useApp()
  const c = r.child
  const info = RARITY_INFO[c.rarity]
  const g = genomeOf(c)
  const ev = r.ev
  const rushTop = r.mode === 'rush' && s.rush && c.fright > (r.prevBest ?? 0)
  const badges: string[] = []
  if (r.mythic) badges.push('Mythic discovery!')
  if (ev?.delta.newSpecies) badges.push('New species')
  if (ev?.newBest) badges.push('Personal best')
  if (rushTop) badges.push('New Rush best')
  if (ev && ev.unlockedWild.length) badges.push('Wild mutation')
  const last = r.mode === 'rush' && s.rush && s.rush.state.used >= RUSH_FUSIONS
  return (
    <motion.section className="reveal" style={{ ['--rc' as any]: info.color, ['--rg' as any]: info.glow }} initial={{ y: 120, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 120, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 26, delay: 0.05 }} aria-live="polite">
      <div className="rv-top">
        <motion.div className="rv-ribbon" initial={{ scale: 0.4, rotate: -8 }} animate={{ scale: 1, rotate: -2 }} transition={{ type: 'spring', stiffness: 420, damping: 12, delay: 0.15 }}>
          {RARITY_CHEER[c.rarity]}
        </motion.div>
        <div className="rv-fright">
          <span className="rv-fl">FRIGHT</span>
          <Count value={c.fright} className="rv-fn" />
        </div>
      </div>
      <h2 className="rv-name">{c.name}</h2>
      <div className="rv-sub">
        <RarityTag r={c.rarity} /> <span>{c.title}</span>
        {g.shiny && (
          <span className="shiny">
            <Icon n="star" size={14} /> Shiny
          </span>
        )}
      </div>
      {badges.length > 0 && (
        <div className="rv-badges">
          {badges.map((b, i) => (
            <motion.span key={b} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 14, delay: 0.3 + i * 0.1 }} className="badge">
              {b}
            </motion.span>
          ))}
        </div>
      )}
      <div className="rv-parts" aria-label="Where each part came from">
        {SLOTS.map((sl) => {
          const kind = r.result.mutatedSlots.includes(sl) ? 'mut' : r.result.fromA.includes(sl) ? 'a' : 'b'
          const part = partAt(sl, g.parts[sl])
          return (
            <div key={sl} className={`rvp ${kind}`} title={`${SLOT_NAME[sl]}: ${part.name} (${kind === 'mut' ? 'mutation' : 'from ' + (kind === 'a' ? r.parents[0] : r.parents[1])})`}>
              <img src={partIconURL(sl, part.id, 72)} width={34} height={34} alt="" />
              <i>{kind === 'mut' ? '✦' : kind.toUpperCase()}</i>
            </div>
          )
        })}
      </div>
      {ev && (
        <div className="rv-rew">
          <Icon n="coin" size={18} /> <b>+{ev.coins}</b>
          <span>{ev.rewardBreakdown.map((x) => x.label).join(' · ')}</span>
        </div>
      )}
      {r.penFull ? (
        <div className="rv-full">
          <p>Your pen is full! Make room for {c.name}:</p>
          <div className="rv-btns">
            <Btn variant="ghost" onClick={() => resolveFull('recycle')}>
              <Icon n="recycle" size={18} /> Recycle {c.name.split(' ')[0]} +{recycleValue(c)}
            </Btn>
            <Btn variant="violet" onClick={() => openModal({ kind: 'swap' })}>
              <Icon n="swap" size={18} /> Swap one out
            </Btn>
          </div>
        </div>
      ) : (
        <div className="rv-btns">
          <Btn variant="cyan" onClick={() => shareCreature(c, { rushChallenge: r.mode === 'rush' && !!last })} disabled={s.sharing}>
            <Icon n="share" size={18} /> Share
          </Btn>
          <Btn variant="slime" size="lg" onClick={() => dismissReveal()} className="grow">
            {last ? 'See results' : r.mode === 'rush' ? 'Next fusion' : 'Mash again!'}
          </Btn>
        </div>
      )}
    </motion.section>
  )
}

// ---------- tutorial ----------
const TUT = [
  { t: 'Welcome to the lab!', d: 'Tap a monster below, or drag it onto a pedestal.' },
  { t: 'Nice! One more.', d: 'Pick a second monster. Any two will do.' },
  { t: 'Ready to mash?', d: 'Smash the big green button!' },
  { t: '', d: '' },
  { t: 'Boom! A brand-new monster!', d: 'Higher Fright means rarer. Keep mashing to fill your Codex.' },
]
export function TutorialBubble() {
  const s = useApp()
  if (s.tutorial < 0 || s.tutorial === 3) return null
  const t = TUT[s.tutorial]
  return (
    <motion.div key={s.tutorial} className="tut" initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 460, damping: 26 }} role="status">
      <div className="tut-b">
        <b>{t.t}</b>
        <span>{t.d}</span>
      </div>
      <button className="tut-skip" onClick={skipTutorial}>
        Skip
      </button>
    </motion.div>
  )
}

// ---------- rush launcher (when no active run) ----------
export function RushLobby() {
  const s = useApp()
  const left = rushLeft(s)
  return (
    <section className="rushlobby">
      <h3>Rush</h3>
      <p>Same 6 monsters for everyone. 5 fusions. Highest Fright wins.</p>
      <Btn variant="slime" size="lg" onClick={() => openModal({ kind: 'rushIntro' })}>
        <Icon n="bolt" size={20} /> {left > 0 ? `Play Daily Rush (${left} left)` : 'Daily Rush'}
      </Btn>
      <span className="muted">
        {RUSH_FREE_ATTEMPTS} free attempts a day. A new seed every UTC midnight.
      </span>
    </section>
  )
}

// ---------- dock ----------
export function Dock() {
  const s = useApp()
  const showRush = s.mode === 'rush' && !s.rush
  return (
    <div className="dock">
      <AnimatePresence mode="wait" initial={false}>
        {s.reveal ? (
          <RevealCard key="reveal" r={s.reveal} />
        ) : showRush ? (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <RushLobby />
          </motion.div>
        ) : (
          <motion.div key="play" className="dock-play" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} transition={{ duration: 0.18 }}>
            <Controls />
            <Tray />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function LabScreen() {
  return (
    <>
      <section className="stagecol">
        <ModeBar />
        <StageView />
      </section>
      <Dock />
    </>
  )
}

export function usePenPriceHint() {
  const s = useApp()
  return penPrice(s.game.eco.capacity)
}
void setSetting
void useCallback
