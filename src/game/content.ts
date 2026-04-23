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
  river: { label: 'Fluss', short: 'Fluss', accent: '#36f3ff' },
  city: { label: 'Stadt', short: 'Stadt', accent: '#ff8bff' },
  forest: { label: 'Wald', short: 'Wald', accent: '#8dff72' },
  desert: { label: 'Wüste', short: 'Wüste', accent: '#ffd85f' },
}

const resourceNames: Record<ResourceType, { label: string; accent: string; glyph: string }> = {
  uddu: { label: 'Uddu-Stein', accent: '#7bc6ff', glyph: 'UD' },
  okiko: { label: 'Okiko-Chimäre', accent: '#ff66cf', glyph: 'OK' },
  goldlog: { label: 'Taukronen-Distel', accent: '#75ff8a', glyph: 'TD' },
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
    detail: 'Der Grundmodus mit Rückwärtswertung, Heiligtümern und taktischem Marktdraft.',
  },
  advanced: {
    title: 'Erweiterter Auftakt',
    summary: 'Ziehe fünf Startregionen und behalte nur drei.',
    accent: '#ff4fd8',
    detail: 'Mehr Tiefe im Start, stärkere Synergien und präzisere Routenplanung.',
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
    summary: 'Ausgewogene KI, die Heiligtümer und sauberes Timing hoch bewertet.',
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
  'Himmelsheiligtum',
  'Echoherd',
  'Glaslaub-Klause',
  'Mondbrunnen-Heiligtum',
  'Laternenhohlraum',
  'Atlas-Schrein',
  'Stilles Observatorium',
  'Dämmerhorst',
  'Fernklang-Hafen',
  'Kristallarkade',
  'Nebelkuppel',
  'Sonnenarchiv',
  'Schattenaltar',
  'Myzeltempel',
  'Chrompagode',
  'Sternenbrücke',
  'Obsidianorakel',
  'Flüsterzisterne',
  'Neonmonolith',
  'Goldlicht-Kammer',
  'Tiefenreliquiar',
  'Morgenwacht',
  'Dämmergarten',
  'Auralith-Halle',
  'Kaskadenheiligtum',
  'Schwebeturm',
  'Runenatrium',
  'Wolkenklause',
  'Funkenschrein',
  'Saphirbecken',
  'Phantomdom',
  'Signalnest',
  'Jadekapelle',
  'Dünenoratorium',
  'Nachtquell',
  'Holo-Sanktuar',
  'Glasfarn-Hain',
  'Aurorapforte',
  'Silbermyzel',
  'Echokuppel',
  'Kometenaltar',
  'Lichtbrunnen',
  'Schleierwarte',
  'Tempel der Pfade',
  'Letztes Heiligtum',
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

function buildRegionTitle(serial: number, biome: Biome): { title: string; subtitle: string } {
  const adjective = adjectives[(serial * 3) % adjectives.length]
  const noun = biomeNouns[biome][serial % biomeNouns[biome].length]
  return {
    title: `${adjective} ${noun}`,
    subtitle: biomeNames[biome].label,
  }
}

function buildQuest(serial: number, biome: Biome): Quest {
  const p = serial % 9
  const adjacent = nextBiome(biome)
  const condition = serial % 4 === 0
    ? {
        type: 'resource' as const,
        resource: 'uddu' as const,
        count: 1,
        label: 'Benötigt mindestens 1 Uddu-Stein.',
      }
    : serial % 5 === 0
      ? {
          type: 'resource' as const,
          resource: 'okiko' as const,
          count: 1,
          label: 'Benötigt mindestens 1 Okiko-Chimäre.',
        }
      : serial % 7 === 0
        ? {
            type: 'resource' as const,
            resource: 'goldlog' as const,
            count: 1,
            label: 'Benötigt mindestens 1 Taukronen-Distel.',
          }
        : undefined

  switch (p) {
    case 0:
      return {
        type: 'per-resource',
        label: '1 Ruhm für jedes Hinweis-Symbol.',
        points: 1,
        resource: 'clue',
        prerequisite: condition,
      }
    case 1:
      return {
        type: 'per-resource',
        label: '2 Ruhm für jedes Uddu-Stein-Symbol.',
        points: 2,
        resource: 'uddu',
        prerequisite: condition,
      }
    case 2:
      return {
        type: 'per-resource',
        label: '4 Ruhm für jedes Okiko-Chimären-Symbol.',
        points: 4,
        resource: 'okiko',
        prerequisite: condition,
      }
    case 3:
      return {
        type: 'per-resource',
        label: '3 Ruhm für jedes Taukronen-Distel-Symbol.',
        points: 3,
        resource: 'goldlog',
        prerequisite: condition,
      }
    case 4:
      return {
        type: 'per-biome',
        label: `2 Ruhm für jede ${biomeNames[biome].short}- und ${biomeNames[adjacent].short}-Karte.`,
        points: 2,
        biomes: [biome, adjacent],
        prerequisite: condition,
      }
    case 5:
      return {
        type: 'per-biome',
        label: `4 Ruhm für jede ${biomeNames.forest.short}-Karte.`,
        points: 4,
        biomes: ['forest'],
        prerequisite: condition,
      }
    case 6:
      return {
        type: 'set',
        label: '10 Ruhm für jedes Set aus vier verschiedenen Landschaftsarten.',
        points: 10,
        prerequisite: condition,
      }
    case 7:
      return {
        type: 'per-night',
        label: '4 Ruhm für jede Nacht-Karte.',
        points: 4,
        prerequisite: condition,
      }
    default:
      return {
        type: 'flat',
        label: '19 Ruhm als festgelegter Wert.',
        points: 19,
        prerequisite: condition,
      }
  }
}

function buildResources(serial: number, biome: Biome, meteor: boolean): ResourceMap {
  void biome
  void meteor
  const resources = zeroResources()

  if (serial % 2 === 0) {
    resources.uddu += 1
  }
  if (serial % 5 === 0 || serial % 13 === 0) {
    resources.okiko += 1
  }
  if (serial % 11 === 0 || serial % 29 === 0) {
    resources.goldlog += 1
  }

  return resources
}

function buildRegionCard(serial: number): RegionCard {
  const biome = BIOMES[serial % BIOMES.length]
  const { title, subtitle } = buildRegionTitle(serial, biome)
  const time: TimeOfDay = serial % 3 === 0 ? 'night' : 'day'
  const clues = serial % 9 === 0 ? 2 : serial % 4 === 0 ? 1 : 0

  return {
    id: `region-${serial}`,
    cardType: 'region',
    serial,
    title,
    subtitle,
    flavor: 'Die Bewohner erinnern sich an jeden Pfad anders, als er ursprünglich begangen wurde.',
    biome,
    time,
    clues,
    resources: buildResources(serial, biome, false),
    quest: buildQuest(serial, biome),
    rarity: serial % 11 === 0 ? 'rare' : 'common',
    meteor: false,
  }
}

function buildSanctuaryQuest(index: number, linkedBiome?: Biome): Quest | undefined {
  const selector = index % 6
  switch (selector) {
    case 0:
      return {
        type: 'per-resource',
        label: '1 Ruhm für jedes Hinweis-Symbol.',
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
        type: 'per-resource',
        label: '3 Ruhm für jedes Taukronen-Distel-Symbol.',
        points: 3,
        resource: 'goldlog',
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
        label: '8 Ruhm, wenn du mindestens 2 Hinweise besitzt.',
        points: 8,
        prerequisite: {
          type: 'clues',
          count: 2,
          label: 'Benötigt mindestens 2 Hinweise.',
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
    title: sanctuaryTitles[index] ?? `Heiligtum ${index + 1}`,
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
  void mode
  return Array.from({ length: 68 }, (_, index) => buildRegionCard(index + 1))
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
