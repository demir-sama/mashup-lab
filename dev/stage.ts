import '@fontsource/lilita-one/index.css'
import { Stage } from '../src/stage/Stage'
import { starterCreatures, fuseCreatures, buildCreature } from '../src/core/creature'
import { makeGenome } from '../src/core/genome'
import { STARTER_PART_KEYS } from '../src/core/parts'

const q = new URLSearchParams(location.search)
const st = new Stage(document.getElementById('c') as HTMLCanvasElement)
st.setPod(q.get('pod') ?? 'classic')
const s = starterCreatures('2026-10-28')
const phase = q.get('phase') ?? 'idle'
const t = Number(q.get('t') ?? 1)
document.fonts.load('40px "Lilita One"').then(async () => {
  if (phase === 'empty') st.setSlots(null, null)
  else st.setSlots(s[0], s[3])
  st.advance(0.8)
  if (phase === 'fuse' || phase === 'reveal') {
    const out = fuseCreatures({ a: s[0], b: s[3], seed: Number(q.get('seed') ?? 7), born: 'x', pool: new Set(STARTER_PART_KEYS), guarantee: true })
    if (q.get('rar')) out.child.rarity = q.get('rar') as any
    const p = st.fuse(s[0], s[3], out.child)
    st.setSlots(null, null)
    if (phase === 'reveal') { st.skip(); st.advance(t) } else st.advance(t)
    void p
  }
  ;(window as any).__done = true
})
void buildCreature; void makeGenome
