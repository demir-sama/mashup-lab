import type { Genome } from '../core/genome'
import type { Palette } from '../core/palettes'
import type { Pt } from './draw'

export type Mood = 'idle' | 'happy' | 'scared' | 'dizzy' | 'sleepy' | 'shout'

export interface Rig {
  g: Genome
  pal: Palette
  /** seconds, drives idle animation */
  t: number
  /** wobble energy 0..1+ (jelly shake) */
  wob: number
  /** eye target in -1..1 */
  look: Pt
  /** 0 open .. 1 closed */
  blink: number
  mood: Mood
  /** deterministic per-creature variation 0..1 */
  rnd: (i: number) => number
  /** quality: false = skip expensive extras */
  fancy: boolean
  /** measure only: compute BodyInfo without painting */
  dry?: boolean
}

export interface BodyInfo {
  /** body outline path (for clipping patterns) */
  path: Path2D
  top: number
  /** y of the head base */
  headY: number
  /** face centre if there is no head */
  faceY: number
  faceW: number
  shoulderY: number
  shoulderX: number
  hipY: number
  hipX: number
  floaty: boolean
  /** body half-width at mid height, used by limbs/auras */
  halfW: number
  midY: number
  /** local y of the lowest body point (for feet/hem) */
  bottom: number
}

export interface HeadInfo {
  top: number
  faceY: number
  faceW: number
  /** y of the upper face limit (eye stalks sprout here) */
  crownY: number
}
