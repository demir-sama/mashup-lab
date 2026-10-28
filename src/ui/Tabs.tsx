import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { claim, deliver, equip, getApp, openModal, setTab, shopBuyCapacity, shopBuyMutagen, shopBuyPart, shopBuyPod, shopBuyPremiumPod, useApp, watchAdForMutagen, setMode, shareCreature, recycleCreature } from '../app/store'
import { Btn, Count, Icon, Meter, Portrait, RarityTag } from './kit'
import { ALL_SPECIES, RARITY_INFO } from '../core/fright'
import { MYTHICS } from '../core/recipes'
import { SLOTS, PARTS, PARTS_BY_SLOT, THEMES, THEME_INFO, partKey, PART_PRICE, STARTER_PART_KEYS, type Slot } from '../core/parts'
import { CODEX_TOTAL, adsLeft, codexCounts, collectorScore, penPrice, PEN_MAX, PEN_STEP, MUTAGEN_PRICE, MAX_ADS_PER_DAY, rushAttemptsLeft } from '../core/state'
import { orderMet, reqLabel, orderProgress, dailyOrders } from '../core/orders'
import { dayKey, msUntilNextDay } from '../core/daily'
import { encodeGenome } from '../core/genome'
import { PODS } from '../core/pods'
import { partIconURL } from '../art/thumbs'
import { loadBoard, type BoardData } from '../platform/sdk'
import { dailySeed } from '../core/rush'

const today = () => dayKey(getApp().now)
const fmtCountdown = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60000))
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

function PanelHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="ph">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {right}
    </div>
  )
}

