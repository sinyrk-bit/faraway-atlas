import { buildRegionDeck, buildSanctuaryDeck, createSeededRandom, difficultyMeta, shuffle } from './content'
import type {
  Biome,
  Difficulty,
  DraftSelection,
  FinalStanding,
  MatchConfig,
  MatchState,
  PlayerState,
  Prerequisite,
  Quest,
  RegionCard,
  ResourceMap,
  ResourceType,
  SanctuaryCard,
  ScoreContext,
  ScoreEntry,
} from './types'

export const HUMAN_PLAYER_ID = 'player-0'
export const PROFILE_KEY = 'faraway-atlas-profile'

const AI_NAMES = ['Lyra Vale', 'Oren Flint', 'Mira Sol', 'Khepri Moss', 'Sable Rune', 'Tarin Voss']

function zeroResources(): ResourceMap {
  return {
    uddu: 0,
    okiko: 0,
    goldlog: 0,
  }
}

function clonePlayer(player: PlayerState): PlayerState {
  return {
    ...player,
    hand: [...player.hand],
    tableau: [...player.tableau],
    sanctuaries: [...player.sanctuaries],
    pendingSanctuaries: [...player.pendingSanctuaries],
  }
}

function cloneState(state: MatchState): MatchState {
  return {
    ...state,
    players: state.players.map(clonePlayer),
    regionDeck: [...state.regionDeck],
    sanctuaryDeck: [...state.sanctuaryDeck],
    market: [...state.market],
    discardedRegions: [...state.discardedRegions],
    discardedSanctuaries: [...state.discardedSanctuaries],
    log: [...state.log],
    revealEntries: [...state.revealEntries],
    draftOrder: [...state.draftOrder],
    openingSelectionIds: [...state.openingSelectionIds],
    activeDigitEchoes: [...state.activeDigitEchoes],
    humanDraftSelection: { ...state.humanDraftSelection },
    finalStandings: state.finalStandings.map((standing) => ({
      ...standing,
      entries: [...standing.entries],
    })),
  }
}

function playerSeed(config: MatchConfig, extra = '') {
  return `${config.mode}:${config.seed}:${config.aiCount}:${config.difficulty}:${extra}`
}

function takeTop<T>(deck: T[], count: number): [T[], T[]] {
  const drawn = deck.slice(0, count)
  const rest = deck.slice(count)
  return [drawn, rest]
}

function updateLog(state: MatchState, line: string): MatchState {
  return {
    ...state,
    log: [line, ...state.log].slice(0, 14),
  }
}

function getPlayerIndex(players: PlayerState[], playerId: string) {
  return players.findIndex((player) => player.id === playerId)
}

function totalClues(player: PlayerState) {
  return (
    player.tableau.reduce((sum, card) => sum + card.clues, 0) +
    player.sanctuaries.reduce((sum, card) => sum + card.clues, 0)
  )
}

function buildScoreContext(visibleRegions: RegionCard[], sanctuaries: SanctuaryCard[]): ScoreContext {
  const resources = zeroResources()
  const biomeCounts: Record<Biome, number> = {
    river: 0,
    city: 0,
    forest: 0,
    desert: 0,
  }
  const visibleRegionDigits: Record<number, number> = {}
  let clues = 0
  let nightCount = 0

  visibleRegions.forEach((card) => {
    resources.uddu += card.resources.uddu
    resources.okiko += card.resources.okiko
    resources.goldlog += card.resources.goldlog
    biomeCounts[card.biome] += 1
    clues += card.clues
    if (card.time === 'night') {
      nightCount += 1
    }
    const digit = card.serial % 10
    visibleRegionDigits[digit] = (visibleRegionDigits[digit] ?? 0) + 1
  })

  sanctuaries.forEach((card) => {
    resources.uddu += card.resources.uddu
    resources.okiko += card.resources.okiko
    resources.goldlog += card.resources.goldlog
    if (card.linkedBiome) {
      biomeCounts[card.linkedBiome] += 1
    }
    clues += card.clues
    nightCount += card.bonusNight
  })

  return {
    resources,
    clues,
    nightCount,
    sanctuaryCount: sanctuaries.length,
    biomeCounts,
    visibleRegionDigits,
  }
}

