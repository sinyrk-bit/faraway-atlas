import type {
  Biome,
  Difficulty,
  MatchMode,
  Quest,
  RegionCard,
  ResourceMap,
  ResourceType,
  SanctuaryCard,
  TimeOfDay,
} from './types'

const BIOMES: Biome[] = ['river', 'city', 'forest', 'desert']
const RESOURCES: ResourceType[] = ['uddu', 'okiko', 'goldlog']

const biomeNames: Record<Biome, { label: string; short: string; accent: string }> = {
  river: { label: 'River Reach', short: 'River', accent: '#74d9ff' },
  city: { label: 'Sunken City', short: 'City', accent: '#ffba72' },
  forest: { label: 'Mushroom Forest', short: 'Forest', accent: '#8fed8c' },
  desert: { label: 'Stone Desert', short: 'Desert', accent: '#f2d08d' },
}

const resourceNames: Record<ResourceType, { label: string; accent: string; glyph: string }> = {
  uddu: { label: 'Uddu Stone', accent: '#7bc6ff', glyph: 'UD' },
  okiko: { label: 'Okiko Chimera', accent: '#ff86cb', glyph: 'OK' },
  goldlog: { label: 'Goldlog Thistle', accent: '#ffe272', glyph: 'GL' },
}

export const biomeMeta = biomeNames
export const resourceMeta = resourceNames

export const modeMeta: Record<
  MatchMode,
  { title: string; summary: string; accent: string; detail: string }
> = {
  classic: {
    title: 'Classic Expedition',
    summary: 'The pure eight-round race through Alula.',
    accent: '#74d9ff',
    detail: 'Base Faraway-style flow with reverse scoring, sanctuaries and tactical drafting.',
  },
  advanced: {
    title: 'Advanced Opening',
    summary: 'Draft five opening regions and keep only three.',
    accent: '#b38cff',
    detail: 'A deeper opener for stronger synergies and more exact route planning.',
  },
  starfall: {
    title: 'Starfall Skies',
    summary: 'Meteor regions remain visible while echoes of matching digits light up.',
    accent: '#ffd36d',
    detail: 'An expansion-inspired mode with meteor cards, tie-break tempo and extra digit synergies.',
  },
}

export const difficultyMeta: Record<
  Difficulty,
  { label: string; summary: string; volatility: number; precision: number }
> = {
  wanderer: {
    label: 'Wanderer',
    summary: 'Relaxed AI with wider mistakes and softer tempo reads.',
    volatility: 5,
    precision: 0.65,
  },
  pathfinder: {
    label: 'Pathfinder',
    summary: 'Balanced opponent that values sanctuaries and efficient timing.',
    volatility: 3,
    precision: 0.82,
  },
  oracle: {
    label: 'Oracle',
    summary: 'Sharper drafting, tighter sequencing and better endgame focus.',
    volatility: 1.5,
    precision: 0.94,
  },
}

const adjectives = [
  'Whispering',
  'Gilded',
  'Moonlit',
  'Verdant',
  'Shifting',
  'Amber',
  'Silent',
  'Luminous',
  'Starlit',
  'Hidden',
  'Obsidian',
  'Radiant',
]

const biomeNouns: Record<Biome, string[]> = {
  river: ['Delta', 'Ferry', 'Spring', 'Canal', 'Cascade', 'Harbor', 'Ford', 'Wake'],
  city: ['Vault', 'Arcade', 'Forum', 'Spire', 'Gallery', 'Causeway', 'Atrium', 'Bastion'],
  forest: ['Bloom', 'Canopy', 'Grove', 'Mire', 'Glade', 'Hollow', 'Mycelium', 'Sanctum'],
  desert: ['Mesa', 'Mirage', 'Basin', 'Ridge', 'Dune', 'Cradle', 'Plateau', 'Badlands'],
}

const sanctuaryTitles = [
  'Celestial Refuge',
  'Hearth of Echoes',
  'Glassleaf Retreat',
  'Moonwell Cloister',
  'Lantern Hollow',
  'Atlas Shrine',
  'Quiet Observatory',
  'Dawnkeeper Roost',
  'Farsong Haven',
]

const sanctuarySubtitles = [
  'Hidden among the shifting wilds',
  'A place where old routes stay visible',
  'Pilgrims leave with clearer maps',
  'Even silence glows brighter here',
]

function zeroResources(): ResourceMap {
  return {
    uddu: 0,
    okiko: 0,
    goldlog: 0,
  }
}

