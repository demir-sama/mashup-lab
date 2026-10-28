import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { acceptIncoming, claim, closeModal, declineIncoming, deliver, getApp, leaveRush, openModal, recycleCreature, replayTutorial, resetProgress, resolveFull, setSetting, shareCreature, startRush, useApp, watchAdForRushAttempt } from '../app/store'
import { Btn, Count, Icon, Portrait, RarityTag, Sheet } from './kit'
import { RARITY_INFO } from '../core/fright'
import { genomeOf } from '../core/creature'
import { SLOTS, partAt } from '../core/parts'
import { partIconURL } from '../art/thumbs'
import { dailyOrders, orderMet, reqLabel } from '../core/orders'
import { dayKey, msUntilNextDay, streakReward } from '../core/daily'
import { recycleValue, adsLeft, rushAttemptsLeft, RUSH_FREE_ATTEMPTS, MAX_ADS_PER_DAY } from '../core/state'
import { RUSH_FUSIONS } from '../core/rush'
import { renderCard } from '../art/thumbs'
import { downloadBlob } from '../platform/sdk'

const today = () => dayKey(getApp().now)
const fmt = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60000))
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

function Toggle({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <button className="tgl" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="tgl-t">
        <b>{label}</b>
        {sub && <small>{sub}</small>}
      </span>
      <span className={`knob ${on ? 'on' : ''}`}>
        <i />
      </span>
    </button>
  )
}

function Gift() {
  const s = useApp()
  const st = s.game.streak
  const rew = streakReward(st.streak)
  const [got, setGot] = useState<null | { coins: number; mutagens: number; label: string }>(null)
  const pending = s.giftPending && !got
  const day = ((st.streak - 1) % 7) + 1
  return (
    <Sheet open title="Daily gift" onClose={closeModal} tone="#ff9b2a">
      <div className="gift">
        <motion.div className="gift-flame" animate={{ scale: [1, 1.08, 1], rotate: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 1.6 }}>
          <Icon n="flame" size={84} />
          <b>{st.streak}</b>
        </motion.div>
        <p className="gift-t">{st.streak <= 1 ? 'Day 1. The streak begins!' : `${st.streak}-day streak!`}</p>
        <div className="days" aria-label="Week progress">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className={`day ${i + 1 < day ? 'past' : ''} ${i + 1 === day ? 'now' : ''}`}>
              {i + 1 < day || (i + 1 === day && !pending) ? <Icon n="check" size={14} /> : i + 1}
            </span>
          ))}
        </div>
        <div className="gift-rew">
          <span>
            <Icon n="coin" size={26} /> <b>+{(got ?? rew).coins}</b>
          </span>
          {(got ?? rew).mutagens > 0 && (
            <span>
              <Icon n="mutagen" size={26} /> <b>+{(got ?? rew).mutagens}</b>
            </span>
          )}
        </div>
        <small className="muted">{(got ?? rew).label}. Streak milestones at 3, 7, 14 and 30 days.</small>
        {pending ? (
          <Btn variant="slime" size="lg" className="cta" onClick={() => setGot(claim())}>
            <Icon n="gift" size={22} /> Claim!
          </Btn>
        ) : (
          <>
            <p className="muted">{got ? 'Claimed!' : 'Already claimed today.'} Next gift in {fmt(msUntilNextDay(s.now))}.</p>
            <Btn variant="sun" className="cta" onClick={closeModal}>
              Nice
            </Btn>
          </>
        )}
      </div>
    </Sheet>
  )
}

