import { useSyncExternalStore } from 'react'
import {
  adsLeft, applyFusion, buyCapacity, buyMutagen, buyPart, buyPodWithCoins, claimGift, codexCounts, collectorScore, deliverOrder, deserialize, equipPod, grantAdMutagen, grantPod, keepChild, newGame,
  recycle, recycleChild, rollDay, SAVE_KEYS, serialize, MAX_ADS_PER_DAY, RUSH_FREE_ATTEMPTS, rushAttemptsLeft,
  type FusionEvents, type GameState,
} from '../core/state'
import { fuseCreatures, type Creature, type FusionOutcome } from '../core/creature'
import { dayKey, msUntilNextDay } from '../core/daily'
import { dailyOrders, type Order } from '../core/orders'
import { dailySeed, RUSH_FUSIONS, rushApply, rushDone, rushOutcome, rushStart, type Challenge, type RushState } from '../core/rush'
import { POD_BY_ID } from '../core/pods'
import type { MythicRecipe } from '../core/recipes'
import * as P from '../platform/sdk'
import { setAudio, sfx, unlockAudio, setIntensity } from '../audio/audio'
import type { Stage } from '../stage/Stage'
import { renderCard } from '../art/thumbs'

export type Tab = 'lab' | 'orders' | 'codex' | 'ranks' | 'shop'
export type Mode = 'lab' | 'rush'

export interface Reveal {
  child: Creature
  mode: Mode
  ev: FusionEvents | null
  mythic: MythicRecipe | null
  result: FusionOutcome['result']
  penFull: boolean
  parents: [string, string]
  rushIndex?: number
  prevBest?: number
}
export type Modal =
  | { kind: 'gift' }
  | { kind: 'settings' }
  | { kind: 'challenge'; ch: Challenge }
  | { kind: 'rushEnd' }
  | { kind: 'rushIntro' }
  | { kind: 'creature'; id: string }
  | { kind: 'order'; orderId: string }
  | { kind: 'swap' }
  | { kind: 'about' }
  | { kind: 'confirmReset' }
  | null

export interface RushRun {
  state: RushState
  kind: 'daily' | 'challenge'
  challenge?: Challenge
  finished?: { score: number; coins: number; won?: boolean; submitted?: { accepted: boolean; rank: number | null } }
}
export interface Toast {
  id: number
  text: string
  kind: 'good' | 'bad' | 'info'
}

export interface App {
  ready: boolean
  game: GameState
  info: P.PlatformInfo
  tab: Tab
  mode: Mode
  slots: [string | null, string | null]
  rush: RushRun | null
  busy: boolean
  reveal: Reveal | null
  modal: Modal
  /** -1 = tutorial finished */
  tutorial: number
  boost: boolean
  catalog: Record<string, P.ShopItem>
  incoming: Challenge | null
  toasts: Toast[]
  reduced: boolean
  giftPending: boolean
  now: number
  sort: 'new' | 'fright' | 'rarity'
  sharing: boolean
}

let S: App = {
  ready: false,
  game: newGame(Date.now(), dayKey(Date.now())),
  info: P.platform(),
  tab: 'lab',
  mode: 'lab',
  slots: [null, null],
  rush: null,
  busy: false,
  reveal: null,
  modal: null,
  tutorial: -1,
  boost: false,
  catalog: {},
  incoming: null,
  toasts: [],
  reduced: false,
  giftPending: false,
  now: Date.now(),
  sort: 'new',
  sharing: false,
}
const subs = new Set<() => void>()
export const getApp = () => S
function set(patch: Partial<App> | ((s: App) => Partial<App>)) {
  S = { ...S, ...(typeof patch === 'function' ? patch(S) : patch) }
  subs.forEach((f) => f())
}
export function useApp(): App {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => S,
  )
}

export const stageHandle: { stage: Stage | null } = { stage: null }
const today = () => dayKey(P.nowMs())