function prerequisiteSatisfied(prerequisite: Prerequisite | undefined, context: ScoreContext) {
  if (!prerequisite) {
    return true
  }

  switch (prerequisite.type) {
    case 'resource':
      return context.resources[prerequisite.resource] >= prerequisite.count
    case 'resources':
      return prerequisite.resources.every(
        ({ resource, count }) => context.resources[resource] >= count,
      )
    case 'clues':
      return context.clues >= prerequisite.count
    case 'night':
      return context.nightCount >= prerequisite.count
    case 'biome':
      return context.biomeCounts[prerequisite.biome] >= prerequisite.count
    case 'sanctuary':
      return context.sanctuaryCount >= prerequisite.count
    default:
      return true
  }
}

function scoreQuest(quest: Quest | undefined, context: ScoreContext, serial: number) {
  if (!quest) {
    return {
      points: 0,
      reason: 'No scoring text.',
      satisfied: true,
    }
  }

  const satisfied = prerequisiteSatisfied(quest.prerequisite, context)
  if (!satisfied) {
    return {
      points: 0,
      reason: quest.prerequisite?.label ?? 'Prerequisite not met.',
      satisfied: false,
    }
  }

  switch (quest.type) {
    case 'per-resource': {
      const count =
        quest.resource === 'clue' ? context.clues : context.resources[quest.resource as ResourceType]
      return {
        points: count * quest.points,
        reason: `${quest.label} ${count} counted.`,
        satisfied: true,
      }
    }
    case 'per-biome': {
      const count = quest.biomes.reduce((sum, biome) => sum + context.biomeCounts[biome], 0)
      return {
        points: count * quest.points,
        reason: `${quest.label} ${count} counted.`,
        satisfied: true,
      }
    }
    case 'set': {
      const completeSets = Math.min(
        context.biomeCounts.river,
        context.biomeCounts.city,
        context.biomeCounts.forest,
        context.biomeCounts.desert,
      )
      return {
        points: completeSets * quest.points,
        reason: `${quest.label} ${completeSets} set${completeSets === 1 ? '' : 's'} completed.`,
        satisfied: true,
      }
    }
    case 'per-night':
      return {
        points: context.nightCount * quest.points,
        reason: `${quest.label} ${context.nightCount} counted.`,
        satisfied: true,
      }
    case 'per-sanctuary':
      return {
        points: context.sanctuaryCount * quest.points,
        reason: `${quest.label} ${context.sanctuaryCount} counted.`,
        satisfied: true,
      }
    case 'per-digit-match': {
      const digit = serial % 10
      const count = context.visibleRegionDigits[digit] ?? 0
      return {
        points: count * quest.points,
        reason: `${quest.label} ${count} matching region${count === 1 ? '' : 's'}.`,
        satisfied: true,
      }
    }
    case 'flat':
      return {
        points: quest.points,
        reason: quest.label,
        satisfied: true,
      }
    default:
      return {
        points: 0,
        reason: 'No scoring text.',
        satisfied: true,
      }
  }
}

function playerVisibleEchoDigits(player: PlayerState, starfall: boolean) {
  if (!starfall) {
    return []
  }

  const digits = player.tableau.filter((card) => card.meteor).map((card) => card.serial % 10)
  return Array.from(new Set(digits))
}

export function scorePlayer(player: PlayerState, starfall: boolean) {
  const visible = new Set<string>()
  const echoDigits = playerVisibleEchoDigits(player, starfall)

  if (starfall) {
    player.tableau.forEach((card) => {
      if (card.meteor || echoDigits.includes(card.serial % 10)) {
        visible.add(card.id)
      }
    })
  }

  const entries: ScoreEntry[] = []

  for (let index = player.tableau.length - 1; index >= 0; index -= 1) {
    const card = player.tableau[index]
    visible.add(card.id)
    const visibleRegions = player.tableau.filter((region) => visible.has(region.id))
    const result = scoreQuest(card.quest, buildScoreContext(visibleRegions, player.sanctuaries), card.serial)
    entries.push({
      sourceId: card.id,
      sourceName: card.title,
      sourceType: 'region',
      points: result.points,
      reason: result.reason,
      satisfied: result.satisfied,
    })
  }

  const fullContext = buildScoreContext(player.tableau, player.sanctuaries)
  player.sanctuaries.forEach((card) => {
    const result = scoreQuest(card.quest, fullContext, 1000 + entries.length)
    if (!card.quest) {
      return
    }
    entries.push({
      sourceId: card.id,
      sourceName: card.title,
      sourceType: 'sanctuary',
      points: result.points,
      reason: result.reason,
      satisfied: result.satisfied,
    })
  })

  const total = entries.reduce((sum, entry) => sum + entry.points, 0)
  const tieBreaker = Math.min(...player.tableau.map((card) => card.duration))

  return {
    total,
    tieBreaker,
    entries,
  }
}

