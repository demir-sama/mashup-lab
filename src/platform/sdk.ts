import RundotGameAPI from '@series-inc/rundot-game-sdk/api'
import type { HapticFeedbackStyle } from '@series-inc/rundot-game-sdk'
import { challengeParams, parseChallenge, type Challenge } from '../core/rush'

/**
 * Thin, defensive wrapper over the RUN SDK. Every call can reject (RPC bridge, missing capability,
 * offline), so nothing here ever throws into the game: failures resolve to a safe fallback.
 */

const api = RundotGameAPI as any

export const log = (...a: unknown[]) => {
  if (import.meta.env.DEV) console.debug('[mashup]', ...a)
}

async function safe<T>(label: string, fn: () => Promise<T> | T, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    log(label, 'failed', e)
    return fallback
  }
}
const fire = (label: string, fn: () => Promise<unknown> | unknown) => {
  try {
    const r = fn()
    if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch((e) => log(label, 'failed', e))
  } catch (e) {
    log(label, 'failed', e)
  }
}

export interface PlatformInfo {
  mock: boolean
  mobile: boolean
  name: string
  id: string
  anonymous: boolean
}

let info: PlatformInfo = { mock: true, mobile: false, name: 'You', id: 'local', anonymous: true }
let timeOffset = 0
export const platform = () => info
export const nowMs = () => Date.now() + timeOffset

export async function initPlatform(): Promise<PlatformInfo> {
  const env = await safe('env', () => api.system.getEnvironment(), null as any)
  const mock = !env || env.platformVersion === 'mock-1.0'
  const mobile = await safe('mobile', () => !!api.system.isMobile(), false)
  const prof = await safe('profile', () => api.getProfile(), null as any)
  const name = typeof prof?.username === 'string' && prof.username !== 'unknown-user' ? prof.username : 'You'
  info = { mock, mobile, name: name.slice(0, 18), id: String(prof?.id ?? 'local'), anonymous: prof?.isAnonymous !== false }
  const t = await safe('time', () => api.requestTimeAsync(), null as any)
  if (t && Number.isFinite(t.serverTime)) {
    const off = t.serverTime - Date.now()
    timeOffset = Math.abs(off) < 36 * 3600 * 1000 ? off : 0
  }
  return info
}

// ---------- storage (SDK appStorage only; never localStorage) ----------
export const storage = {
  get: (k: string) => safe<string | null>('get ' + k, () => api.appStorage.getItem(k), null),
  set: (k: string, v: string) => safe('set ' + k, async () => (await api.appStorage.setItem(k, v), true), false),
}

// ---------- haptics ----------
let hapticsOn = true
export const setHapticsEnabled = (on: boolean) => (hapticsOn = on)
export function haptic(style: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') {
  if (!hapticsOn) return
  fire('haptic', () => api.triggerHapticAsync(style as HapticFeedbackStyle))
}

// ---------- analytics ----------
export function track(name: string, props?: Record<string, unknown>) {
  fire('track ' + name, () => api.analytics.recordCustomEvent(name, props ?? {}))
}
export function funnel(step: number, name: string, group = 'onboarding') {
  fire('funnel ' + name, () => api.analytics.trackFunnelStep(step, name, group))
}

// ---------- lifecycle ----------
export function onLifecycle(h: { pause?: () => void; resume?: () => void; quit?: () => void }) {
  fire('lifecycle', () => {
    if (h.pause) api.lifecycles.onPause(h.pause)
    if (h.resume) api.lifecycles.onResume(h.resume)
    if (h.quit) api.lifecycles.onQuit(h.quit)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) h.pause?.()
    else h.resume?.()
  })
  window.addEventListener('pagehide', () => h.pause?.())
}