// ---------- derived ----------
export const penOf = (s: App): Creature[] => (s.mode === 'rush' && s.rush ? s.rush.state.pen : s.game.pen)
export const slotCreatures = (s: App): [Creature | null, Creature | null] => {
  const pen = penOf(s)
  return [pen.find((c) => c.id === s.slots[0]) ?? null, pen.find((c) => c.id === s.slots[1]) ?? null]
}
export const todaysOrders = (s: App): Order[] => dailyOrders(today())
export const rushLeft = (s: App) => rushAttemptsLeft(s.game.rush, today())
export function effectiveReduced(g: GameState) {
  if (g.settings.motion === 'reduced') return true
  if (g.settings.motion === 'full') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// ---------- toasts ----------
let toastId = 1
export function toast(text: string, kind: Toast['kind'] = 'info') {
  const id = toastId++
  set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind }] }))
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2800)
}

// ---------- persistence ----------
const lastSaved: Record<string, string> = {}
let saveTimer = 0
function applyGame(g: GameState, quiet = false) {
  set({ game: g })
  if (!quiet) scheduleSave()
}
export function scheduleSave() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(saveNow, 700)
}
export async function saveNow() {
  window.clearTimeout(saveTimer)
  if (!S.ready) return
  const ser = serialize(S.game)
  for (const k of SAVE_KEYS) {
    if (lastSaved[k] !== ser[k]) {
      lastSaved[k] = ser[k]
      await P.storage.set(k, ser[k])
    }
  }
}

function syncSettings() {
  const st = S.game.settings
  setAudio({ sfx: st.sfx, music: st.music })
  P.setHapticsEnabled(st.haptics)
  const reduced = effectiveReduced(S.game)
  stageHandle.stage?.setReduced(reduced)
  document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'
  set({ reduced })
}
export function syncStage() {
  const st = stageHandle.stage
  if (!st) return
  st.setPod(S.game.eco.pod)
  st.setReduced(S.reduced)
}

// ---------- boot ----------
export async function boot() {
  window.addEventListener('unhandledrejection', (e) => {
    e.preventDefault()
    P.log('unhandled rejection', e.reason)
  })
  const info = await P.initPlatform()
  const raw: Record<string, string | null> = {}
  await Promise.all(SAVE_KEYS.map(async (k) => (raw[k] = await P.storage.get(k))))
  const now = P.nowMs()
  const day = dayKey(now)
  let game = deserialize(raw, now, day) ?? newGame(now, day)
  const fresh = !raw.pen
  const roll = rollDay(game, day)
  game = roll.state
  // restore premium entitlements bought on RUN
  const owned = await P.ownedEntitlements()
  for (const id of owned) {
    const pod = Object.values(POD_BY_ID).find((p) => p.premium?.itemId === id)
    if (pod && !game.eco.pods.includes(pod.id)) game = grantPod(game, pod.id)
    if (pod && !game.eco.entitled.includes(id)) game = { ...game, eco: { ...game.eco, entitled: [...game.eco.entitled, id] } }
  }
  for (const k of SAVE_KEYS) lastSaved[k] = fresh ? '' : (raw[k] ?? '')
  const incoming = await P.resolveIncomingChallenge()
  set({
    game,
    info,
    ready: true,
    tutorial: game.meta.tutorialDone ? -1 : 0,
    giftPending: roll.giftPending,
    incoming,
    now,
  })
  syncSettings()
  syncStage()
  scheduleSave()
  P.shopCatalog().then((catalog) => set({ catalog }))
  P.track('session_start', { fresh, streak: game.streak.streak, mock: info.mock })
  if (fresh) P.funnel(1, 'tutorial_start', 'onboarding')
  if (incoming) set({ modal: { kind: 'challenge', ch: incoming } })
  else if (game.meta.tutorialDone && roll.giftPending) set({ modal: { kind: 'gift' } })
  P.onLifecycle({
    pause: () => {
      saveNow()
      maybeRemind()
    },
    resume: () => {
      checkDay()
    },
    quit: () => void saveNow(),
  })
  window.setInterval(checkDay, 20000)
  window.setInterval(() => {
    if (!document.hidden && S.ready) {
      const g = structuredClone(S.game)
      g.meta.playSeconds += 20
      set({ game: g })
    }
  }, 20000)
}

function checkDay() {
  const day = today()
  if (S.game.daily.day !== day) {
    const roll = rollDay(S.game, day)
    applyGame(roll.state)
    set({ giftPending: roll.giftPending, now: P.nowMs() })
    if (roll.giftPending && !S.modal && S.tutorial < 0 && !S.busy) set({ modal: { kind: 'gift' } })
  }
}
function maybeRemind() {
  if (!S.game.settings.remind) return
  P.scheduleReminder(msUntilNextDay(P.nowMs()) + 3600_000, 'Your Mash-O-Matic is warm', 'Daily gift and fresh orders are waiting. Keep your streak alive!')
}