function updateScorePreviews(state: MatchState): MatchState {
  const starfall = state.config.mode === 'starfall'
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      scorePreview: scorePlayer(player, starfall).total,
    })),
  }
}

function evaluateRegionValue(
  player: PlayerState,
  card: RegionCard,
  mode: MatchConfig['mode'],
  round: number,
  maxRounds: number,
) {
  const currentTableau = [...player.tableau, card]
  const currentContext = buildScoreContext(currentTableau, player.sanctuaries)
  const base = scoreQuest(card.quest, currentContext, card.serial).points
  const previous = player.tableau.at(-1)
  const sanctuaryBoost =
    previous && card.duration + (mode === 'starfall' && card.meteor ? 1 : 0) > previous.duration ? 6 : 0
  const clueBoost = card.clues * 1.4
  const resourceBoost = card.resources.uddu * 1.2 + card.resources.okiko * 1.8 + card.resources.goldlog * 2.2
  const tempoBoost = round < maxRounds ? Math.max(0, 9 - card.duration) * 0.55 : 0
  const meteorBoost = mode === 'starfall' && card.meteor ? 4.5 : 0
  const nightBoost = card.time === 'night' ? 0.8 : 0

  return base + sanctuaryBoost + clueBoost + resourceBoost + tempoBoost + meteorBoost + nightBoost
}

function evaluateSanctuaryValue(player: PlayerState, card: SanctuaryCard, mode: MatchConfig['mode']) {
  const baseQuest = scoreQuest(
    card.quest,
    buildScoreContext(player.tableau, [...player.sanctuaries, card]),
    800 + player.sanctuaries.length,
  ).points
  const clueBoost = card.clues * 1.6
  const resourceBoost = card.resources.uddu * 1.4 + card.resources.okiko * 2.0 + card.resources.goldlog * 2.5
  const biomeBoost = card.linkedBiome ? 2.1 : 0
  const nightBoost = card.bonusNight * 2
  const starfallBoost = mode === 'starfall' && card.bonusNight > 0 ? 1 : 0

  return baseQuest + clueBoost + resourceBoost + biomeBoost + nightBoost + starfallBoost
}

function chooseBestIndex(values: number[], difficulty: Difficulty, random: () => number) {
  const precision = difficultyMeta[difficulty].precision
  const volatility = difficultyMeta[difficulty].volatility

  const scored = values.map((value, index) => ({
    index,
    score: value * precision + random() * volatility,
  }))

  scored.sort((left, right) => right.score - left.score)
  return scored[0]?.index ?? 0
}