function Settings() {
  const s = useApp()
  const st = s.game.settings
  const m = s.game.meta
  return (
    <Sheet open title="Settings" onClose={closeModal} tone="#c9b6ff">
      <div className="set">
        <Toggle on={st.music} onChange={(v) => setSetting('music', v)} label="Music" />
        <Toggle on={st.sfx} onChange={(v) => setSetting('sfx', v)} label="Sound effects" />
        <Toggle on={st.haptics} onChange={(v) => setSetting('haptics', v)} label="Haptics" />
        <Toggle on={st.fastFusion} onChange={(v) => setSetting('fastFusion', v)} label="Quick fusions" sub="Shorter 2-second mash. Tap during any fusion to skip." />
        <Toggle on={st.remind} onChange={(v) => setSetting('remind', v)} label="Daily gift reminder" sub="One local notification when your gift is ready." />
        <div className="tgl static">
          <span className="tgl-t">
            <b>Motion</b>
            <small>Reduced motion softens shakes and flashes.</small>
          </span>
          <div className="seg mini">
            {(['auto', 'full', 'reduced'] as const).map((k) => (
              <button key={k} className={st.motion === k ? 'on' : ''} onClick={() => setSetting('motion', k)} aria-pressed={st.motion === k}>
                {k === 'auto' ? 'Auto' : k === 'full' ? 'Full' : 'Calm'}
              </button>
            ))}
          </div>
        </div>
        <div className="stats">
          <span>
            <b>{m.fusions}</b> fusions
          </span>
          <span>
            <b>{m.bestFright}</b> best Fright
          </span>
          <span>
            <b>{s.game.streak.best}</b> best streak
          </span>
          <span>
            <b>{m.shares}</b> shares
          </span>
        </div>
        <div className="set-btns">
          <Btn variant="ghost" size="sm" onClick={() => (closeModal(), replayTutorial())}>
            Replay tutorial
          </Btn>
          <Btn variant="ghost" size="sm" onClick={() => openModal({ kind: 'about' })}>
            About
          </Btn>
          <Btn variant="candy" size="sm" onClick={() => openModal({ kind: 'confirmReset' })}>
            Reset progress
          </Btn>
        </div>
      </div>
    </Sheet>
  )
}

function About() {
  return (
    <Sheet open title="About Mash-Up Lab" onClose={() => openModal({ kind: 'settings' })} tone="#7dff3a">
      <div className="about">
        <p>
          Drag two monsters into the <b>Mash-O-Matic</b> and see what crawls out. 48 parts, 48 species and 8 secret Mythic recipes are waiting in the Codex.
        </p>
        <p>
          Made for the <b>RUN October Jam</b>, theme “Monster Mash”. Every monster, sound and tune here is generated by code in your browser: original art, no samples, no copyrighted characters.
        </p>
        <p className="muted">Open source (MIT): github.com/demir-sama/mashup-lab</p>
        <Btn variant="sun" className="cta" onClick={() => openModal({ kind: 'settings' })}>
          Back
        </Btn>
      </div>
    </Sheet>
  )
}

function ConfirmReset() {
  return (
    <Sheet open title="Reset everything?" onClose={() => openModal({ kind: 'settings' })} tone="#ff4fa3">
      <div className="about">
        <p>This erases your monsters, Codex, coins and streak. It cannot be undone.</p>
        <div className="set-btns">
          <Btn variant="ghost" onClick={() => openModal({ kind: 'settings' })}>
            Keep playing
          </Btn>
          <Btn variant="candy" onClick={resetProgress}>
            Erase it all
          </Btn>
        </div>
      </div>
    </Sheet>
  )
}

function RushIntro() {
  const s = useApp()
  const left = rushAttemptsLeft(s.game.rush, today())
  const ads = adsLeft(s.game, today())
  return (
    <Sheet open title="Daily Rush" onClose={closeModal} tone="#ffd84a">
      <div className="about rushi">
        <div className="rules">
          <div>
            <Icon n="skull" size={34} />
            <b>Same 6 monsters</b>
            <small>for every player today</small>
          </div>
          <div>
            <Icon n="bolt" size={34} />
            <b>{RUSH_FUSIONS} fusions</b>
            <small>children join your tray</small>
          </div>
          <div>
            <Icon n="trophy" size={34} />
            <b>Top Fright wins</b>
            <small>best single monster</small>
          </div>
        </div>
        <p className="muted">
          {left > 0 ? `${left} attempt${left === 1 ? '' : 's'} left today (${RUSH_FREE_ATTEMPTS} free per day).` : 'No attempts left today.'} Results are deterministic, so luck can't beat skill.
        </p>
        {left > 0 ? (
          <Btn variant="slime" size="lg" className="cta" onClick={() => startRush('daily')}>
            <Icon n="bolt" size={22} /> Start Rush
          </Btn>
        ) : (
          <>
            <Btn variant="candy" size="lg" className="cta" disabled={ads <= 0} onClick={async () => (await watchAdForRushAttempt()) && startRush('daily')}>
              <Icon n="play" size={22} /> Watch an ad for +1 attempt
            </Btn>
            <small className="muted">{ads}/{MAX_ADS_PER_DAY} ad rewards left today. Back tomorrow for free attempts.</small>
          </>
        )}
      </div>
    </Sheet>
  )
}