// ---------- settings ----------
export function setSetting<K extends keyof GameState['settings']>(k: K, v: GameState['settings'][K]) {
  const g = structuredClone(S.game)
  g.settings[k] = v
  applyGame(g)
  syncSettings()
  if (k === 'remind' && v) maybeRemind()
}

// ---------- navigation ----------
export function setTab(t: Tab) {
  if (S.busy) return
  sfx('tap')
  set({ tab: t })
  if (t === 'shop') P.funnel(1, 'shop_opened', 'purchase')
}
export function openModal(m: Modal) {
  sfx('open')
  set({ modal: m })
}
export function closeModal() {
  sfx('close')
  set({ modal: null })
}
export function setSort(sort: App['sort']) {
  set({ sort })
}
export function setMode(m: Mode) {
  if (S.busy || S.mode === m) return
  sfx('swap')
  stageHandle.stage?.showChild(null)
  set({ mode: m, slots: [null, null], reveal: null })
  if (m === 'rush' && !S.rush) set({ modal: { kind: 'rushIntro' } })
}

// ---------- slots ----------
export function placeAt(id: string, slot: 0 | 1) {
  if (S.busy || S.reveal) return
  const s = [...S.slots] as [string | null, string | null]
  const other = slot === 0 ? 1 : 0
  if (s[other] === id) s[other] = s[slot]
  s[slot] = id
  sfx('drop')
  P.haptic('light')
  set({ slots: s })
}
export function tapCreature(id: string) {
  if (S.busy || S.reveal) return
  unlockAudio()
  const s = [...S.slots] as [string | null, string | null]
  const at = s.indexOf(id)
  if (at >= 0) {
    s[at] = null
    sfx('swap')
  } else {
    const free = s[0] === null ? 0 : s[1] === null ? 1 : 1
    s[free] = id
    sfx('pick')
    P.haptic('light')
  }
  set({ slots: s })
}
export function clearSlot(i: 0 | 1) {
  if (S.busy) return
  const s = [...S.slots] as [string | null, string | null]
  s[i] = null
  sfx('swap')
  set({ slots: s })
}
export function toggleBoost() {
  if (S.busy) return
  if (S.mode === 'rush') return
  if (!S.boost && S.game.eco.mutagens < 1) {
    set({ tab: 'shop' })
    toast('Out of Mutagen. Grab some here!', 'info')
    return
  }
  sfx(S.boost ? 'swap' : 'pick')
  set({ boost: !S.boost })
}

// ---------- fusion ----------
const rand32 = () => Math.floor(Math.random() * 0xffffffff)

export async function fuse() {
  const st = stageHandle.stage
  if (!st || S.busy || S.reveal) return
  const [ca, cb] = slotCreatures(S)
  if (!ca || !cb || ca.id === cb.id) return
  unlockAudio()
  const day = today()
  const mode = S.mode
  let outcome: FusionOutcome
  let useMut = false
  const tut = S.tutorial >= 0
  if (mode === 'rush' && S.rush) {
    if (rushDone(S.rush.state)) return
    outcome = rushOutcome(S.rush.state, ca, cb, day)
  } else {
    useMut = S.boost && S.game.eco.mutagens > 0
    const g = S.game
    outcome = fuseCreatures({
      a: ca,
      b: cb,
      seed: rand32(),
      born: day,
      pool: new Set(g.eco.unlocked),
      boost: useMut,
      takenNames: new Set([...g.pen.map((c) => c.name), ...g.codex.names]),
      knownMythics: new Set(g.codex.mythics),
      guarantee: tut,
    })
  }
  set({ busy: true, slots: [null, null], tutorial: tut ? 3 : S.tutorial })
  P.track('fusion_start', { mode, tut, boost: useMut })
  const fast = S.game.settings.fastFusion && !tut
  await st.fuse(ca, cb, outcome.child, { fast, reduced: S.reduced })
  setIntensity(0.3)
  if (mode === 'rush' && S.rush) {
    const rs = S.rush.state
    const next = rushApply(rs, outcome)
    set({
      rush: { ...S.rush, state: next },
      reveal: { child: outcome.child, mode, ev: null, mythic: outcome.mythic, result: outcome.result, penFull: false, parents: [ca.name, cb.name], rushIndex: next.used, prevBest: rs.best },
    })
  } else {
    const { state, ev } = applyFusion(S.game, outcome, day, useMut)
    applyGame(state)
    set({
      boost: false,
      reveal: { child: outcome.child, mode, ev, mythic: outcome.mythic, result: outcome.result, penFull: ev.penFull, parents: [ca.name, cb.name] },
      tutorial: tut ? 4 : S.tutorial,
    })
    if (ev.newBest || ev.delta.newSpecies) submitCollector()
    P.track('fusion', { rarity: outcome.child.rarity, fright: outcome.child.fright, newSpecies: ev.delta.newSpecies, mythic: ev.mythic })
    if (ev.coins) setTimeout(() => sfx('coin'), 700)
  }
  set({ busy: false })
  P.reportEngagement()
}

