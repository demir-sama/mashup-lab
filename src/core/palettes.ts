export interface Palette {
  id: string
  name: string
  main: string
  light: string
  dark: string
  accent: string
  belly: string
}

export const INK = '#170a24'

export const PALETTES: readonly Palette[] = [
  { id: 'lime', name: 'Toxic Lime', main: '#8be83a', light: '#c9ff7d', dark: '#3f9b1c', accent: '#ff4fd8', belly: '#eaffb8' },
  { id: 'grape', name: 'Grape Soda', main: '#8f55f4', light: '#bf96ff', dark: '#4a23a8', accent: '#ffd23f', belly: '#e4d6ff' },
  { id: 'pumpkin', name: 'Pumpkin Spice', main: '#ff8a1f', light: '#ffc36e', dark: '#c14a00', accent: '#5b2a9e', belly: '#ffe5bd' },
  { id: 'gum', name: 'Bubblegum', main: '#ff6fb1', light: '#ffabd5', dark: '#c2307c', accent: '#35e0d0', belly: '#ffe2f0' },
  { id: 'teal', name: 'Teal Ghoul', main: '#1fd1b6', light: '#7df2de', dark: '#0b8a7c', accent: '#ff7a3d', belly: '#c9fff5' },
  { id: 'bone', name: 'Old Bone', main: '#efe4c8', light: '#fffaf0', dark: '#b3a37c', accent: '#e8445a', belly: '#fffdf6' },
  { id: 'blood', name: 'Blood Moon', main: '#e0364f', light: '#ff8294', dark: '#8d1226', accent: '#ffe08a', belly: '#ffc7cf' },
  { id: 'midnight', name: 'Midnight', main: '#4457c8', light: '#8294ff', dark: '#1f2a73', accent: '#9dff3a', belly: '#bcc7ff' },
  { id: 'lemon', name: 'Lemon Zest', main: '#ffe13a', light: '#fff58f', dark: '#c9a000', accent: '#8f55f4', belly: '#fffac8' },
  { id: 'slate', name: 'Slate Goth', main: '#6e7289', light: '#a7acc6', dark: '#393c52', accent: '#ff6fb1', belly: '#d2d5e9' },
  { id: 'orchid', name: 'Orchid', main: '#c64df2', light: '#e6a0ff', dark: '#7b1fa8', accent: '#a6ff3d', belly: '#f2d0ff' },
  { id: 'frost', name: 'Frostbite', main: '#6fd3ff', light: '#c3efff', dark: '#2a8fc4', accent: '#ff5a8a', belly: '#e8f9ff' },
]

export const PALETTE_COUNT = PALETTES.length

export const PATTERNS = ['plain', 'spots', 'stripes', 'patches'] as const
export const PATTERN_COUNT = PATTERNS.length

export const SIZES = ['small', 'normal', 'big'] as const