function ChallengeIntro({ ch }: { ch: { seed: string; target: number; from: string; name: string } }) {
  const invite = ch.target <= 0
  return (
    <Sheet open title="Challenge!" tone="#ff4fa3">
      <div className="about rushi">
        <div className="chal-who">
          <Icon n="skull" size={52} />
        </div>
        <p className="chal-t">
          <b>{ch.from}</b> {invite ? `invites you to a Rush. They made “${ch.name}”.` : `scored ${ch.target} Fright with “${ch.name}”.`}
        </p>
        {!invite && (
          <div className="target">
            <span>Beat</span>
            <b>{ch.target}</b>
            <span>Fright in 5 fusions</span>
          </div>
        )}
        <p className="muted">Same starting monsters, same rules, so it's a fair fight.</p>
        <Btn variant="slime" size="lg" className="cta" onClick={() => acceptIncoming(ch)}>
          <Icon n="bolt" size={22} /> {invite ? "Let's mash" : 'Accept challenge'}
        </Btn>
        <Btn variant="ghost" className="cta" onClick={declineIncoming}>
          Not now
        </Btn>
      </div>
    </Sheet>
  )
}

function RushEnd() {
  const s = useApp()
  const run = s.rush
  if (!run || !run.finished) return null
  const f = run.finished
  const best = run.state.pen.find((c) => c.id === run.state.bestId)
  const left = rushAttemptsLeft(s.game.rush, today())
  const target = run.challenge?.target ?? 0
  return (
    <Sheet open title={run.kind === 'challenge' ? (f.won ? 'You win!' : 'So close!') : 'Rush complete'} onClose={leaveRush} tone={f.won === false ? '#ff4fa3' : '#7dff3a'}>
      <div className="rushend">
        {best && <Portrait code={best.code} size={150} mood="happy" />}
        <div className="re-score">
          <span>Best Fright</span>
          <Count value={f.score} className="re-n" />
        </div>
        {best && (
          <p className="re-name">
            <b>{best.name}</b> <RarityTag r={best.rarity} />
          </p>
        )}
        {run.kind === 'challenge' && target > 0 && <p className="muted">{f.won ? `You beat ${run.challenge!.from}'s ${target}! +60 bonus coins.` : `${run.challenge!.from} scored ${target}. One more try?`}</p>}
        <div className="gift-rew">
          <span>
            <Icon n="coin" size={26} /> <b>+{f.coins}</b>
          </span>
          {f.submitted?.accepted && f.submitted.rank && (
            <span>
              <Icon n="trophy" size={26} /> <b>#{f.submitted.rank}</b>
            </span>
          )}
        </div>
        <div className="set-btns">
          {best && (
            <Btn variant="cyan" onClick={() => shareCreature(best, { rushChallenge: true })} disabled={s.sharing}>
              <Icon n="share" size={18} /> Challenge a friend
            </Btn>
          )}
          {run.kind === 'challenge' ? (
            <Btn variant="slime" onClick={() => startRush('challenge', run.challenge)}>
              Try again
            </Btn>
          ) : left > 0 ? (
            <Btn variant="slime" onClick={() => startRush('daily')}>
              Again ({left})
            </Btn>
          ) : null}
        </div>
        <Btn variant="ghost" className="cta" onClick={leaveRush}>
          Back to the lab
        </Btn>
      </div>
    </Sheet>
  )
}