let lastCollectorSubmit = 0
export async function submitCollector() {
  if (Date.now() - lastCollectorSubmit < 15000) return
  lastCollectorSubmit = Date.now()
  const score = collectorScore(S.game.codex)
  if (score <= S.game.meta.lastSubmitted.collector) return
  const r = await P.submitScore('collector', score, { duration: Math.round(S.game.meta.playSeconds) || 60, species: codexCounts(S.game.codex).species })
  if (r.accepted) {
    const g = structuredClone(S.game)
    g.meta.lastSubmitted.collector = score
    applyGame(g)
  }
}

export function dismissReveal() {
  const r = S.reveal
  if (!r) return
  if (r.penFull && r.mode === 'lab') return
  sfx('close')
  stageHandle.stage?.showChild(null)
  const finishedRush = r.mode === 'rush' && S.rush && rushDone(S.rush.state)
  set({ reveal: null })
  if (S.tutorial === 4) completeTutorial()
  if (finishedRush) finishRush()
}

export function resolveFull(choice: 'recycle' | { swap: string }) {
  const r = S.reveal
  if (!r || !r.penFull) return
  let g: GameState
  if (choice === 'recycle') g = recycleChild(S.game, r.child)
  else g = keepChild(S.game, r.child, choice.swap)
  sfx('coin')
  applyGame(g)
  set({ reveal: { ...r, penFull: false }, modal: null })
  dismissReveal()
}

export function recycleCreature(id: string) {
  const g = recycle(S.game, id)
  if (g === S.game) return
  sfx('coin')
  applyGame(g)
  set({ slots: [S.slots[0] === id ? null : S.slots[0], S.slots[1] === id ? null : S.slots[1]], modal: null })
  toast('Recycled for coins', 'good')
}

// ---------- tutorial ----------
export function advanceTutorial() {
  if (S.tutorial < 0) return
  const [a, b] = S.slots
  if (S.tutorial === 0 && (a || b)) set({ tutorial: 1 })
  if (S.tutorial === 1 && a && b) set({ tutorial: 2 })
  if (S.tutorial === 2 && !(a && b)) set({ tutorial: a || b ? 1 : 0 })
  if (S.tutorial === 1 && !a && !b) set({ tutorial: 0 })
}
function completeTutorial() {
  const g = structuredClone(S.game)
  g.meta.tutorialDone = true
  g.eco.coins += 50
  applyGame(g)
  set({ tutorial: -1 })
  P.funnel(2, 'tutorial_complete', 'onboarding')
  P.track('tutorial_complete')
  toast('+50 coins for finishing training!', 'good')
  setTimeout(() => {
    if (S.giftPending && !S.modal) set({ modal: { kind: 'gift' } })
  }, 600)
}
export function skipTutorial() {
  if (S.busy) return
  completeTutorial()
}
export function replayTutorial() {
  set({ tutorial: 0, modal: null, tab: 'lab', mode: 'lab', slots: [null, null] })
}

// ---------- gifts, orders ----------
export function claim() {
  const r = claimGift(S.game, today())
  if (!r) return null
  applyGame(r.state)
  set({ giftPending: false })
  sfx('gift')
  P.haptic('success')
  P.track('daily_gift', { streak: r.state.streak.streak })
  return r.reward
}

