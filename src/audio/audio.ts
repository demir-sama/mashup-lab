/** Procedural WebAudio: every sound and the music loop are synthesised at runtime. No audio files ship. */

type Rarity = 0 | 1 | 2 | 3 | 4

let ctx: AudioContext | null = null
let master: GainNode, sfxBus: GainNode, musicBus: GainNode, musicFilter: BiquadFilterNode, delay: DelayNode
let noiseBuf: AudioBuffer
const state = { sfx: true, music: true, started: false }

function ensure(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext || (window as any).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.9
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 4
  master.connect(comp).connect(ctx.destination)
  sfxBus = ctx.createGain()
  sfxBus.gain.value = 0.9
  sfxBus.connect(master)
  musicBus = ctx.createGain()
  musicBus.gain.value = state.music ? 0.32 : 0
  musicFilter = ctx.createBiquadFilter()
  musicFilter.type = 'lowpass'
  musicFilter.frequency.value = 2400
  delay = ctx.createDelay(1)
  delay.delayTime.value = 0.27
  const fb = ctx.createGain()
  fb.gain.value = 0.28
  delay.connect(fb).connect(delay)
  const wet = ctx.createGain()
  wet.gain.value = 0.35
  delay.connect(wet).connect(musicFilter)
  musicBus.connect(musicFilter)
  musicFilter.connect(master)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return ctx
}

export function unlockAudio() {
  const c = ensure()
  if (!c) return
  if (c.state !== 'running') c.resume().catch(() => {})
  if (!state.started) {
    state.started = true
    startMusic()
  }
}

export function setAudio(opts: { sfx?: boolean; music?: boolean }) {
  if (opts.sfx !== undefined) state.sfx = opts.sfx
  if (opts.music !== undefined) {
    state.music = opts.music
    if (ctx) musicBus.gain.setTargetAtTime(opts.music ? 0.32 : 0, ctx.currentTime, 0.25)
  }
}
export function suspendAudio(on: boolean) {
  if (!ctx) return
  if (on) ctx.suspend().catch(() => {})
  else ctx.resume().catch(() => {})
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

function tone(o: { f: number; f2?: number; t?: number; d: number; type?: OscillatorType; v?: number; a?: number; bus?: AudioNode; detune?: number; lp?: number }) {
  const c = ctx!
  const t0 = o.t ?? c.currentTime
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.f, t0)
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + o.d)
  if (o.detune) osc.detune.value = o.detune
  const a = o.a ?? 0.008
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(o.v ?? 0.3, t0 + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d)
  let n: AudioNode = osc
  if (o.lp) {
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = o.lp
    osc.connect(f)
    n = f
  }
  n.connect(g).connect(o.bus ?? sfxBus)
  osc.start(t0)
  osc.stop(t0 + o.d + 0.05)
}

function noise(o: { t?: number; d: number; v?: number; f: number; f2?: number; q?: number; type?: BiquadFilterType; bus?: AudioNode }) {
  const c = ctx!
  const t0 = o.t ?? c.currentTime
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = o.type ?? 'bandpass'
  f.frequency.setValueAtTime(o.f, t0)
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.d)
  f.Q.value = o.q ?? 1
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(o.v ?? 0.3, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d)
  src.connect(f).connect(g).connect(o.bus ?? sfxBus)
  src.start(t0, Math.random())
  src.stop(t0 + o.d + 0.05)
}

