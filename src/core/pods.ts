/** Mash-O-Matic pods: purely cosmetic skins for the machine. */
export interface PodDef {
  id: string
  name: string
  blurb: string
  /** coin price; premium pods can also be bought with real money through the RUN shop */
  coins: number
  premium?: { itemId: string; tier: string; label: string }
  // palette for the machine drawing
  metal: string
  metalDark: string
  trim: string
  glass: string
  goo: string
  glow: string
  bg1: string
  bg2: string
}

export const PODS: readonly PodDef[] = [
  { id: 'classic', name: 'Classic Lab', blurb: 'Brass, glass and good intentions.', coins: 0, metal: '#7a5ea8', metalDark: '#3a2663', trim: '#ffcf4a', glass: '#9dffd1', goo: '#7dff3a', glow: '#b6ff6a', bg1: '#2b1250', bg2: '#12062a' },
  { id: 'pumpkin', name: 'Pumpkin Patch', blurb: 'A cauldron with a seasonal glow-up.', coins: 600, metal: '#d4651a', metalDark: '#7a2e08', trim: '#ffe08a', glass: '#ffd18a', goo: '#ff9b2a', glow: '#ffb653', bg1: '#3a1608', bg2: '#190802' },
  { id: 'crypt', name: 'Crypt Cauldron', blurb: 'Cold stone, green flames, no refunds.', coins: 1200, metal: '#5d6577', metalDark: '#23283a', trim: '#8be0ff', glass: '#b8f3ff', goo: '#4bf0c6', glow: '#7cf7e0', bg1: '#0f2230', bg2: '#06101a' },
  { id: 'candy', name: 'Candy Coffin', blurb: 'Sweet. Slightly haunted. Sticky.', coins: 2400, premium: { itemId: 'pod_candy', tier: 'tier_199', label: '$1.99' }, metal: '#ff7ab8', metalDark: '#a8286f', trim: '#fff2a8', glass: '#ffd0ea', goo: '#ff4fa3', glow: '#ff9fd0', bg1: '#4a1038', bg2: '#210418' },
  { id: 'neon', name: 'Neon Morgue', blurb: 'Buzzing tubes and midnight shift.', coins: 3200, premium: { itemId: 'pod_neon', tier: 'tier_199', label: '$1.99' }, metal: '#2b2d5e', metalDark: '#0f1030', trim: '#ff3df0', glass: '#80f0ff', goo: '#3df0ff', glow: '#ff3df0', bg1: '#13104a', bg2: '#060420' },
  { id: 'gilded', name: 'Gilded Reliquary', blurb: 'Everything is gold. Even the screaming.', coins: 6000, premium: { itemId: 'pod_gilded', tier: 'tier_499', label: '$4.99' }, metal: '#e0a82a', metalDark: '#7b5410', trim: '#fff6c8', glass: '#fff0b0', goo: '#ffd23a', glow: '#fff08a', bg1: '#3a2a08', bg2: '#150e02' },
]

export const POD_BY_ID: Readonly<Record<string, PodDef>> = Object.fromEntries(PODS.map((p) => [p.id, p]))