export function deliver(orderId: string, creatureId: string) {
  const order = dailyOrders(today()).find((o) => o.id === orderId)
  if (!order) return
  const r = deliverOrder(S.game, order, creatureId)
  if (!r) {
    sfx('nope')
    return
  }
  applyGame(r.state)
  set({ modal: null, slots: [S.slots[0] === creatureId ? null : S.slots[0], S.slots[1] === creatureId ? null : S.slots[1]] })
  sfx('coin')
  P.haptic('success')
  toast(`Order delivered! +${r.reward + r.bonus} coins`, 'good')
  P.track('order_delivered', { tier: order.tier })
}

// ---------- shop ----------
function result(r: ReturnType<typeof buyPart>, okMsg: string) {
  if (r.ok) {
    applyGame(r.state)
    sfx('buy')
    P.haptic('success')
    toast(okMsg, 'good')
    return true
  }
  sfx('nope')
  P.haptic('error')
  toast(r.reason, 'bad')
  return false
}
export const shopBuyPart = (key: string) => result(buyPart(S.game, key), 'Part unlocked! It can now show up in fusions.')
export const shopBuyMutagen = () => result(buyMutagen(S.game), '+1 Mutagen')
export const shopBuyCapacity = () => result(buyCapacity(S.game), 'Pen expanded!')
export function shopBuyPod(id: string) {
  const ok = result(buyPodWithCoins(S.game, id), 'Pod unlocked!')
  if (ok) applyGame(equipPod(S.game, id))
  syncStage()
}
export function equip(id: string) {
  applyGame(equipPod(S.game, id))
  sfx('swap')
  syncStage()
}
export async function shopBuyPremiumPod(id: string) {
  const pod = POD_BY_ID[id]
  if (!pod?.premium) return
  P.funnel(2, 'checkout_started', 'purchase')
  const r = await P.shopBuy(pod.premium.itemId)
  if (r === 'ok') {
    let g = grantPod(S.game, id)
    g = equipPod({ ...g, eco: { ...g.eco, entitled: [...g.eco.entitled, pod.premium.itemId] } }, id)
    applyGame(g)
    syncStage()
    sfx('buy')
    P.haptic('success')
    P.funnel(3, 'purchase_complete', 'purchase')
    P.track('purchase_complete', { item: pod.premium.itemId })
    toast(`${pod.name} unlocked. Thank you!`, 'good')
  } else if (r === 'error') {
    toast('Purchase did not go through. You were not charged.', 'bad')
  }
}

export async function watchAdForMutagen() {
  if (adsLeft(S.game, today()) <= 0) {
    toast('No more ad rewards today. Back tomorrow!', 'info')
    return
  }
  const r = await P.showRewarded('mutagen_boost')
  if (r === 'earned') {
    applyGame(grantAdMutagen(S.game, today()))
    sfx('buy')
    P.track('ad_reward', { kind: 'mutagen' })
    toast('+1 Mutagen. Go get weird!', 'good')
  } else if (r === 'unavailable') toast('No ad available right now. Try again soon!', 'info')
}
export async function watchAdForRushAttempt() {
  const g0 = S.game
  if (adsLeft(g0, today()) <= 0) {
    toast('No more ad rewards today. Back tomorrow!', 'info')
    return false
  }
  const r = await P.showRewarded('rush_extra_attempt')
  if (r === 'earned') {
    const g = structuredClone(S.game)
    g.eco.ads = { day: today(), n: g.eco.ads.n + 1 }
    g.rush = { ...g.rush, day: today(), extra: g.rush.extra + 1 }
    applyGame(g)
    P.track('ad_reward', { kind: 'rush_attempt' })
    toast('Extra Rush attempt unlocked!', 'good')
    return true
  }
  if (r === 'unavailable') toast('No ad available right now. Try again soon!', 'info')
  return false
}

// ---------- rush ----------
export function startRush(kind: 'daily' | 'challenge', ch?: Challenge): boolean {
  if (S.busy) return false
  const day = today()
  let g = S.game
  if (kind === 'daily') {
    if (rushAttemptsLeft(g.rush, day) <= 0) {
      sfx('nope')
      return false
    }
    g = structuredClone(g)
    g.rush = { ...g.rush, day, attempts: (g.rush.day === day ? g.rush.attempts : 0) + 1, played: g.rush.played + 1 }
    applyGame(g)
  }
  const seed = kind === 'daily' ? dailySeed(day) : ch!.seed
  stageHandle.stage?.showChild(null)
  set({ rush: { state: rushStart(seed, day), kind, challenge: ch }, mode: 'rush', slots: [null, null], reveal: null, modal: null, incoming: kind === 'challenge' ? null : S.incoming, tab: 'lab' })
  sfx('open')
  P.track('rush_start', { kind })
  return true
}