type Sfx = 'tap' | 'pick' | 'drop' | 'swap' | 'coin' | 'buy' | 'nope' | 'clank' | 'splat' | 'whoosh' | 'tick' | 'open' | 'close' | 'page' | 'gift' | 'boing'
export function sfx(name: Sfx) {
  if (!state.sfx || !ensure() || ctx!.state !== 'running') return
  const t = ctx!.currentTime
  switch (name) {
    case 'tap': tone({ f: 640, f2: 520, d: 0.07, type: 'triangle', v: 0.16 }); break
    case 'pick': tone({ f: 420, f2: 780, d: 0.12, type: 'triangle', v: 0.22 }); break
    case 'drop': tone({ f: 300, f2: 120, d: 0.16, type: 'sine', v: 0.4 }); noise({ d: 0.07, f: 900, v: 0.12 }); break
    case 'swap': tone({ f: 520, f2: 330, d: 0.12, type: 'square', v: 0.08, lp: 1800 }); break
    case 'coin': tone({ f: 988, d: 0.09, type: 'square', v: 0.1, lp: 3000 }); tone({ f: 1319, t: t + 0.07, d: 0.22, type: 'square', v: 0.1, lp: 3000 }); break
    case 'buy': [523, 659, 784, 1047].forEach((f, i) => tone({ f, t: t + i * 0.06, d: 0.2, type: 'triangle', v: 0.2 })); break
    case 'nope': tone({ f: 200, f2: 140, d: 0.22, type: 'sawtooth', v: 0.14, lp: 700 }); tone({ f: 190, f2: 120, t: t + 0.12, d: 0.22, type: 'sawtooth', v: 0.12, lp: 600 }); break
    case 'clank': tone({ f: 180, f2: 60, d: 0.3, type: 'sine', v: 0.5 }); noise({ d: 0.12, f: 2500, q: 4, v: 0.18 }); tone({ f: 1650, d: 0.4, type: 'triangle', v: 0.07 }); break
    case 'splat': noise({ d: 0.35, f: 1800, f2: 300, q: 0.8, v: 0.4 }); tone({ f: 160, f2: 50, d: 0.25, v: 0.35 }); break
    case 'whoosh': noise({ d: 0.5, f: 300, f2: 3600, q: 0.6, v: 0.25 }); break
    case 'tick': tone({ f: 1500, d: 0.03, type: 'square', v: 0.06, lp: 4000 }); break
    case 'open': tone({ f: 330, f2: 660, d: 0.14, type: 'triangle', v: 0.16 }); break
    case 'close': tone({ f: 600, f2: 300, d: 0.12, type: 'triangle', v: 0.14 }); break
    case 'page': noise({ d: 0.18, f: 3000, f2: 900, q: 0.5, type: 'highpass', v: 0.15 }); break
    case 'boing': tone({ f: 200, f2: 520, d: 0.28, type: 'sine', v: 0.35 }); tone({ f: 520, f2: 260, t: t + 0.14, d: 0.2, type: 'sine', v: 0.2 }); break
    case 'gift': [392, 494, 587, 784, 988].forEach((f, i) => tone({ f, t: t + i * 0.07, d: 0.3, type: 'triangle', v: 0.2 })); break
  }
}

/** Rising rattle that runs while the machine works. Returns a stop function. */
export function machineLoop(duration: number): () => void {
  if (!state.sfx || !ensure() || ctx!.state !== 'running') return () => {}
  const c = ctx!
  const t0 = c.currentTime
  const osc = c.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(55, t0)
  osc.frequency.exponentialRampToValueAtTime(180, t0 + duration)
  const lfo = c.createOscillator()
  lfo.frequency.setValueAtTime(6, t0)
  lfo.frequency.exponentialRampToValueAtTime(34, t0 + duration)
  const lfoG = c.createGain()
  lfoG.gain.value = 0.22
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.3)
  lfo.connect(lfoG).connect(g.gain)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(300, t0)
  lp.frequency.exponentialRampToValueAtTime(2200, t0 + duration)
  osc.connect(lp).connect(g).connect(sfxBus)
  osc.start(t0)
  lfo.start(t0)
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    const t = c.currentTime
    g.gain.cancelScheduledValues(t)
    g.gain.setTargetAtTime(0.0001, t, 0.04)
    osc.stop(t + 0.3)
    lfo.stop(t + 0.3)
  }
}