function nextBiome(biome: Biome): Biome {
  return BIOMES[(BIOMES.indexOf(biome) + 1) % BIOMES.length]
}

function oppositeBiome(biome: Biome): Biome {
  return BIOMES[(BIOMES.indexOf(biome) + 2) % BIOMES.length]
}

function buildRegionTitle(serial: number, biome: Biome): { title: string; subtitle: string } {
  const adjective = adjectives[(serial * 3) % adjectives.length]
  const noun = biomeNouns[biome][serial % biomeNouns[biome].length]
  return {
    title: `${adjective} ${noun}`,
    subtitle: biomeNames[biome].label,
  }
}

function buildQuest(serial: number, biome: Biome, meteor: boolean): Quest {
  const p = serial % 12
  const adjacent = nextBiome(biome)
  const opposite = oppositeBiome(biome)

  switch (p) {
    case 0:
      return {
        type: 'per-resource',
        label: '2 Fame for each visible Uddu Stone.',
        points: 2,
        resource: 'uddu',
      }
    case 1:
      return {
        type: 'per-resource',
        label: '3 Fame for each visible Okiko Chimera.',
        points: 3,
        resource: 'okiko',
      }
    case 2:
      return {
        type: 'per-resource',
        label: '4 Fame for each visible Goldlog Thistle.',
        points: 4,
        resource: 'goldlog',
      }
    case 3:
      return {
        type: 'per-biome',
        label: `4 Fame for each ${biomeNames[biome].short} card.`,
        points: 4,
        biomes: [biome],
      }
    case 4:
      return {
        type: 'per-biome',
        label: `2 Fame for each ${biomeNames[biome].short} and ${biomeNames[adjacent].short} card.`,
        points: 2,
        biomes: [biome, adjacent],
        prerequisite: {
          type: 'resource',
          resource: 'uddu',
          count: 1,
          label: 'Requires at least 1 Uddu Stone.',
        },
      }
    case 5:
      return {
        type: 'set',
        label: '10 Fame for each set of 4 different biomes.',
        points: 10,
      }
    case 6:
      return {
        type: 'per-night',
        label: '4 Fame for each nighttime card.',
        points: 4,
        prerequisite: {
          type: 'clues',
          count: 2,
          label: 'Requires at least 2 Clues.',
        },
      }
    case 7:
      return {
        type: 'flat',
        label: '12 Fame if you hold one of each wonder.',
        points: 12,
        prerequisite: {
          type: 'resources',
          resources: [
            { resource: 'uddu', count: 1 },
            { resource: 'okiko', count: 1 },
            { resource: 'goldlog', count: 1 },
          ],
          label: 'Requires 1 Uddu, 1 Okiko and 1 Goldlog.',
        },
      }
    case 8:
      return {
        type: 'per-biome',
        label: `3 Fame for each ${biomeNames[opposite].short} card.`,
        points: 3,
        biomes: [opposite],
        prerequisite: {
          type: 'night',
          count: 2,
          label: 'Requires at least 2 nighttime cards.',
        },
      }
    case 9:
      return {
        type: 'per-sanctuary',
        label: '5 Fame for each Sanctuary.',
        points: 5,
        prerequisite: {
          type: 'resource',
          resource: 'goldlog',
          count: 1,
          label: 'Requires at least 1 Goldlog Thistle.',
        },
      }
    case 10:
      return {
        type: 'per-digit-match',
        label: '3 Fame for each visible Region sharing this number digit.',
        points: meteor ? 4 : 3,
        prerequisite: {
          type: 'clues',
          count: 1,
          label: 'Requires at least 1 Clue.',
        },
      }
    default:
      return {
        type: 'flat',
        label: '14 Fame if you have at least 2 Sanctuaries.',
        points: meteor ? 16 : 14,
        prerequisite: {
          type: 'sanctuary',
          count: 2,
          label: 'Requires at least 2 Sanctuaries.',
        },
      }
  }
}

function buildResources(serial: number, biome: Biome, meteor: boolean): ResourceMap {
  const resources = zeroResources()
  const majorMap: Record<Biome, ResourceType> = {
    river: 'okiko',
    city: 'uddu',
    forest: 'goldlog',
    desert: 'uddu',
  }
  const major = majorMap[biome]
  const secondary = RESOURCES[(RESOURCES.indexOf(major) + 1) % RESOURCES.length]
  const rare = RESOURCES[(RESOURCES.indexOf(major) + 2) % RESOURCES.length]

  if (serial % 2 === 0) {
    resources[major] += 1
  }
  if (serial % 7 === 0 || (meteor && serial % 3 === 0)) {
    resources[secondary] += 1
  }
  if (serial % 17 === 0 || (meteor && serial % 11 === 0)) {
    resources[rare] += 1
  }

  return resources
}

