export type Biome = 'river' | 'city' | 'forest' | 'desert'

export type ResourceType = 'uddu' | 'okiko' | 'goldlog'

export type CounterType = ResourceType | 'clue'

export type TimeOfDay = 'day' | 'night'

export type Difficulty = 'wanderer' | 'pathfinder' | 'oracle'

export type MatchMode = 'classic' | 'advanced' | 'starfall'

export type CardRarity = 'common' | 'rare' | 'mythic'

export type Prerequisite =
  | {
      type: 'resource'
      resource: ResourceType
      count: number
      label: string
    }
  | {
      type: 'resources'
      resources: Array<{ resource: ResourceType; count: number }>
      label: string
    }
  | {
      type: 'clues'
      count: number
      label: string
    }
  | {
      type: 'night'
      count: number
      label: string
    }
  | {
      type: 'biome'
      biome: Biome
      count: number
      label: string
    }
  | {
      type: 'sanctuary'
      count: number
      label: string
    }

export type Quest =
  | {
      type: 'per-resource'
      label: string
      points: number
      resource: CounterType
      prerequisite?: Prerequisite
    }
  | {
      type: 'per-biome'
      label: string
      points: number
      biomes: Biome[]
      prerequisite?: Prerequisite
    }
  | {
      type: 'set'
      label: string
      points: number
      prerequisite?: Prerequisite
    }
  | {
      type: 'per-night'
      label: string
      points: number
      prerequisite?: Prerequisite
    }
  | {
      type: 'per-sanctuary'
      label: string
      points: number
      prerequisite?: Prerequisite
    }
  | {
      type: 'per-digit-match'
      label: string
      points: number
      prerequisite?: Prerequisite
    }
  | {
      type: 'flat'
      label: string
      points: number
      prerequisite?: Prerequisite
    }

export type ResourceMap = Record<ResourceType, number>

export interface RegionCard {
  id: string
  cardType: 'region'
  serial: number
  title: string
  subtitle: string
  flavor: string
  biome: Biome
  duration: number
  time: TimeOfDay
  clues: number
  resources: ResourceMap
  quest: Quest
  rarity: CardRarity
  meteor: boolean
}

export interface SanctuaryCard {
  id: string
  cardType: 'sanctuary'
  title: string
  subtitle: string
  flavor: string
  linkedBiome?: Biome
  clues: number
  bonusNight: number
  resources: ResourceMap
  quest?: Quest
  rarity: CardRarity
}

export type PlayCard = RegionCard | SanctuaryCard

export interface PlayerState {
  id: string
  name: string
  kind: 'human' | 'ai'
  difficulty: Difficulty
  hand: RegionCard[]
  tableau: RegionCard[]
  sanctuaries: SanctuaryCard[]
  pendingSanctuaries: SanctuaryCard[]
  scorePreview: number
}

export interface DraftSelection {
  regionId?: string
  sanctuaryId?: string
}

export type Phase =
  | 'menu'
  | 'opening-hand'
  | 'choose-region'
  | 'reveal'
  | 'draft'
  | 'scoring'
  | 'finished'

export interface RevealEntry {
  playerId: string
  card: RegionCard
  foundSanctuary: boolean
  sanctuaryCount: number
}

export interface ScoreEntry {
  sourceId: string
  sourceName: string
  sourceType: 'region' | 'sanctuary'
  points: number
  reason: string
  satisfied: boolean
}

export interface FinalStanding {
  playerId: string
  playerName: string
  total: number
  tieBreaker: number
  entries: ScoreEntry[]
}

export interface MatchConfig {
  mode: MatchMode
  playerName: string
  humanCount: number
  aiCount: number
  difficulty: Difficulty
  seed: string
}

export interface MatchState {
  phase: Exclude<Phase, 'menu'>
  config: MatchConfig
  seedLabel: string
  round: number
  maxRounds: number
  players: PlayerState[]
  regionDeck: RegionCard[]
  sanctuaryDeck: SanctuaryCard[]
  market: RegionCard[]
  discardedRegions: RegionCard[]
  discardedSanctuaries: SanctuaryCard[]
  log: string[]
  revealEntries: RevealEntry[]
  draftOrder: string[]
  draftIndex: number
  activeHumanPlayerId?: string
  selectedRegionId?: string
  selectedRegionByPlayerId: Record<string, string>
  openingSelectionIds: string[]
  openingSelectionsByPlayerId: Record<string, string[]>
  openingReady: boolean
  activeDigitEchoes: number[]
  humanDraftSelection: DraftSelection
  finalStandings: FinalStanding[]
}

export interface PersistedProfile {
  playerName: string
  preferredMode: MatchMode
  preferredDifficulty: Difficulty
  preferredHumanCount: number
  preferredTotalPlayers: number
  preferredAiCount: number
  preferredSeed: string
  lastBestScore: number
  lastWinner: string
}

export interface ScoreContext {
  resources: ResourceMap
  clues: number
  nightCount: number
  sanctuaryCount: number
  biomeCounts: Record<Biome, number>
  visibleRegionDigits: Record<number, number>
}
