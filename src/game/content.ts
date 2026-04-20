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
  river: { label: 'Neonkanal', short: 'Kanal', accent: '#36f3ff' },
  city: { label: 'Versunkene Stadt', short: 'Stadt', accent: '#ff8bff' },
  forest: { label: 'Pilzwald', short: 'Wald', accent: '#8dff72' },
  desert: { label: 'Steinwüste', short: 'Wüste', accent: '#ffd85f' },
}

const resourceNames: Record<ResourceType, { label: string; accent: string; glyph: string }> = {
  uddu: { label: 'Uddu-Stein', accent: '#7bc6ff', glyph: 'UD' },
  okiko: { label: 'Okiko-Chimäre', accent: '#ff66cf', glyph: 'OK' },
  goldlog: { label: 'Goldlog-Distel', accent: '#ffe272', glyph: 'GL' },
}

export const biomeMeta = biomeNames
export const resourceMeta = resourceNames

export const modeMeta: Record<
  MatchMode,
  { title: string; summary: string; accent: string; detail: string }
> = {
  classic: {
    title: 'Klassische Expedition',
    summary: 'Der reine Acht-Runden-Lauf durch Alula.',
    accent: '#36f3ff',
    detail: 'Der Grundmodus mit Rückwärtswertung, Refugien und taktischem Marktdraft.',
  },
  advanced: {
    title: 'Erweiterter Auftakt',
    summary: 'Ziehe fünf Startregionen und behalte nur drei.',
    accent: '#ff4fd8',
    detail: 'Mehr Tiefe im Start, stärkere Synergien und präzisere Routenplanung.',
  },
  starfall: {
    title: 'Sternensturz',
    summary: 'Meteorregionen bleiben sichtbar und gleiche Endziffern glühen nach.',
    accent: '#ffe45e',
    detail: 'Ein Erweiterungsmodus mit Meteorkarten, Tempovorteilen und zusätzlichen Ziffernsynergien.',
  },
}

export const difficultyMeta: Record<
  Difficulty,
  { label: string; summary: string; volatility: number; precision: number }
> = {
  wanderer: {
    label: 'Wanderer',
    summary: 'Entspannte KI mit gröberen Fehlern und weicheren Tempolesungen.',
    volatility: 5,
    precision: 0.65,
  },
  pathfinder: {
    label: 'Pathfinder',
    summary: 'Ausgewogene KI, die Refugien und sauberes Timing hoch bewertet.',
    volatility: 3,
    precision: 0.82,
  },
  oracle: {
    label: 'Oracle',
    summary: 'Scharfer Draft, engere Reihenfolgen und stärkerer Endspiel-Fokus.',
    volatility: 1.5,
    precision: 0.94,
  },
}

const adjectives = [
  'Echo',
  'Neon',
  'Signal',
  'Schatten',
  'Glas',
  'Dämmer',
  'Obsidian',
  'Stern',
  'Flux',
  'Chrom',
  'Phantom',
  'Licht',
]

const biomeNouns: Record<Biome, string[]> = {
  river: ['Delta', 'Schleuse', 'Quelle', 'Kanal', 'Kaskade', 'Hafen', 'Furt', 'Woge'],
  city: ['Tresor', 'Arkade', 'Forum', 'Spire', 'Galerie', 'Korridor', 'Atrium', 'Bastion'],
  forest: ['Blüte', 'Dach', 'Hain', 'Moor', 'Lichtung', 'Hohlraum', 'Myzel', 'Sanktuum'],
  desert: ['Mesa', 'Mirage', 'Becken', 'Grat', 'Düne', 'Wiege', 'Plateau', 'Ödland'],
}

const sanctuaryTitles = [
  'Himmelsrefugium',
  'Echoherd',
  'Glaslaub-Rückzug',
  'Mondbrunnen-Klause',
  'Laternenhohlraum',
  'Atlas-Schrein',
  'Stilles Observatorium',
  'Dämmerhorst',
  'Fernklang-Hafen',
]