// ================= ORDERS =================
export function OrdersView() {
  const s = useApp()
  const orders = dailyOrders(today())
  const left = msUntilNextDay(s.now)
  const done = orders.filter((o) => s.game.daily.orders[o.id]?.done).length
  return (
    <div className="view">
      <PanelHead title="Daily Orders" sub={`${done}/${orders.length} delivered · refresh in ${fmtCountdown(left)}`} />
      <div className="list">
        {orders.map((o, i) => {
          const st = s.game.daily.orders[o.id]
          const ok = s.game.pen.filter((c) => orderMet(o, c))
          return (
            <motion.article key={o.id} className={`order t${o.tier} ${st?.done ? 'done' : ''}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, type: 'spring', stiffness: 380, damping: 28 }}>
              <div className="o-who">
                <Portrait code={encodeGenome(o.client.genome)} size={72} mood="happy" />
                <b>{o.client.name}</b>
              </div>
              <div className="o-main">
                <q>{o.client.line}</q>
                <ul className="o-reqs">
                  {o.reqs.map((r, k) => {
                    const met = ok.length > 0 && s.game.pen.some((c) => orderMet({ ...o, reqs: [r] }, c))
                    return (
                      <li key={k} className={met ? 'met' : ''}>
                        <Icon n={met ? 'check' : 'skull'} size={14} /> {reqLabel(r)}
                      </li>
                    )
                  })}
                </ul>
                <div className="o-foot">
                  <span className="o-rew">
                    <Icon n="coin" size={20} /> <b>{o.reward}</b>
                    <small>+25% if rare+</small>
                  </span>
                  {st?.done ? (
                    <span className="stamp">Delivered{st.by ? ` · ${st.by}` : ''}</span>
                  ) : ok.length ? (
                    <Btn variant="slime" size="sm" onClick={() => openModal({ kind: 'order', orderId: o.id })}>
                      Deliver ({ok.length})
                    </Btn>
                  ) : (
                    <Btn variant="ghost" size="sm" onClick={() => (setTab('lab'), setMode('lab'))}>
                      Go mash
                    </Btn>
                  )}
                </div>
              </div>
            </motion.article>
          )
        })}
      </div>
      <p className="tip">Delivering takes the monster from your pen. Hint: mash toward what the client wants, then check back here.</p>
    </div>
  )
}
void orderProgress

// ================= CODEX =================
function Ring({ pct }: { pct: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="ring" aria-hidden="true">
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="12" />
      <motion.circle cx="44" cy="44" r={r} fill="none" stroke="url(#rg)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct / 100) }} transition={{ duration: 1.1, ease: 'easeOut' }} transform="rotate(-90 44 44)" />
      <defs>
        <linearGradient id="rg" x1="0" x2="1">
          <stop offset="0" stopColor="#7dff3a" />
          <stop offset="1" stopColor="#ffd84a" />
        </linearGradient>
      </defs>
    </svg>
  )
}

type CodexTab = 'species' | 'parts' | 'mythics'
export function CodexView() {
  const s = useApp()
  const [tab, setT] = useState<CodexTab>('species')
  const cx = s.game.codex
  const cnt = codexCounts(cx)
  return (
    <div className="view">
      <div className="cx-head">
        <div className="cx-ring">
          <Ring pct={cnt.exact} />
          <b>{cnt.pct}%</b>
        </div>
        <div className="cx-txt">
          <h2>Monster Codex</h2>
          <p>
            {cnt.found} of {CODEX_TOTAL} discovered
          </p>
          <div className="cx-mini">
            <span>Species {cnt.species}/{ALL_SPECIES.length}</span>
            <span>Parts {cnt.parts}/{PARTS.length}</span>
            <span>Mythics {cnt.mythics}/{MYTHICS.length}</span>
          </div>
        </div>
      </div>
      <div className="seg wide" role="tablist">
        {(['species', 'parts', 'mythics'] as CodexTab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setT(t)}>
            {t === 'species' ? 'Species' : t === 'parts' ? 'Parts' : 'Mythics'}
          </button>
        ))}
      </div>
      {tab === 'species' &&
        THEMES.map((th) => {
          const list = ALL_SPECIES.filter((x) => x.theme === th)
          const got = list.filter((x) => cx.species[x.key]).length
          return (
            <section key={th} className="cx-sec" style={{ ['--tc' as any]: THEME_INFO[th].color }}>
              <h3>
                <i /> {THEME_INFO[th].label}
                <span>
                  {got}/{list.length}
                </span>
              </h3>
              <div className="cx-grid">
                {list.map((x) => {
                  const e = cx.species[x.key]
                  return (
                    <div key={x.key} className={`cx-card ${e ? 'got r-' + e.rarity : 'lock'}`} style={e ? { ['--rc' as any]: RARITY_INFO[e.rarity].color } : undefined} title={e ? `${e.name} · Fright ${e.fright}` : 'Undiscovered'}>
                      {e ? <Portrait code={e.best} size={72} /> : <img className="sil" src={partIconURL('body', x.body, 96)} width={60} height={60} alt="" />}
                      <span className="cx-n">{e ? x.title : '???'}</span>
                      {e && <span className="cx-b">{e.fright}</span>}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      {tab === 'parts' &&
        SLOTS.map((sl: Slot) => {
          const list = PARTS_BY_SLOT[sl]
          const got = list.filter((p) => cx.parts.includes(partKey(sl, p.id))).length
          return (
            <section key={sl} className="cx-sec" style={{ ['--tc' as any]: '#c9b6ff' }}>
              <h3>
                <i /> {sl[0].toUpperCase() + sl.slice(1)}
                <span>
                  {got}/{list.length}
                </span>
              </h3>
              <div className="cx-grid">
                {list.map((p) => {
                  const e = cx.parts.includes(partKey(sl, p.id))
                  return (
                    <div key={p.id} className={`cx-card part ${e ? 'got' : 'lock'}`} style={e ? { ['--rc' as any]: ['#9aa', '#6fe35a', '#4cc9ff', '#ff9b2a'][p.rarity - 1] } : undefined} title={e ? p.blurb : 'Undiscovered'}>
                      <img className={e ? '' : 'sil'} src={partIconURL(sl, p.id, 96)} width={56} height={56} alt="" />
                      <span className="cx-n">{e ? p.name : '???'}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      {tab === 'mythics' && (
        <div className="mythics">
          <p className="tip">Eight secret recipes. Fuse the right two parts together and a Mythic is guaranteed. The riddles are your clue.</p>
          {MYTHICS.map((m) => {
            const got = cx.mythics.includes(m.id)
            const code = encodeGenome(m.genome)
            return (
              <article key={m.id} className={`myth ${got ? 'got' : 'lock'}`}>
                <Portrait code={code} size={92} silhouette={!got} />
                <div>
                  <h4>{got ? m.name : '??????'}</h4>
                  <small>{got ? m.title : `Tier ${m.tier} mystery`}</small>
                  <p>{got ? m.lore : m.hint}</p>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ================= RANKS =================
type BoardKey = 'rd' | 'ra' | 'co'
export function RanksView() {
  const s = useApp()
  const [k, setK] = useState<BoardKey>('rd')
  const [data, setData] = useState<BoardData | null>(null)
  const g = s.game
  const myBest = k === 'rd' ? g.rush.bestDaily : k === 'ra' ? g.rush.bestAll : collectorScore(g.codex)
  useEffect(() => {
    let alive = true
    setData(null)
    const mode = k === 'co' ? 'collector' : 'rush'
    const period = k === 'rd' ? 'daily' : 'alltime'
    loadBoard(mode, period, myBest > 0 ? myBest : null, dailySeed(today())).then((d) => alive && setData(d))
    return () => {
      alive = false
    }
  }, [k, myBest])
  const left = rushAttemptsLeft(g.rush, today())
  const label = k === 'co' ? 'Collector score' : 'Best Fright in a Rush'
  return (
    <div className="view">
      <PanelHead title="Leaderboards" sub={k === 'rd' ? `Resets in ${fmtCountdown(msUntilNextDay(s.now))}` : k === 'co' ? 'Species ×10 · parts ×5 · mythics ×60' : 'Best single-monster Fright, 5-fusion runs'} />
      <div className="seg wide" role="tablist">
        <button role="tab" aria-selected={k === 'rd'} className={k === 'rd' ? 'on' : ''} onClick={() => setK('rd')}>
          Rush today
        </button>
        <button role="tab" aria-selected={k === 'ra'} className={k === 'ra' ? 'on' : ''} onClick={() => setK('ra')}>
          Rush all-time
        </button>
        <button role="tab" aria-selected={k === 'co'} className={k === 'co' ? 'on' : ''} onClick={() => setK('co')}>
          Collector
        </button>
      </div>
      <div className="mybest">
        <span>{label}</span>
        <b>{myBest > 0 ? myBest : '—'}</b>
        {k !== 'co' && g.rush.bestAllCode && k === 'ra' && <Portrait code={g.rush.bestAllCode} size={56} />}
      </div>
      <div className="board">
        {!data && <div className="spin" aria-label="Loading" />}
        {data?.rows.map((r, i) => (
          <motion.div key={r.rank + r.name} className={`row ${r.me ? 'me' : ''} p${r.rank}`} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
            <span className="rk">{r.rank <= 3 ? <Icon n="trophy" size={22} style={{ filter: r.rank === 1 ? 'none' : r.rank === 2 ? 'grayscale(1) brightness(1.4)' : 'sepia(1) saturate(2) hue-rotate(-20deg)' }} /> : r.rank}</span>
            <span className="rn">{r.name}{r.me ? ' (you)' : ''}</span>
            <span className="rs">{r.score}</span>
          </motion.div>
        ))}
        {data && data.rows.length === 0 && <p className="empty">Be the first on the board!</p>}
        {data?.demo && <p className="tip">Preview board: rivals are fictional until this game runs on RUN with live players.</p>}
      </div>
      {k !== 'co' ? (
        <Btn variant="slime" size="lg" className="cta" onClick={() => (setTab('lab'), setMode('rush'), left > 0 && openModal({ kind: 'rushIntro' }))}>
          <Icon n="bolt" size={20} /> {left > 0 ? 'Play Daily Rush' : 'Rush attempts used up'}
        </Btn>
      ) : (
        <Btn variant="slime" size="lg" className="cta" onClick={() => (setTab('lab'), setMode('lab'))}>
          Keep collecting
        </Btn>
      )}
    </div>
  )
}

// ================= SHOP =================
export function ShopView() {
  const s = useApp()
  const g = s.game
  const e = g.eco
  const ads = adsLeft(g, today())
  const price = penPrice(e.capacity)
  const maxed = e.capacity >= PEN_MAX
  const buyable = useMemo(() => PARTS.filter((p) => !STARTER_PART_KEYS.includes(partKey(p.slot, p.id)) && !e.unlocked.includes(partKey(p.slot, p.id))).sort((a, b) => a.rarity - b.rarity), [e.unlocked])
  return (
    <div className="view">
      <PanelHead
        title="Shop"
        sub="Coins come from mashing, orders and daily gifts."
        right={
          <div className="pill coin">
            <Icon n="coin" size={22} /> <Count value={e.coins} />
          </div>
        }
      />
      <section className="shop-sec">
        <h3>Boosts</h3>
        <div className="shop-row">
          <div className="goods">
            <Icon n="mutagen" size={44} />
            <div>
              <b>Mutagen</b>
              <small>Boosts mutation odds for one fusion. Own {e.mutagens}.</small>
            </div>
            <Btn variant="sun" size="sm" onClick={() => shopBuyMutagen()} disabled={e.coins < MUTAGEN_PRICE}>
              <Icon n="coin" size={16} /> {MUTAGEN_PRICE}
            </Btn>
          </div>
          <div className="goods">
            <Icon n="play" size={44} />
            <div>
              <b>Free Mutagen</b>
              <small>Watch a short ad. {ads}/{MAX_ADS_PER_DAY} left today.</small>
            </div>
            <Btn variant="candy" size="sm" onClick={() => watchAdForMutagen()} disabled={ads <= 0}>
              Watch
            </Btn>
          </div>
          <div className="goods">
            <Icon n="bag" size={44} />
            <div>
              <b>Bigger Pen</b>
              <small>{maxed ? 'Maxed out!' : `Room for ${e.capacity} → ${e.capacity + PEN_STEP} monsters.`}</small>
            </div>
            <Btn variant="sun" size="sm" onClick={() => shopBuyCapacity()} disabled={maxed || e.coins < price}>
              <Icon n="coin" size={16} /> {maxed ? '—' : Math.round(price)}
            </Btn>
          </div>
        </div>
      </section>

      <section className="shop-sec">
        <h3>Mash-O-Matic pods <small>cosmetic only</small></h3>
        <div className="pods">
          {PODS.map((p) => {
            const own = e.pods.includes(p.id)
            const on = e.pod === p.id
            const cat = p.premium ? s.catalog[p.premium.itemId] : undefined
            return (
              <div key={p.id} className={`pod ${on ? 'on' : ''}`} style={{ ['--p1' as any]: p.bg1, ['--p2' as any]: p.bg2, ['--pm' as any]: p.metal, ['--pg' as any]: p.goo, ['--pt' as any]: p.trim }}>
                <div className="pod-art" aria-hidden="true">
                  <span className="tank" />
                </div>
                <b>{p.name}</b>
                <small>{p.blurb}</small>
                <div className="pod-act">
                  {on ? (
                    <span className="stamp small">Equipped</span>
                  ) : own ? (
                    <Btn size="sm" variant="slime" onClick={() => equip(p.id)}>
                      Equip
                    </Btn>
                  ) : (
                    <>
                      {p.premium && cat && (
                        <Btn size="sm" variant="candy" onClick={() => shopBuyPremiumPod(p.id)}>
                          Get {cat.price ? `· ${cat.price}` : ''}
                        </Btn>
                      )}
                      <Btn size="sm" variant="sun" onClick={() => shopBuyPod(p.id)} disabled={e.coins < p.coins}>
                        <Icon n="coin" size={16} /> {p.coins}
                      </Btn>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="shop-sec">
        <h3>Part unlocks <small>adds the part to the mutation pool</small></h3>
        <div className="cx-grid parts-shop">
          {buyable.length === 0 && <p className="empty">Every part unlocked. Legend.</p>}
          {buyable.map((p) => {
            const key = partKey(p.slot, p.id)
            const cost = PART_PRICE[p.rarity]
            return (
              <button key={key} className="cx-card part got shopcard" disabled={e.coins < cost} onClick={() => shopBuyPart(key)} style={{ ['--rc' as any]: ['#9aa', '#6fe35a', '#4cc9ff', '#ff9b2a'][p.rarity - 1] }} aria-label={`Unlock ${p.name} for ${cost} coins`}>
                <img src={partIconURL(p.slot, p.id, 96)} width={56} height={56} alt="" />
                <span className="cx-n">{p.name}</span>
                <span className="cx-b price"><Icon n="coin" size={12} />{cost}</span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
void RarityTag
void Meter
void claim
void deliver
void shareCreature
void recycleCreature