async function finishRush() {
  const run = S.rush
  if (!run || run.finished) return
  const score = run.state.best
  const coins = 20 + Math.round(score / 8)
  const g = structuredClone(S.game)
  g.eco.coins += coins
  let won: boolean | undefined
  if (run.kind === 'challenge' && run.challenge) {
    won = score > run.challenge.target
    if (won) {
      g.meta.challengesWon++
      g.eco.coins += 60
    }
  }
  let submit: { accepted: boolean; rank: number | null } | undefined
  if (run.kind === 'daily') {
    g.rush.bestDaily = Math.max(g.rush.bestDaily, score)
    if (score > g.rush.bestAll) {
      g.rush.bestAll = score
      const best = run.state.pen.find((c) => c.id === run.state.bestId)
      g.rush.bestAllCode = best?.code ?? ''
      g.rush.bestAllName = best?.name ?? ''
    }
  }
  applyGame(g)
  set({ rush: { ...run, finished: { score, coins: coins + (won ? 60 : 0), won } }, modal: { kind: 'rushEnd' } })
  sfx(won === false ? 'nope' : 'gift')
  P.track('rush_complete', { kind: run.kind, score, won })
  if (run.kind === 'daily') {
    submit = await P.submitScore('rush', score, { duration: 90, seed: run.state.seed })
    if (S.rush?.finished) set({ rush: { ...S.rush, finished: { ...S.rush.finished, submitted: submit } } })
  }
}

export function leaveRush() {
  stageHandle.stage?.showChild(null)
  set({ rush: null, mode: 'lab', slots: [null, null], reveal: null, modal: null })
}

// ---------- sharing ----------
export async function shareCreature(c: Creature, opts?: { rushChallenge?: boolean }) {
  if (S.sharing) return
  set({ sharing: true })
  try {
    const run = S.rush
    const isRush = !!opts?.rushChallenge && !!run
    const ch: Challenge = isRush
      ? { seed: run!.state.seed, target: run!.state.best, from: S.info.name, name: c.name }
      : { seed: dailySeed(today()), target: 0, from: S.info.name, name: c.name }
    const headline = isRush ? `Fright ${c.fright} in 5 fusions. Beat that!` : 'I fused a brand-new monster!'
    const blob = await renderCard(c, { headline })
    const text = isRush ? `I scored ${c.fright} Fright in Mash-Up Lab's Rush. Can you beat it?` : `Meet ${c.name}, my Fright ${c.fright} ${c.rarity} monster from Mash-Up Lab!`
    const r = await P.shareCard(blob, ch, text, 'Mash-Up Lab')
    if (r.ok) {
      const g = structuredClone(S.game)
      g.meta.shares++
      applyGame(g)
      P.track('share', { method: r.method, rarity: c.rarity })
      if (r.method === 'clipboard') toast('Link copied! Paste it anywhere.', 'good')
      else toast('Shared!', 'good')
    } else if (r.method === 'none' && r.url) {
      P.downloadBlob(blob, `${c.name}.png`)
      toast('Saved the card image.', 'info')
    }
  } finally {
    set({ sharing: false })
  }
}

export function acceptIncoming(ch: Challenge) {
  set({ modal: null, incoming: null })
  startRush('challenge', ch)
}
export function declineIncoming() {
  set({ modal: null, incoming: null })
  if (S.giftPending && S.tutorial < 0) setTimeout(() => set({ modal: { kind: 'gift' } }), 200)
}

export function resetProgress() {
  const g = newGame(P.nowMs(), today())
  const roll = rollDay(g, today())
  stageHandle.stage?.showChild(null)
  set({ game: roll.state, slots: [null, null], reveal: null, rush: null, mode: 'lab', tab: 'lab', modal: null, tutorial: 0, giftPending: roll.giftPending })
  scheduleSave()
  syncSettings()
  syncStage()
}

export const RUSH_INFO = { fusions: RUSH_FUSIONS, free: RUSH_FREE_ATTEMPTS, adsPerDay: MAX_ADS_PER_DAY }