// ---------- ads ----------
export type AdResult = 'earned' | 'dismissed' | 'unavailable'
export async function rewardedReady(): Promise<boolean> {
  return safe('adready', () => api.ads.isRewardedAdReadyAsync(), false)
}
export async function showRewarded(placement: string): Promise<AdResult> {
  const ready = await rewardedReady()
  if (!ready) return 'unavailable'
  const ok = await safe('ad', () => api.ads.showRewardedAdAsync({ adDisplayId: placement, adDisplayName: placement }), null as boolean | null)
  if (ok === null) return 'unavailable'
  return ok ? 'earned' : 'dismissed'
}

// ---------- shop ----------
export interface ShopItem {
  itemId: string
  name: string
  price: string
}
export async function shopCatalog(): Promise<Record<string, ShopItem>> {
  const sf = await safe('catalog', () => api.shop.getCatalog(), null as any)
  const out: Record<string, ShopItem> = {}
  for (const it of sf?.items ?? []) {
    const fp = it.resolvedPrice?.finalPrice ?? it.price
    out[it.itemId] = { itemId: it.itemId, name: it.name, price: fp?.value != null ? String(fp.value) : '' }
  }
  return out
}
export async function shopBuy(itemId: string): Promise<'ok' | 'cancelled' | 'error'> {
  const key = `${itemId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  try {
    const r = await api.shop.purchase(itemId, key)
    if (r?.cancelled) return 'cancelled'
    return r?.success ? 'ok' : 'error'
  } catch (e) {
    log('purchase', e)
    return 'error'
  }
}
export async function ownedEntitlements(): Promise<string[]> {
  const list = await safe('entitlements', () => api.entitlements.listEntitlements(), [] as any[])
  return (list ?? []).filter((e: any) => (e.quantity ?? 1) > 0).map((e: any) => String(e.entitlementId ?? e.id))
}

// ---------- leaderboard ----------
export interface BoardRow {
  rank: number
  name: string
  score: number
  me: boolean
  avatar?: string | null
  demo?: boolean
}
export interface BoardData {
  rows: BoardRow[]
  myRank: number | null
  total: number
  demo: boolean
}

const DEMO_NAMES = ['Mortimer Ooze', 'Vex & Co.', 'GrimGlitter', 'Pip Pumpkin', 'Dr. Mash', 'Bonnie Boo', 'Zed Zombie', 'Lumi Lantern', 'Wrenfield', 'Cacklefox', 'Nyx', 'Sir Squelch']
function demoRows(seed: string, scale: number, mine: number | null): BoardRow[] {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const rows: BoardRow[] = []
  for (let i = 0; i < DEMO_NAMES.length; i++) {
    h = (h * 1664525 + 1013904223) >>> 0
    const s = Math.round(scale * (1 - i * 0.055) * (0.93 + ((h % 1000) / 1000) * 0.1))
    rows.push({ rank: 0, name: DEMO_NAMES[(i + (h % 5)) % DEMO_NAMES.length], score: s, me: false, demo: true })
  }
  const uniq = rows.filter((r, i) => rows.findIndex((x) => x.name === r.name) === i)
  if (mine !== null && mine > 0) uniq.push({ rank: 0, name: info.name, score: mine, me: true, demo: false })
  uniq.sort((a, b) => b.score - a.score)
  uniq.forEach((r, i) => (r.rank = i + 1))
  return uniq
}

export async function submitScore(mode: 'rush' | 'collector', score: number, metadata: Record<string, unknown> = {}): Promise<{ accepted: boolean; rank: number | null }> {
  const r = await safe('submit', () => api.leaderboard.submitScore({ score: Math.round(score), duration: Math.max(1, Math.round(Number(metadata.duration ?? 60))), mode, metadata }), null as any)
  if (!r) return { accepted: false, rank: null }
  return { accepted: !!r.accepted, rank: r.accepted ? (r.rank ?? null) : null }
}

export async function loadBoard(mode: 'rush' | 'collector', period: 'daily' | 'alltime', myBest: number | null, seed: string): Promise<BoardData> {
  const res = await safe('board', () => api.leaderboard.getPagedScores({ mode, period, limit: 50 }), null as any)
  const rows: BoardRow[] = (res?.entries ?? []).map((e: any, i: number) => ({
    rank: e.rank ?? i + 1,
    name: String(e.username ?? 'Player').slice(0, 20),
    score: Number(e.score) || 0,
    me: e.profileId === info.id,
    avatar: e.avatarUrl,
    demo: !!e.isSeed,
  }))
  if (info.mock && rows.length < 5) {
    // MockHost starts with an empty board. Show fictional rivals so the screen is not a ghost town.
    const scale = mode === 'rush' ? (period === 'daily' ? 380 : 520) : 640
    return { rows: demoRows(`${mode}:${period}:${seed}`, scale, myBest), myRank: null, total: 13, demo: true }
  }
  return { rows, myRank: res?.playerRank ?? null, total: res?.totalEntries ?? rows.length, demo: false }
}

// ---------- sharing ----------
export interface ShareResult {
  ok: boolean
  url: string
  method: 'file' | 'link' | 'clipboard' | 'none'
}

function webLink(params: Record<string, string>): string {
  const u = new URL(location.href)
  u.search = ''
  u.hash = ''
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return u.toString()
}

export async function createChallengeLink(ch: Challenge, title: string, description: string): Promise<string> {
  const params = challengeParams(ch)
  if (info.mock) return webLink(params)
  const r = await safe('sharelink', () => api.social.shareLinkAsync({ shareParams: params, metadata: { title, description } }), null as any)
  return r?.shareUrl ?? webLink(params)
}

export async function shareCard(blob: Blob, ch: Challenge, text: string, title: string): Promise<ShareResult> {
  const url = await createChallengeLink(ch, title, text)
  const fullText = `${text} ${url}`
  const can = await safe('canShareFile', () => api.social.canShareFileAsync(), { supported: false } as any)
  if (can?.supported) {
    const r = await safe('shareFile', () => api.social.shareFileAsync({ data: blob, filename: 'mashup-lab-monster.png', mimeType: 'image/png', title, text: fullText }), null as any)
    if (r && !r.cancelled) return { ok: true, url, method: 'file' }
    if (r?.cancelled) return { ok: false, url, method: 'none' }
  }
  try {
    const nav = navigator as any
    const file = new File([blob], 'mashup-lab-monster.png', { type: 'image/png' })
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title, text: fullText })
      return { ok: true, url, method: 'file' }
    }
    if (nav.share) {
      await nav.share({ title, text, url })
      return { ok: true, url, method: 'link' }
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return { ok: false, url, method: 'none' }
  }
  try {
    await navigator.clipboard.writeText(fullText)
    return { ok: true, url, method: 'clipboard' }
  } catch {
    return { ok: false, url, method: 'none' }
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(a.href)
    a.remove()
  }, 500)
}

export async function resolveIncomingChallenge(): Promise<Challenge | null> {
  const q: Record<string, string> = {}
  new URL(location.href).searchParams.forEach((v, k) => (q[k] = v))
  const fromUrl = parseChallenge(q)
  if (fromUrl) return fromUrl
  const intent = await safe('intent', () => api.app.resolveLaunchIntent({ maxWaitMs: 1200 }), null as any)
  if (intent && (intent.kind === 'share' || intent.kind === 'deeplink')) return parseChallenge(intent.params)
  return null
}

// ---------- notifications (opt-in reminder) ----------
export async function scheduleReminder(delayMs: number, title: string, body: string) {
  const delaySeconds = Math.min(7 * 86400, Math.max(60, Math.round(delayMs / 1000)))
  await safe('notify', () => api.notifications.submitMessageAsync({ channels: ['local'], title, body, delaySeconds, collapseKey: 'daily-gift' }), null)
}

export function toast(message: string, variant: 'success' | 'error' | 'info' = 'info') {
  fire('toast', () => api.popups.showToast(message, { variant }))
}

export function reportEngagement() {
  fire('engage', () => api.app.reportEngagement())
}