function buildRegionCard(serial: number, meteor = false): RegionCard {
  const biome = BIOMES[(serial + (meteor ? 1 : 0)) % BIOMES.length]
  const { title, subtitle } = buildRegionTitle(serial, biome)
  const duration = 1 + ((serial * (meteor ? 7 : 5) + (meteor ? 3 : 1)) % 8)
  const time: TimeOfDay = serial % (meteor ? 2 : 3) === 0 ? 'night' : 'day'
  const clues = meteor ? (serial % 4 === 0 ? 2 : 1) : serial % 9 === 0 ? 2 : serial % 4 === 0 ? 1 : 0

  return {
    id: `${meteor ? 'meteor' : 'region'}-${serial}`,
    cardType: 'region',
    serial,
    title,
    subtitle,
    flavor: meteor
      ? 'A meteor streak tears the sky open and leaves hidden routes glowing.'
      : 'The denizens remember every path differently from the way it was first walked.',
    biome,
    duration,
    time,
    clues,
    resources: buildResources(serial, biome, meteor),
    quest: buildQuest(serial, biome, meteor),
    rarity: meteor ? 'mythic' : serial % 11 === 0 ? 'rare' : 'common',
    meteor,
  }
}

function buildSanctuaryQuest(index: number, linkedBiome?: Biome): Quest | undefined {
  const selector = index % 6
  switch (selector) {
    case 0:
      return {
        type: 'per-resource',
        label: '1 Fame for each visible Clue.',
        points: 1,
        resource: 'clue',
      }
    case 1:
      return {
        type: 'per-night',
        label: '3 Fame for each nighttime card.',
        points: 3,
      }
    case 2:
      return {
        type: 'per-sanctuary',
        label: '4 Fame for each Sanctuary.',
        points: 4,
      }
    case 3:
      if (!linkedBiome) {
        return undefined
      }
      return {
        type: 'per-biome',
        label: `2 Fame for each ${biomeNames[linkedBiome].short} card.`,
        points: 2,
        biomes: [linkedBiome],
      }
    case 4:
      return {
        type: 'flat',
        label: '8 Fame if you have at least 2 clues.',
        points: 8,
        prerequisite: {
          type: 'clues',
          count: 2,
          label: 'Requires at least 2 Clues.',
        },
      }
    default:
      return undefined
  }
}

function buildSanctuaryCard(index: number): SanctuaryCard {
  const linkedBiome = index % 3 === 0 ? BIOMES[index % BIOMES.length] : undefined
  const resources = zeroResources()
  const focus = RESOURCES[index % RESOURCES.length]
  resources[focus] = index % 4 === 0 ? 2 : 1

  return {
    id: `sanctuary-${index + 1}`,
    cardType: 'sanctuary',
    title: sanctuaryTitles[index % sanctuaryTitles.length],
    subtitle: sanctuarySubtitles[index % sanctuarySubtitles.length],
    flavor: 'Cartographers leave these places with more certainty than they arrived with.',
    linkedBiome,
    clues: index % 5 === 0 ? 2 : index % 2 === 0 ? 1 : 0,
    bonusNight: index % 7 === 0 ? 1 : 0,
    resources,
    quest: buildSanctuaryQuest(index, linkedBiome),
    rarity: index % 9 === 0 ? 'rare' : 'common',
  }
}

export function buildRegionDeck(mode: MatchMode): RegionCard[] {
  const base = Array.from({ length: 68 }, (_, index) => buildRegionCard(index + 1))
  if (mode !== 'starfall') {
    return base
  }

  const meteors = Array.from({ length: 15 }, (_, index) => buildRegionCard(69 + index, true))
  return [...base, ...meteors]
}

export function buildSanctuaryDeck(): SanctuaryCard[] {
  return Array.from({ length: 45 }, (_, index) => buildSanctuaryCard(index))
}

export function createSeededRandom(seedInput: string) {
  let seed = 2166136261

  for (let index = 0; index < seedInput.length; index += 1) {
    seed ^= seedInput.charCodeAt(index)
    seed = Math.imul(seed, 16777619)
  }

  return () => {
    seed += 0x6d2b79f5
    let value = seed
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const clone = [...items]

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]]
  }

  return clone
}