export function boom(r: Rarity) {
  if (!state.sfx || !ensure() || ctx!.state !== 'running') return
  const t = ctx!.currentTime
  tone({ f: 140, f2: 36, d: 0.7, v: 0.7 })
  noise({ d: 0.5, f: 1200, f2: 120, q: 0.7, v: 0.5 })
  const root = [57, 60, 62, 64, 67][r]
  const scale = r >= 3 ? [0, 4, 7, 12, 16, 19, 24] : r >= 2 ? [0, 3, 7, 12, 15, 19] : r >= 1 ? [0, 3, 7, 12] : [0, 7, 12]
  scale.forEach((s, i) => {
    tone({ f: mtof(root + s + 12), t: t + 0.12 + i * 0.075, d: 0.5, type: 'triangle', v: 0.22 })
    if (r >= 2) tone({ f: mtof(root + s + 24), t: t + 0.12 + i * 0.075, d: 0.35, type: 'sine', v: 0.1 })
  })
  if (r >= 3) {
    ;[0, 4, 7].forEach((s) => tone({ f: mtof(root + s + 12), t: t + 0.12 + scale.length * 0.075, d: 1.4, type: 'sawtooth', v: 0.08, lp: 2200 }))
    for (let i = 0; i < 12; i++) tone({ f: 1800 + Math.random() * 2400, t: t + 0.4 + i * 0.05, d: 0.12, type: 'sine', v: 0.06 })
  }
}

// ---------- music ----------
const CHORDS = [
  { root: 45, notes: [0, 3, 7, 12, 15] },
  { root: 41, notes: [0, 4, 7, 12, 16] },
  { root: 38, notes: [0, 3, 7, 12, 15] },
  { root: 40, notes: [0, 4, 7, 11, 16] },
]
const BPM = 108
const STEP = 60 / BPM / 2
let nextT = 0
let stepN = 0
let timer = 0
let intensity = 0
export function setIntensity(v: number) {
  intensity = v
  if (ctx) musicFilter.frequency.setTargetAtTime(1600 + v * 5000, ctx.currentTime, 0.2)
}

function scheduleStep(n: number, t: number) {
  const bar = Math.floor(n / 8) % CHORDS.length
  const ch = CHORDS[bar]
  const s = n % 8
  const swing = s % 2 === 1 ? STEP * 0.18 : 0
  const tt = t + swing
  // bass: root on 0, fifth on 4, little walk
  if (s === 0 || s === 3 || s === 4 || s === 6) {
    const off = s === 4 ? 7 : s === 6 ? 3 : 0
    tone({ f: mtof(ch.root + off), t: tt, d: STEP * 1.5, type: 'triangle', v: 0.5, bus: musicBus, lp: 600 })
  }
  // off-beat pluck chords
  if (s === 2 || s === 5) ch.notes.slice(1, 4).forEach((x, i) => tone({ f: mtof(ch.root + 24 + x), t: tt + i * 0.012, d: 0.22, type: 'square', v: 0.035, bus: musicBus, lp: 1800 }))
  // melody: deterministic pseudo-random from step
  const r = Math.sin(n * 12.9898 + bar * 78.233) * 43758.5453
  const rr = r - Math.floor(r)
  if ((s === 0 || s === 2 || s === 5 || s === 7 || (intensity > 0.5 && s % 2 === 1)) && rr > 0.28) {
    const note = ch.notes[Math.floor(rr * 977) % ch.notes.length]
    tone({ f: mtof(ch.root + 36 + note), t: tt, d: STEP * 1.8, type: 'triangle', v: 0.16, bus: musicBus, a: 0.012 })
    if (rr > 0.8) tone({ f: mtof(ch.root + 48 + note), t: tt, d: 0.3, type: 'sine', v: 0.05, bus: delay })
  }
  // soft tick hat
  if (s % 2 === 0) noise({ t: tt, d: 0.04, f: 7000, type: 'highpass', v: 0.025 + intensity * 0.02, bus: musicBus })
  // pad on bar start
  if (s === 0 && n % 16 === 0) ch.notes.slice(0, 3).forEach((x) => tone({ f: mtof(ch.root + 24 + x), t: tt, d: STEP * 15, type: 'sawtooth', v: 0.018, a: 0.6, bus: musicBus, lp: 900 }))
}

function startMusic() {
  const c = ctx!
  nextT = c.currentTime + 0.15
  const pump = () => {
    if (!ctx) return
    while (nextT < ctx.currentTime + 0.35) {
      if (state.music && ctx.state === 'running') scheduleStep(stepN, nextT)
      stepN++
      nextT += STEP
    }
    timer = window.setTimeout(pump, 90)
  }
  window.clearTimeout(timer)
  pump()
}