function CreatureModal({ id }: { id: string }) {
  const s = useApp()
  const c = [...s.game.pen, ...(s.rush?.state.pen ?? [])].find((x) => x.id === id)
  if (!c) return null
  const g = genomeOf(c)
  const info = RARITY_INFO[c.rarity]
  const canRecycle = s.game.pen.some((x) => x.id === id) && s.mode === 'lab' && s.game.pen.length > 2 && !s.busy
  return (
    <Sheet open title={c.name} onClose={closeModal} tone={info.color}>
      <div className="cm">
        <div className="cm-art" style={{ ['--rc' as any]: info.color }}>
          <Portrait code={c.code} size={170} mood="happy" />
        </div>
        <div className="cm-meta">
          <RarityTag r={c.rarity} />
          <span className="cm-f">
            Fright <b>{c.fright}</b>
          </span>
          <span className="muted">{c.title}</span>
          {g.shiny && <span className="shiny"><Icon n="star" size={14} /> Shiny</span>}
        </div>
        <div className="cm-parts">
          {SLOTS.map((sl) => {
            const p = partAt(sl, g.parts[sl])
            return (
              <div key={sl} title={p.blurb}>
                <img src={partIconURL(sl, p.id, 72)} width={38} height={38} alt="" />
                <small>{p.name}</small>
              </div>
            )
          })}
        </div>
        {c.parents && <p className="muted">Mashed from {c.parents[0]} + {c.parents[1]}</p>}
        <div className="set-btns">
          <Btn variant="cyan" onClick={() => shareCreature(c)} disabled={s.sharing}>
            <Icon n="share" size={18} /> Share
          </Btn>
          {canRecycle && (
            <Btn variant="ghost" onClick={() => recycleCreature(c.id)}>
              <Icon n="recycle" size={18} /> Recycle +{recycleValue(c)}
            </Btn>
          )}
        </div>
      </div>
    </Sheet>
  )
}

function OrderPicker({ orderId }: { orderId: string }) {
  const s = useApp()
  const o = dailyOrders(today()).find((x) => x.id === orderId)
  if (!o) return null
  const ok = s.game.pen.filter((c) => orderMet(o, c))
  return (
    <Sheet open title={`Deliver to ${o.client.name}`} onClose={closeModal} tone="#7dff3a">
      <p className="muted">{o.reqs.map(reqLabel).join(' · ')}. The monster you pick leaves your pen.</p>
      <div className="pick">
        {ok.map((c) => (
          <button key={c.id} className="pickc" style={{ ['--rc' as any]: RARITY_INFO[c.rarity].color }} onClick={() => deliver(o.id, c.id)}>
            <Portrait code={c.code} size={72} />
            <b>{c.name}</b>
            <small>Fright {c.fright}</small>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function SwapPicker() {
  const s = useApp()
  const r = s.reveal
  if (!r) return null
  return (
    <Sheet open title={`Swap out for ${r.child.name}`} onClose={closeModal} tone="#c9b6ff">
      <p className="muted">Pick a monster to release. You'll get its recycle coins.</p>
      <div className="pick">
        {[...s.game.pen]
          .sort((a, b) => a.fright - b.fright)
          .map((c) => (
            <button key={c.id} className="pickc" style={{ ['--rc' as any]: RARITY_INFO[c.rarity].color }} onClick={() => resolveFull({ swap: c.id })}>
              <Portrait code={c.code} size={64} />
              <b>{c.name}</b>
              <small>
                Fright {c.fright} · +{recycleValue(c)}
              </small>
            </button>
          ))}
      </div>
    </Sheet>
  )
}

export function ModalHost() {
  const s = useApp()
  const m = s.modal
  return (
    <AnimatePresence mode="wait">
      {m?.kind === 'gift' && <Gift key="gift" />}
      {m?.kind === 'settings' && <Settings key="settings" />}
      {m?.kind === 'about' && <About key="about" />}
      {m?.kind === 'confirmReset' && <ConfirmReset key="cr" />}
      {m?.kind === 'rushIntro' && <RushIntro key="ri" />}
      {m?.kind === 'rushEnd' && <RushEnd key="re" />}
      {m?.kind === 'challenge' && <ChallengeIntro key="ch" ch={m.ch} />}
      {m?.kind === 'creature' && <CreatureModal key={'c' + m.id} id={m.id} />}
      {m?.kind === 'order' && <OrderPicker key={'o' + m.orderId} orderId={m.orderId} />}
      {m?.kind === 'swap' && <SwapPicker key="sw" />}
    </AnimatePresence>
  )
}

export function ToastHost() {
  const s = useApp()
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {s.toasts.map((t) => (
          <motion.div key={t.id} className={`toast ${t.kind}`} layout initial={{ opacity: 0, y: -24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16 }} transition={{ type: 'spring', stiffness: 460, damping: 28 }}>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
void renderCard
void downloadBlob
void useEffect