function aiChooseOpeningHand(cards: RegionCard[], difficulty: Difficulty, state: MatchState) {
  const random = createSeededRandom(playerSeed(state.config, `opening-${difficulty}-${cards.map((card) => card.id).join('-')}`))
  const values = cards.map((card) =>
    evaluateRegionValue(
      {
        id: 'ai-opening',
        name: 'AI',
        kind: 'ai',
        difficulty,
        hand: [],
        tableau: [],
        sanctuaries: [],
        pendingSanctuaries: [],
        scorePreview: 0,
      },
      card,
      state.config.mode,
      1,
      state.maxRounds,
    ),
  )

  return cards
    .map((card, index) => ({ card, index, value: values[index] + random() * 0.25 }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 3)
    .map(({ card }) => card.id)
}

function aiChooseRegionToPlay(player: PlayerState, state: MatchState) {
  const random = createSeededRandom(
    playerSeed(state.config, `${player.id}:play:${state.round}:${player.hand.map((card) => card.id).join('-')}`),
  )
  const values = player.hand.map((card) =>
    evaluateRegionValue(player, card, state.config.mode, state.round, state.maxRounds),
  )
  const choiceIndex = chooseBestIndex(values, player.difficulty, random)
  return player.hand[choiceIndex]?.id
}

function aiChooseDraftRegion(player: PlayerState, state: MatchState) {
  if (state.market.length === 0 || state.round >= state.maxRounds) {
    return undefined
  }

  const random = createSeededRandom(
    playerSeed(state.config, `${player.id}:draft:${state.round}:${state.market.map((card) => card.id).join('-')}`),
  )
  const values = state.market.map((card) =>
    evaluateRegionValue(player, card, state.config.mode, state.round + 1, state.maxRounds),
  )
  const choiceIndex = chooseBestIndex(values, player.difficulty, random)
  return state.market[choiceIndex]?.id
}

function aiChooseSanctuary(player: PlayerState, state: MatchState) {
  if (player.pendingSanctuaries.length === 0) {
    return undefined
  }

  const random = createSeededRandom(
    playerSeed(
      state.config,
      `${player.id}:sanctuary:${state.round}:${player.pendingSanctuaries.map((card) => card.id).join('-')}`,
    ),
  )
  const values = player.pendingSanctuaries.map((card) => evaluateSanctuaryValue(player, card, state.config.mode))
  const choiceIndex = chooseBestIndex(values, player.difficulty, random)
  return player.pendingSanctuaries[choiceIndex]?.id
}

function effectiveDraftMetric(card: RegionCard, starfall: boolean) {
  return card.duration + (starfall && card.meteor ? -0.25 : 0)
}

function shouldFindSanctuary(player: PlayerState, playedCard: RegionCard, mode: MatchConfig['mode']) {
  const previous = player.tableau.at(-2)
  if (!previous) {
    return false
  }

  return playedCard.duration + (mode === 'starfall' && playedCard.meteor ? 1 : 0) > previous.duration
}

function draftSanctuaries(
  sanctuaryDeck: SanctuaryCard[],
  count: number,
): { drawn: SanctuaryCard[]; deck: SanctuaryCard[] } {
  const [drawn, deck] = takeTop(sanctuaryDeck, Math.min(count, sanctuaryDeck.length))
  return { drawn, deck }
}

function maybeRefillMarket(state: MatchState) {
  if (state.round >= state.maxRounds) {
    return state
  }

  const leftover = [...state.market]
  let regionDeck = state.regionDeck
  const [market, nextDeck] = takeTop(regionDeck, state.players.length + 1)
  regionDeck = nextDeck

  return {
    ...state,
    market,
    regionDeck,
    discardedRegions: [...state.discardedRegions, ...leftover],
  }
}

function closeRound(state: MatchState): MatchState {
  let nextState = cloneState(state)

  if (nextState.round >= nextState.maxRounds) {
    const finalStandings = nextState.players
      .map((player) => {
        const result = scorePlayer(player, nextState.config.mode === 'starfall')
        return {
          playerId: player.id,
          playerName: player.name,
          total: result.total,
          tieBreaker: result.tieBreaker,
          entries: result.entries,
        }
      })
      .sort((left, right) => {
        if (right.total !== left.total) {
          return right.total - left.total
        }
        return left.tieBreaker - right.tieBreaker
      })

    nextState = {
      ...nextState,
      phase: 'finished',
      finalStandings,
      revealEntries: [],
      draftOrder: [],
      draftIndex: 0,
      humanDraftSelection: {},
    }

    const winner = finalStandings[0]
    return updateLog(nextState, `${winner.playerName} wins with ${winner.total} Fame.`)
  }

  nextState = maybeRefillMarket(nextState)
  nextState.round += 1
  nextState.phase = 'choose-region'
  nextState.selectedRegionId = undefined
  nextState.revealEntries = []
  nextState.draftOrder = []
  nextState.draftIndex = 0
  nextState.humanDraftSelection = {}
  nextState.activeDigitEchoes = []

  return updateLog(updateScorePreviews(nextState), `Round ${nextState.round} begins. Choose your next route.`)
}

function applyDraftDecision(state: MatchState, playerId: string, selection: DraftSelection) {
  const nextState = cloneState(state)
  const playerIndex = getPlayerIndex(nextState.players, playerId)
  const player = nextState.players[playerIndex]

  if (selection.regionId) {
    const marketIndex = nextState.market.findIndex((card) => card.id === selection.regionId)
    if (marketIndex >= 0) {
      const [picked] = nextState.market.splice(marketIndex, 1)
      player.hand.push(picked)
    }
  }

  if (player.pendingSanctuaries.length > 0) {
    const choice = selection.sanctuaryId
      ? player.pendingSanctuaries.find((card) => card.id === selection.sanctuaryId)
      : undefined
    if (choice) {
      player.sanctuaries.push(choice)
    }
    const rejected = player.pendingSanctuaries.filter((card) => card.id !== choice?.id)
    nextState.discardedSanctuaries.push(...rejected)
    player.pendingSanctuaries = []
  }

  nextState.draftIndex += 1
  nextState.humanDraftSelection = {}

  const pickedRegion = selection.regionId
    ? nextState.players[playerIndex].hand.find((card) => card.id === selection.regionId)
    : undefined
  const pickedSanctuary = selection.sanctuaryId
    ? nextState.players[playerIndex].sanctuaries.find((card) => card.id === selection.sanctuaryId)
    : undefined

  let loggedState = nextState
  if (pickedRegion || pickedSanctuary) {
    const fragments = [
      pickedRegion ? `drafted ${pickedRegion.title}` : undefined,
      pickedSanctuary ? `claimed ${pickedSanctuary.title}` : undefined,
    ].filter(Boolean)
    loggedState = updateLog(nextState, `${player.name} ${fragments.join(' and ')}.`)
  }

  if (loggedState.draftIndex >= loggedState.draftOrder.length) {
    return closeRound(loggedState)
  }

  return updateScorePreviews(loggedState)
}

function createPlayers(config: MatchConfig): PlayerState[] {
  return [
    {
      id: HUMAN_PLAYER_ID,
      name: config.playerName.trim() || 'Explorer',
      kind: 'human',
      difficulty: 'oracle',
      hand: [],
      tableau: [],
      sanctuaries: [],
      pendingSanctuaries: [],
      scorePreview: 0,
    },
    ...Array.from({ length: config.aiCount }, (_, index) => ({
      id: `player-${index + 1}`,
      name: AI_NAMES[index],
      kind: 'ai' as const,
      difficulty: config.difficulty,
      hand: [],
      tableau: [],
      sanctuaries: [],
      pendingSanctuaries: [],
      scorePreview: 0,
    })),
  ]
}

function startClassicDeal(state: MatchState) {
  let regionDeck = [...state.regionDeck]
  const players = state.players.map((player) => {
    const [hand, rest] = takeTop(regionDeck, 3)
    regionDeck = rest
    return {
      ...player,
      hand,
    }
  })

  const [market, rest] = takeTop(regionDeck, players.length + 1)
  return updateScorePreviews({
    ...state,
    phase: 'choose-region',
    players,
    regionDeck: rest,
    market,
  })
}

function startAdvancedDeal(state: MatchState) {
  let regionDeck = [...state.regionDeck]
  const players = state.players.map((player) => {
    const [hand, rest] = takeTop(regionDeck, 5)
    regionDeck = rest
    return {
      ...player,
      hand,
    }
  })

  return updateScorePreviews({
    ...state,
    phase: 'opening-hand',
    players,
    regionDeck,
  })
}

export function createMatch(config: MatchConfig): MatchState {
  const random = createSeededRandom(playerSeed(config, 'bootstrap'))
  const baseState: MatchState = {
    phase: 'choose-region',
    config,
    seedLabel: config.seed,
    round: 1,
    maxRounds: 8,
    players: createPlayers(config),
    regionDeck: shuffle(buildRegionDeck(config.mode), random),
    sanctuaryDeck: shuffle(buildSanctuaryDeck(), random),
    market: [],
    discardedRegions: [],
    discardedSanctuaries: [],
    log: [],
    revealEntries: [],
    draftOrder: [],
    draftIndex: 0,
    selectedRegionId: undefined,
    openingSelectionIds: [],
    openingReady: false,
    activeDigitEchoes: [],
    humanDraftSelection: {},
    finalStandings: [],
  }

  const dealt =
    config.mode === 'advanced' ? startAdvancedDeal(baseState) : startClassicDeal(baseState)

  return updateLog(
    dealt,
    config.mode === 'advanced'
      ? 'Choose three opening regions from the five offered to you.'
      : 'The expedition begins. Choose your first region.',
  )
}

export function selectOpeningRegion(state: MatchState, cardId: string) {
  const next = cloneState(state)
  const selected = new Set(next.openingSelectionIds)

  if (selected.has(cardId)) {
    selected.delete(cardId)
  } else if (selected.size < 3) {
    selected.add(cardId)
  }

  next.openingSelectionIds = Array.from(selected)
  next.openingReady = next.openingSelectionIds.length === 3
  return next
}

export function confirmOpeningSelection(state: MatchState) {
  if (state.openingSelectionIds.length !== 3) {
    return state
  }

  const next = cloneState(state)
  let regionDeck = [...next.regionDeck]
  const returned: RegionCard[] = []

  next.players = next.players.map((player) => {
    const keepIds =
      player.kind === 'human'
        ? next.openingSelectionIds
        : aiChooseOpeningHand(player.hand, player.difficulty, next)
    const keep = player.hand.filter((card) => keepIds.includes(card.id))
    const reject = player.hand.filter((card) => !keepIds.includes(card.id))
    returned.push(...reject)
    return {
      ...player,
      hand: keep,
    }
  })

  const random = createSeededRandom(playerSeed(next.config, 'advanced-reseed'))
  regionDeck = shuffle([...regionDeck, ...returned], random)
  const [market, rest] = takeTop(regionDeck, next.players.length + 1)

  return updateLog(
    updateScorePreviews({
      ...next,
      phase: 'choose-region',
      regionDeck: rest,
      market,
      openingSelectionIds: [],
      openingReady: false,
    }),
    'Opening routes locked. The market is live.',
  )
}

export function selectRegionToPlay(state: MatchState, cardId: string): MatchState {
  return {
    ...state,
    selectedRegionId: cardId,
  }
}

export function beginDraftPhase(state: MatchState): MatchState {
  return {
    ...state,
    phase: 'draft',
  }
}

export function confirmReveal(state: MatchState) {
  if (!state.selectedRegionId) {
    return state
  }

  const next = cloneState(state)
  const reveals: Array<{ playerId: string; card: RegionCard }> = []

  next.players.forEach((player) => {
    const chosenId =
      player.kind === 'human' ? next.selectedRegionId : aiChooseRegionToPlay(player, next)
    const handIndex = player.hand.findIndex((card) => card.id === chosenId)
    const [played] = player.hand.splice(handIndex, 1)
    reveals.push({ playerId: player.id, card: played })
    player.tableau.push(played)
  })

  reveals.forEach(({ playerId, card }) => {
    const playerIndex = getPlayerIndex(next.players, playerId)
    const player = next.players[playerIndex]
    const foundSanctuary = shouldFindSanctuary(player, card, next.config.mode)
    let sanctuaryCount = 0

    if (foundSanctuary) {
      sanctuaryCount = 1 + totalClues(player)
      const drawn = draftSanctuaries(next.sanctuaryDeck, sanctuaryCount)
      next.sanctuaryDeck = drawn.deck
      player.pendingSanctuaries = drawn.drawn
      sanctuaryCount = drawn.drawn.length
    } else {
      player.pendingSanctuaries = []
    }

    next.revealEntries.push({
      playerId,
      card,
      foundSanctuary,
      sanctuaryCount,
    })
  })

  next.draftOrder = [...next.revealEntries]
    .sort((left, right) => {
      const durationDelta =
        effectiveDraftMetric(left.card, next.config.mode === 'starfall') -
        effectiveDraftMetric(right.card, next.config.mode === 'starfall')
      if (durationDelta !== 0) {
        return durationDelta
      }
      return left.card.serial - right.card.serial
    })
    .map((entry) => entry.playerId)

  next.draftIndex = 0
  next.humanDraftSelection = {}
  next.phase = 'reveal'
  next.activeDigitEchoes = Array.from(
    new Set(next.players.flatMap((player) => player.tableau.filter((card) => card.meteor).map((card) => card.serial % 10))),
  )

  let loggedState = updateLog(next, `Round ${next.round} resolves. Draft order has been set.`)
  next.revealEntries.forEach((entry) => {
    const player = next.players[getPlayerIndex(next.players, entry.playerId)]
    loggedState = updateLog(
      loggedState,
      entry.foundSanctuary
        ? `${player.name} explored ${entry.card.title} and found ${entry.sanctuaryCount} Sanctuary option${entry.sanctuaryCount === 1 ? '' : 's'}.`
        : `${player.name} explored ${entry.card.title}.`,
    )
  })

  return updateScorePreviews(loggedState)
}

export function setHumanDraftSelection(state: MatchState, selection: DraftSelection): MatchState {
  return {
    ...state,
    humanDraftSelection: selection,
  }
}

export function confirmHumanDraft(state: MatchState) {
  const activePlayerId = state.draftOrder[state.draftIndex]
  if (activePlayerId !== HUMAN_PLAYER_ID) {
    return state
  }

  const human = state.players[getPlayerIndex(state.players, HUMAN_PLAYER_ID)]
  const needsRegion = state.round < state.maxRounds && state.market.length > 0
  const needsSanctuary = human.pendingSanctuaries.length > 0
  const { regionId, sanctuaryId } = state.humanDraftSelection

  if (needsRegion && !regionId) {
    return state
  }

  if (needsSanctuary && !sanctuaryId) {
    return state
  }

  return applyDraftDecision(state, HUMAN_PLAYER_ID, { regionId, sanctuaryId })
}

export function runNextAiDraft(state: MatchState) {
  const activePlayerId = state.draftOrder[state.draftIndex]
  const player = state.players[getPlayerIndex(state.players, activePlayerId)]

  if (!player || player.kind !== 'ai') {
    return state
  }

  return applyDraftDecision(state, activePlayerId, {
    regionId: aiChooseDraftRegion(player, state),
    sanctuaryId: aiChooseSanctuary(player, state),
  })
}

export function getCurrentPlayer(state: MatchState) {
  const playerId = state.draftOrder[state.draftIndex]
  return state.players.find((player) => player.id === playerId)
}

export function getHumanPlayer(state: MatchState) {
  return state.players.find((player) => player.id === HUMAN_PLAYER_ID)
}

export function defaultProfile() {
  return {
    playerName: 'Sinmy',
    preferredMode: 'classic' as const,
    preferredDifficulty: 'pathfinder' as const,
    preferredAiCount: 2,
    preferredSeed: '',
    lastBestScore: 0,
    lastWinner: '',
  }
}

export function buildFinalStandings(state: MatchState): FinalStanding[] {
  return state.finalStandings
}

export function humanDraftCanConfirm(state: MatchState) {
  const human = getHumanPlayer(state)
  if (!human) {
    return false
  }

  const needsRegion = state.round < state.maxRounds && state.market.length > 0
  const needsSanctuary = human.pendingSanctuaries.length > 0

  if (needsRegion && !state.humanDraftSelection.regionId) {
    return false
  }

  if (needsSanctuary && !state.humanDraftSelection.sanctuaryId) {
    return false
  }

  return true
}

export function standingsSummary(standings: FinalStanding[]) {
  return standings.map((standing, index) => `${index + 1}. ${standing.playerName} - ${standing.total} Fame`)
}

export function bestScoreFromStandings(standings: FinalStanding[], playerName: string) {
  const player = standings.find((entry) => entry.playerName === playerName)
  return player?.total ?? 0
}

export function getPlayerDigitEchoes(player: PlayerState, mode: MatchConfig['mode']) {
  return playerVisibleEchoDigits(player, mode === 'starfall')
}

export function cloneMatchState(state: MatchState) {
  return cloneState(state)
}

export function seedFromDate(date: string) {
  return date.replaceAll('-', '')
}