const sanctuarySubtitles = [
  'Versteckt zwischen wandernden Wildnissen',
  'Ein Ort, an dem alte Routen sichtbar bleiben',
  'Pilger ziehen mit klareren Karten weiter',
  'Selbst die Stille leuchtet hier heller',
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
        label: '2 Ruhm für jeden sichtbaren Uddu-Stein.',
        points: 2,
        resource: 'uddu',
      }
    case 1:
      return {
        type: 'per-resource',
        label: '3 Ruhm für jede sichtbare Okiko-Chimäre.',
        points: 3,
        resource: 'okiko',
      }
    case 2:
      return {
        type: 'per-resource',
        label: '4 Ruhm für jede sichtbare Goldlog-Distel.',
        points: 4,
        resource: 'goldlog',
      }
    case 3:
      return {
        type: 'per-biome',
        label: `4 Ruhm für jede ${biomeNames[biome].short}-Karte.`,
        points: 4,
        biomes: [biome],
      }
    case 4:
      return {
        type: 'per-biome',
        label: `2 Ruhm für jede ${biomeNames[biome].short}- und ${biomeNames[adjacent].short}-Karte.`,
        points: 2,
        biomes: [biome, adjacent],
        prerequisite: {
          type: 'resource',
          resource: 'uddu',
          count: 1,
          label: 'Benötigt mindestens 1 Uddu-Stein.',
        },
      }
    case 5:
      return {
        type: 'set',
        label: '10 Ruhm für jedes Set aus 4 verschiedenen Biomen.',
        points: 10,
      }
    case 6:
      return {
        type: 'per-night',
        label: '4 Ruhm für jede Nachtkarte.',
        points: 4,
        prerequisite: {
          type: 'clues',
          count: 2,
          label: 'Benötigt mindestens 2 Spuren.',
        },
      }
    case 7:
      return {
        type: 'flat',
        label: '12 Ruhm, wenn du von jedem Wunder mindestens eins besitzt.',
        points: 12,
        prerequisite: {
          type: 'resources',
          resources: [
            { resource: 'uddu', count: 1 },
            { resource: 'okiko', count: 1 },
            { resource: 'goldlog', count: 1 },
          ],
          label: 'Benötigt 1 Uddu, 1 Okiko und 1 Goldlog.',
        },
      }
    case 8:
      return {
        type: 'per-biome',
        label: `3 Ruhm für jede ${biomeNames[opposite].short}-Karte.`,
        points: 3,
        biomes: [opposite],
        prerequisite: {
          type: 'night',
          count: 2,
          label: 'Benötigt mindestens 2 Nachtkarten.',
        },
      }
    case 9:
      return {
        type: 'per-sanctuary',
        label: '5 Ruhm für jedes Refugium.',
        points: 5,
        prerequisite: {
          type: 'resource',
          resource: 'goldlog',
          count: 1,
          label: 'Benötigt mindestens 1 Goldlog-Distel.',
        },
      }
    case 10:
      return {
        type: 'per-digit-match',
        label: '3 Ruhm für jede sichtbare Region mit derselben Endziffer.',
        points: meteor ? 4 : 3,
        prerequisite: {
          type: 'clues',
          count: 1,
          label: 'Benötigt mindestens 1 Spur.',
        },
      }
    default:
      return {
        type: 'flat',
        label: '14 Ruhm, wenn du mindestens 2 Refugien besitzt.',
        points: meteor ? 16 : 14,
        prerequisite: {
          type: 'sanctuary',
          count: 2,
          label: 'Benötigt mindestens 2 Refugien.',
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
      ? 'Ein Meteor reißt den Himmel auf und lässt verborgene Routen elektrisch nachglühen.'
      : 'Die Bewohner erinnern sich an jeden Pfad anders, als er ursprünglich begangen wurde.',
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
        label: '1 Ruhm für jede sichtbare Spur.',
        points: 1,
        resource: 'clue',
      }
    case 1:
      return {
        type: 'per-night',
        label: '3 Ruhm für jede Nachtkarte.',
        points: 3,
      }
    case 2:
      return {
        type: 'per-sanctuary',
        label: '4 Ruhm für jedes Refugium.',
        points: 4,
      }
    case 3:
      if (!linkedBiome) {
        return undefined
      }
      return {
        type: 'per-biome',
        label: `2 Ruhm für jede ${biomeNames[linkedBiome].short}-Karte.`,
        points: 2,
        biomes: [linkedBiome],
      }
    case 4:
      return {
        type: 'flat',
        label: '8 Ruhm, wenn du mindestens 2 Spuren besitzt.',
        points: 8,
        prerequisite: {
          type: 'clues',
          count: 2,
          label: 'Benötigt mindestens 2 Spuren.',
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
    flavor: 'Kartografen verlassen diese Orte mit mehr Gewissheit, als sie mitgebracht haben.',
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
