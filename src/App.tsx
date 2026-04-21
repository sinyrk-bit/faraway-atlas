import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import './App.css'
import { AvatarPicker } from './components/AvatarPicker'
import { CardFace } from './components/CardFace'
import { PlayerInspectModal } from './components/PlayerInspectModal'
import { AtlasAudioEngine } from './game/audio'
import { difficultyMeta, modeMeta } from './game/content'
import {
  PROFILE_KEY,
  beginDraftPhase,
  bestScoreFromStandings,
  buildFinalStandings,
  confirmHumanDraft,
  confirmOpeningSelection,
  confirmRegionChoice,
  createMatch,
  defaultProfile,
  getActiveHumanPlayer,
  getCurrentPlayer,
  getHumanPlayer,
  getPlayerDigitEchoes,
  humanDraftCanConfirm,
  runNextAiDraft,
  seedFromDate,
  selectOpeningRegion,
  selectRegionToPlay,
  setHumanDraftSelection,
  standingsSummary,
} from './game/engine'
import { availableAvatars, getAvatarForPlayer } from './game/visuals'
import type {
  Difficulty,
  DraftSelection,
  MatchConfig,
  MatchMode,
  MatchState,
  PersistedProfile,
  PlayerState,
  FinalStanding,
  ScoreEntry,
} from './game/types'

type MatchSnapshot = {
  phase: MatchState['phase']
  round: number
  draftIndex: number
  revealCount: number
  activeHumanPlayerId?: string
}

type PhaseAnnouncement = {
  token: string
  title: string
  detail: string
}

type ScoreRevealState = {
  playerIndex: number
  revealedEntries: number
  complete: boolean
}

function createScoreRevealState(): ScoreRevealState {
  return {
    playerIndex: 0,
    revealedEntries: 0,
    complete: false,
  }
}

const phaseLabels: Record<MatchState['phase'], string> = {
  'opening-hand': 'Auftakthand',
  'choose-region': 'Routenwahl',
  reveal: 'Aufdecken',
  draft: 'Marktphase',
  scoring: 'Wertung',
  finished: 'Endstand',
}

const timeLabels = {
  day: 'Tag',
  night: 'Nacht',
} as const

const modeCinematicLine: Record<MatchMode, string> = {
  classic: 'Acht Runden. Eine makellose Route. Kein zweiter Versuch.',
  advanced: 'Mehr Auftakt, mehr Druck, mehr Raum fuer praezise Perfektion.',
  starfall: 'Meteore bleiben sichtbar und jede Endziffer kann das Endspiel kippen.',
}

const restartModeOrder: MatchMode[] = ['classic', 'advanced', 'starfall']

function readInviteProfilePatch() {
  if (typeof window === 'undefined') {
    return {}
  }

  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode')
  const difficulty = params.get('difficulty')
  const totalPlayersValue = params.get('players')
  const humanCountValue = params.get('humans')
  const totalPlayers = totalPlayersValue ? Number(totalPlayersValue) : Number.NaN
  const humanCount = humanCountValue ? Number(humanCountValue) : Number.NaN
  const seed = params.get('seed')

  return {
    preferredMode: mode && ['classic', 'advanced', 'starfall'].includes(mode) ? (mode as MatchMode) : undefined,
    preferredDifficulty:
      difficulty && ['wanderer', 'pathfinder', 'oracle'].includes(difficulty)
        ? (difficulty as Difficulty)
        : undefined,
    preferredTotalPlayers: Number.isFinite(totalPlayers) ? Math.min(6, Math.max(2, totalPlayers)) : undefined,
    preferredHumanCount:
      Number.isFinite(humanCount) && Number.isFinite(totalPlayers)
        ? Math.min(Math.min(6, Math.max(2, totalPlayers)), Math.max(1, humanCount))
        : undefined,
    preferredSeed: seed ?? undefined,
  }
}

function hasInviteContext() {
  if (typeof window === 'undefined') {
    return false
  }

  const params = new URLSearchParams(window.location.search)
  return params.get('invite') === '1'
}

function loadProfile(): PersistedProfile {
  if (typeof window === 'undefined') {
    return defaultProfile()
  }

  try {
    const stored = window.localStorage.getItem(PROFILE_KEY)
    if (!stored) {
      return {
        ...defaultProfile(),
        ...Object.fromEntries(
          Object.entries(readInviteProfilePatch()).filter(([, value]) => value !== undefined),
        ),
      }
    }
    return {
      ...defaultProfile(),
      ...JSON.parse(stored),
      ...Object.fromEntries(
        Object.entries(readInviteProfilePatch()).filter(([, value]) => value !== undefined),
      ),
    }
  } catch {
    return defaultProfile()
  }
}

function useTodaySeed() {
  return seedFromDate(new Date().toISOString().slice(0, 10))
}

function updateProfile(nextProfile: PersistedProfile) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile))
}

function buildInviteUrl(profile: PersistedProfile) {
  if (typeof window === 'undefined') {
    return ''
  }

  const url = new URL(window.location.href)
  url.searchParams.set('invite', '1')
  url.searchParams.set('mode', profile.preferredMode)
  url.searchParams.set('difficulty', profile.preferredDifficulty)
  url.searchParams.set('players', String(profile.preferredTotalPlayers))
  url.searchParams.set('humans', String(profile.preferredHumanCount))
  url.searchParams.set('seed', profile.preferredSeed)
  return url.toString()
}

function ModeTile({
  mode,
  active,
  onSelect,
}: {
  mode: MatchMode
  active: boolean
  onSelect: (mode: MatchMode) => void
}) {
  return (
    <button
      className={`mode-tile ${active ? 'is-active' : ''}`}
      onClick={() => onSelect(mode)}
      style={{ '--mode-accent': modeMeta[mode].accent } as CSSProperties}
      type="button"
    >
      <span>{modeMeta[mode].title}</span>
      <strong>{modeMeta[mode].summary}</strong>
      <p>{modeMeta[mode].detail}</p>
    </button>
  )
}

function SegmentButton<T extends string>({
  value,
  current,
  onClick,
  children,
}: {
  value: T
  current: T
  onClick: (value: T) => void
  children: ReactNode
}) {
  return (
    <button className={`segment-button ${current === value ? 'is-active' : ''}`} onClick={() => onClick(value)} type="button">
      {children}
    </button>
  )
}

function RevealSummary({ match }: { match: MatchState }) {
  return (
    <div className="reveal-grid">
      {match.revealEntries.map((entry, index) => {
        const player = match.players.find((candidate) => candidate.id === entry.playerId)
        return (
          <article className="reveal-card" key={entry.playerId} style={{ '--reveal-index': index } as CSSProperties}>
            <div>
              <span>{player?.name}</span>
              <strong>{entry.card.title}</strong>
            </div>
            <div className="reveal-meta">
              <span>{entry.card.duration}h</span>
              <span>{timeLabels[entry.card.time]}</span>
            </div>
            <p>
              {entry.foundSanctuary
                ? `${entry.sanctuaryCount} Refugiumsoption${entry.sanctuaryCount === 1 ? '' : 'en'} freigeschaltet.`
                : 'In dieser Runde wurde kein Refugium gefunden.'}
            </p>
          </article>
        )
      })}
    </div>
  )
}

function RulesDrawer({ open }: { open: boolean }) {
  if (!open) {
    return null
  }

  return (
    <aside className="rules-drawer">
      <div className="rules-block">
        <span>Kernablauf</span>
        <p>Spiele pro Runde eine Region, decke gleichzeitig auf und drafte danach in aufsteigender Dauer aus dem Markt.</p>
      </div>
      <div className="rules-block">
        <span>Refugien</span>
        <p>Refugien findest du nur dann, wenn die soeben gespielte Region eine höhere Dauer als die vorherige besitzt.</p>
      </div>
      <div className="rules-block">
        <span>Wertung</span>
        <p>Am Ende werten Regionenkarten von rechts nach links. Frühere Karten sehen nur bereits aufgedeckte Regionen plus alle Refugien.</p>
      </div>
      <div className="rules-block">
        <span>Sternensturz</span>
        <p>Meteorkarten bleiben während der Wertung sichtbar und lassen auch alle Regionen mit derselben Endziffer aufleuchten.</p>
      </div>
    </aside>
  )
}

function formatScore(points: number) {
  return points > 0 ? `+${points}` : `${points}`
}

function sumScoreEntries(entries: ScoreEntry[]) {
  return entries.reduce((total, entry) => total + entry.points, 0)
}

function getRevealActionLabel(reveal: ScoreRevealState, standing: FinalStanding | undefined, totalPlayers: number) {
  if (!standing) {
    return 'Endscore anzeigen'
  }

  if (reveal.revealedEntries < standing.entries.length) {
    return 'Karte aufdecken'
  }

  if (reveal.playerIndex < totalPlayers - 1) {
    return 'Naechster Spieler'
  }

  return 'Endscore anzeigen'
}

function ScoreRevealEntry({ entry, index }: { entry: ScoreEntry; index: number }) {
  return (
    <article className={`score-reveal-entry ${entry.satisfied ? 'is-satisfied' : 'is-missed'}`}>
      <span className="score-entry-index">{String(index + 1).padStart(2, '0')}</span>
      <div className="score-entry-copy">
        <strong>{entry.sourceName}</strong>
        <p>{entry.reason}</p>
      </div>
      <div className="score-entry-points">
        <span>{entry.sourceType === 'region' ? 'Region' : 'Refugium'}</span>
        <strong>{formatScore(entry.points)}</strong>
      </div>
    </article>
  )
}

function ScoreRevealCeremony({
  standings,
  reveal,
}: {
  standings: FinalStanding[]
  reveal: ScoreRevealState
}) {
  const activeIndex = Math.min(reveal.playerIndex, Math.max(standings.length - 1, 0))
  const activeStanding = standings[activeIndex]
  const revealedEntries = activeStanding?.entries.slice(0, reveal.revealedEntries) ?? []
  const upcomingEntry = activeStanding?.entries[reveal.revealedEntries]
  const runningTotal = sumScoreEntries(revealedEntries)
  const cardProgress = activeStanding?.entries.length
    ? Math.round((reveal.revealedEntries / activeStanding.entries.length) * 100)
    : 100

  if (!activeStanding) {
    return null
  }

  return (
    <div className="score-ceremony">
      <div className="score-progress-rail" aria-label="Wertungsfortschritt">
        {standings.map((standing, index) => (
          <span
            className={[
              'score-progress-node',
              index < activeIndex ? 'is-complete' : '',
              index === activeIndex ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            key={standing.playerId}
          >
            <strong>{index + 1}</strong>
            <em>{standing.playerName}</em>
          </span>
        ))}
      </div>

      <div className="score-stage">
        <section className="score-player-focus">
          <span className="score-kicker">Wertung {activeIndex + 1} / {standings.length}</span>
          <h3>{activeStanding.playerName}</h3>
          <div className="score-live-meter">
            <span>Live-Ruhm</span>
            <strong>{runningTotal}</strong>
            <em>von {activeStanding.total}</em>
          </div>
          <div className="score-card-meter">
            <span style={{ width: `${cardProgress}%` }} />
          </div>
          <p>
            {upcomingEntry
              ? `Naechste Karte: ${upcomingEntry.sourceName}`
              : `${activeStanding.playerName} ist komplett gewertet.`}
          </p>
        </section>

        <section className="score-reveal-stack">
          <div className="score-stack-head">
            <span>{revealedEntries.length} / {activeStanding.entries.length} Karten offen</span>
            <strong>{upcomingEntry ? 'Naechste Enthuellung bereit' : 'Spielerwertung abgeschlossen'}</strong>
          </div>
          <div className="score-reveal-list">
            {revealedEntries.length === 0 ? (
              <div className="score-empty-state">Noch keine Karte geoeffnet. Der erste Klick startet die Zaehlersequenz.</div>
            ) : null}
            {revealedEntries.map((entry, index) => (
              <ScoreRevealEntry entry={entry} index={index} key={`${activeStanding.playerId}-${entry.sourceId}`} />
            ))}
          </div>
        </section>

        <aside className="score-completed">
          <span>Bereits gewertet</span>
          {standings.slice(0, activeIndex).length === 0 ? <p>Noch niemand abgeschlossen.</p> : null}
          {standings.slice(0, activeIndex).map((standing, index) => (
            <div className="score-completed-row" key={standing.playerId}>
              <span>#{index + 1}</span>
              <strong>{standing.playerName}</strong>
              <em>{standing.total} Ruhm</em>
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}

function FinalScoreboard({ standings }: { standings: FinalStanding[] }) {
  return (
    <div className="final-scoreboard">
      <section className="final-podium">
        {standings.slice(0, 3).map((standing, index) => (
          <article className={`podium-card podium-rank-${index + 1}`} key={standing.playerId}>
            <span>{index === 0 ? 'Sieger' : `Platz ${index + 1}`}</span>
            <strong>{standing.playerName}</strong>
            <em>{standing.total} Ruhm</em>
          </article>
        ))}
      </section>

      <section className="final-score-list">
        {standings.map((standing, index) => (
          <article className={`final-score-row ${index === 0 ? 'is-winner' : ''}`} key={standing.playerId}>
            <span className="final-rank">#{index + 1}</span>
            <div className="final-player">
              <strong>{standing.playerName}</strong>
              <span>{standing.entries.length} Wertungen · Tempo {standing.tieBreaker}h</span>
            </div>
            <div className="final-entry-preview">
              {standing.entries.slice(0, 4).map((entry) => (
                <span key={`${standing.playerId}-mini-${entry.sourceId}`}>
                  {entry.sourceName} {formatScore(entry.points)}
                </span>
              ))}
            </div>
            <strong className="final-total">{standing.total}</strong>
          </article>
        ))}
      </section>
    </div>
  )
}

function buildPhaseAnnouncement(match: MatchState, activeName?: string): PhaseAnnouncement {
  switch (match.phase) {
    case 'opening-hand':
      return {
        token: `opening-${match.round}-${match.activeHumanPlayerId ?? 'none'}`,
        title: 'Auftaktsequenz',
        detail: `${activeName ?? 'Der aktive Platz'} kalibriert die Startregionen fuer Runde ${match.round}.`,
      }
    case 'choose-region':
      return {
        token: `choose-${match.round}-${match.activeHumanPlayerId ?? 'none'}`,
        title: `Runde ${match.round} · Routenwahl`,
        detail: `${activeName ?? 'Der aktive Platz'} plant den naechsten Vorstoss durch ${modeMeta[match.config.mode].title}.`,
      }
    case 'reveal':
      return {
        token: `reveal-${match.round}-${match.revealEntries.length}`,
        title: 'Synchrones Aufdecken',
        detail: 'Die Tischreihenfolge enthuellt sich jetzt in Tempoabstufungen.',
      }
    case 'draft':
      return {
        token: `draft-${match.round}-${match.draftIndex}`,
        title: 'Marktfreigabe',
        detail: `${activeName ?? 'Der aktuelle Platz'} kontrolliert den naechsten Premium-Pick.`,
      }
    case 'finished':
      return {
        token: `finished-${match.round}`,
        title: 'Atlas abgeschlossen',
        detail: 'Rueckwaertswertung, Refugien und Meteorechos haben das Endspiel beschlossen.',
      }
    default:
      return {
        token: `phase-${match.phase}-${match.round}`,
        title: phaseLabels[match.phase],
        detail: 'Die Expeditionslage wird neu berechnet.',
      }
  }
}

function buildPlayerStatusLine(player: PlayerState) {
  const latestRoute = player.tableau.at(-1)

  if (!latestRoute) {
    return 'Noch keine gespielte Region.'
  }

  return `Letzte Karte #${latestRoute.serial} · ${latestRoute.duration}h · ${latestRoute.title}`
}

function App() {
  const todaySeed = useTodaySeed()
  const [profile, setProfile] = useState<PersistedProfile>(() => {
    const loaded = loadProfile()
    return {
      ...loaded,
      preferredSeed: loaded.preferredSeed || todaySeed,
    }
  })
  const [match, setMatch] = useState<MatchState | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [scoreReveal, setScoreReveal] = useState<ScoreRevealState>(() => createScoreRevealState())
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string | null>(null)
  const [inviteStatus, setInviteStatus] = useState('')
  const [invitePromptOpen, setInvitePromptOpen] = useState(() => hasInviteContext())
  const [pendingInviteName, setPendingInviteName] = useState(() => loadProfile().playerName ?? 'Erkunder')
  const [pendingInviteAvatarId, setPendingInviteAvatarId] = useState(() => loadProfile().preferredAvatarId ?? availableAvatars[0].id)
  const [phaseAnnouncement, setPhaseAnnouncement] = useState<PhaseAnnouncement | null>(null)
  const [audioEngine] = useState(() => new AtlasAudioEngine())
  const previousMatchRef = useRef<MatchSnapshot | null>(null)

  const playSound = useCallback((cue: 'tap' | 'select' | 'lock' | 'turn' | 'reveal' | 'draft' | 'victory') => {
    void audioEngine.play(cue)
  }, [audioEngine])

  useEffect(() => {
    updateProfile(profile)
  }, [profile])

  useEffect(() => {
    audioEngine.setEnabled(profile.soundEnabled)
  }, [audioEngine, profile.soundEnabled])

  useEffect(() => {
    if (!phaseAnnouncement) {
      return
    }

    const timer = window.setTimeout(() => {
      setPhaseAnnouncement((current) => (current?.token === phaseAnnouncement.token ? null : current))
    }, 2200)

    return () => window.clearTimeout(timer)
  }, [phaseAnnouncement])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (inspectedPlayerId) {
        setInspectedPlayerId(null)
      } else if (invitePromptOpen) {
        setInvitePromptOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inspectedPlayerId, invitePromptOpen])

  useEffect(() => {
    if (!match || match.phase !== 'draft') {
      return
    }

    const current = getCurrentPlayer(match)
    if (!current || current.kind !== 'ai') {
      return
    }

    const timer = window.setTimeout(() => {
      startTransition(() => {
        setMatch((currentMatch) => (currentMatch ? runNextAiDraft(currentMatch) : currentMatch))
      })
    }, 700)

    return () => window.clearTimeout(timer)
  }, [match, playSound])

  useEffect(() => {
    if (!match) {
      previousMatchRef.current = null
      return
    }

    const currentSnapshot: MatchSnapshot = {
      phase: match.phase,
      round: match.round,
      draftIndex: match.draftIndex,
      revealCount: match.revealEntries.length,
      activeHumanPlayerId: match.activeHumanPlayerId,
    }
    const previousSnapshot = previousMatchRef.current
    const activeName =
      (match.phase === 'opening-hand' || match.phase === 'choose-region'
        ? getActiveHumanPlayer(match)?.name
        : getCurrentPlayer(match)?.name) ?? getHumanPlayer(match)?.name

    if (previousSnapshot) {
      if (previousSnapshot.phase !== match.phase) {
        setPhaseAnnouncement(buildPhaseAnnouncement(match, activeName))
        if (match.phase === 'reveal') {
          playSound('reveal')
        } else if (match.phase === 'draft') {
          playSound('turn')
        } else if (match.phase === 'finished') {
          playSound('victory')
        } else if (match.phase === 'choose-region' || match.phase === 'opening-hand') {
          playSound('turn')
        }
      } else if (previousSnapshot.draftIndex !== match.draftIndex) {
        playSound('draft')
      } else if (
        previousSnapshot.activeHumanPlayerId !== match.activeHumanPlayerId &&
        (match.phase === 'opening-hand' || match.phase === 'choose-region')
      ) {
        playSound('turn')
        setPhaseAnnouncement(buildPhaseAnnouncement(match, activeName))
      } else if (previousSnapshot.revealCount !== match.revealEntries.length && match.phase === 'reveal') {
        playSound('reveal')
      } else if (previousSnapshot.round !== match.round) {
        setPhaseAnnouncement(buildPhaseAnnouncement(match, activeName))
      }
    } else {
      setPhaseAnnouncement(buildPhaseAnnouncement(match, activeName))
    }

    previousMatchRef.current = currentSnapshot
  }, [match, playSound])

  const human = match ? getHumanPlayer(match) : undefined
  const activeHuman = match ? getActiveHumanPlayer(match) : undefined
  const currentPlayer = match ? getCurrentPlayer(match) : undefined
  const standings = match ? buildFinalStandings(match) : []
  const viewedHuman = activeHuman ?? human
  const humanEchoDigits = viewedHuman && match ? getPlayerDigitEchoes(viewedHuman, match.config.mode) : []
  const selectedHandCard = activeHuman?.hand.find((card) => card.id === match?.selectedRegionId)
  const humanDraftSelection = match?.humanDraftSelection ?? {}
  const dailySummary = standingsSummary(standings)
  const inspectedPlayer =
    match && inspectedPlayerId
      ? match.players.find((player) => player.id === inspectedPlayerId) ?? null
      : null
  const tacticalObjective = !match
    ? ''
    : match.phase === 'opening-hand'
      ? 'Waehle eine perfekt skalierte Auftakthand und halte die Flex-Kurve offen.'
      : match.phase === 'choose-region'
        ? 'Optimiere Tempo gegen Refugiumszugriff und spiele nicht blind auf kurze Dauer.'
        : match.phase === 'reveal'
          ? 'Lies die Reihenfolge, bevor der Markt aufspringt, und plane den Premium-Pick.'
          : match.phase === 'draft'
            ? 'Sichere die beste Region fuer dein Endspielfenster und verliere keine Refugiumswerte.'
            : match.phase === 'finished'
              ? 'Analysiere die Rueckwaertswertung und justiere die naechste Revanche.'
              : ''
  const commandRailItems = !match
    ? []
    : [
        { label: 'Aktiver Platz', value: activeHuman?.name ?? currentPlayer?.name ?? human?.name ?? 'Tisch bereit' },
        { label: 'Ziel', value: tacticalObjective },
        { label: 'Markt', value: `${match.market.length} offen` },
        { label: 'Echo', value: humanEchoDigits.length > 0 ? humanEchoDigits.join(' · ') : 'Keine' },
      ]

  function patchProfile(patch: Partial<PersistedProfile>) {
    setProfile((current) => ({
      ...current,
      ...patch,
    }))
  }

  function confirmInviteProfile() {
    const safeName = pendingInviteName.trim() || 'Erkunder'

    patchProfile({
      playerName: safeName,
      preferredAvatarId: pendingInviteAvatarId,
    })

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('invite')
      window.history.replaceState({}, '', url.toString())
    }

    playSound('lock')
    setInvitePromptOpen(false)
    setInviteStatus('Profil fuer diesen Tisch gesetzt.')
    window.setTimeout(() => setInviteStatus(''), 1800)
  }

  function startMatch(modeOverride?: MatchMode) {
    const mode = modeOverride ?? profile.preferredMode
    const totalPlayers = Math.min(6, Math.max(2, profile.preferredTotalPlayers))
    const humanCount = Math.min(totalPlayers, Math.max(1, profile.preferredHumanCount))
    const config: MatchConfig = {
      mode,
      playerName: profile.playerName || 'Erkunder',
      playerAvatarId: profile.preferredAvatarId,
      humanCount,
      aiCount: totalPlayers - humanCount,
      difficulty: profile.preferredDifficulty,
      seed: (profile.preferredSeed || todaySeed).trim() || todaySeed,
    }

    playSound('lock')
    startTransition(() => {
      setMatch(createMatch(config))
      setScoreReveal(createScoreRevealState())
    })
  }

  async function copyInviteLink(profileForLink = profile) {
    const inviteUrl = buildInviteUrl(profileForLink)
    if (!inviteUrl || typeof window === 'undefined' || !navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(inviteUrl)
    playSound('tap')
    setInviteStatus('Einladungslink kopiert.')
    window.setTimeout(() => setInviteStatus(''), 1800)
  }

  function syncFinishedStats(activeMatch: MatchState) {
    const latestStandings = buildFinalStandings(activeMatch)
    const bestScore = bestScoreFromStandings(latestStandings, profile.playerName || 'Erkunder')
    const winner = latestStandings[0]?.playerName ?? ''

    patchProfile({
      lastBestScore: Math.max(profile.lastBestScore, bestScore),
      lastWinner: winner,
    })
  }

  function advanceScoreReveal() {
    playSound('select')
    setScoreReveal((current) => {
      if (current.complete) {
        return current
      }

      const activeStanding = standings[Math.min(current.playerIndex, Math.max(standings.length - 1, 0))]

      if (!activeStanding) {
        return { ...current, complete: true }
      }

      if (current.revealedEntries < activeStanding.entries.length) {
        return {
          ...current,
          revealedEntries: current.revealedEntries + 1,
        }
      }

      if (current.playerIndex < standings.length - 1) {
        return {
          playerIndex: current.playerIndex + 1,
          revealedEntries: 0,
          complete: false,
        }
      }

      return {
        ...current,
        complete: true,
      }
    })
  }

  function skipScoreReveal() {
    playSound('lock')
    setScoreReveal({
      playerIndex: standings.length,
      revealedEntries: 0,
      complete: true,
    })
  }

  function restartFromScore(activeMatch: MatchState, mode: MatchMode) {
    syncFinishedStats(activeMatch)
    patchProfile({ preferredMode: mode })
    startMatch(mode)
  }

  function updateHumanDraft(partial: DraftSelection) {
    if (!match) {
      return
    }

    setMatch(setHumanDraftSelection(match, { ...match.humanDraftSelection, ...partial }))
  }

  function renderMenu() {
    return (
      <main className="screen screen-menu">
        <section className="hero-shell">
          <div className="hero-copy">
            <p className="eyebrow">Inoffizieller Neon-Prototyp</p>
            <h1>Faraway Atlas</h1>
            <p className="hero-text">
              Eine kompakte Browser-Edition im dunklen Neon-Look mit Rueckwaertswertung, Refugium-Ketten, mehreren Varianten und KI-Rivalen fuer direkte Live-Tests.
            </p>
            <div className="hero-signal-row">
              <article className="hero-signal-card">
                <span>Direktorat</span>
                <strong>Atlas Command</strong>
                <p>Hochverdichtete Tabletop-Inszenierung mit taktischer Neon-Praesenz.</p>
              </article>
              <article className="hero-signal-card">
                <span>Tischsetup</span>
                <strong>{profile.preferredTotalPlayers} Plaetze · {profile.preferredHumanCount} Mensch</strong>
                <p>{modeCinematicLine[profile.preferredMode]}</p>
              </article>
              <article className="hero-signal-card">
                <span>Freundesitz</span>
                <strong>{profile.playerName || 'Erkunder'} online</strong>
                <p>Invite-Link, Avatarwahl und kompakte Gegnerinspektion bereits aktiv.</p>
              </article>
            </div>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => startMatch()} type="button">
                Expedition starten
              </button>
              <button
                className="ghost-button"
                onClick={() => {
                  playSound('tap')
                  patchProfile({ preferredSeed: todaySeed })
                  startMatch('starfall')
                }}
                type="button"
              >
                Tagesmodus Sternensturz
              </button>
              <button className="ghost-button" onClick={() => void copyInviteLink()} type="button">
                Einladungslink kopieren
              </button>
            </div>
            {inviteStatus ? <div className="invite-status">{inviteStatus}</div> : null}
          </div>

          <div className="hero-panel">
            <div className="panel-section">
              <span className="panel-label">Spielmodi</span>
              <div className="mode-grid">
                {(['classic', 'advanced', 'starfall'] as MatchMode[]).map((mode) => (
                  <ModeTile
                    active={profile.preferredMode === mode}
                    key={mode}
                    mode={mode}
                    onSelect={(value) => {
                      playSound('tap')
                      patchProfile({ preferredMode: value })
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="panel-section settings-grid">
              <label className="field">
                <span>Name des Erkunders</span>
                <input
                  onChange={(event) => patchProfile({ playerName: event.target.value })}
                  placeholder="Erkunder"
                  value={profile.playerName}
                />
              </label>

              <div className="field field-avatar">
                <span>Avatar-Signatur</span>
                <AvatarPicker
                  onSelect={(avatarId) => {
                    playSound('tap')
                    patchProfile({ preferredAvatarId: avatarId })
                  }}
                  selectedId={profile.preferredAvatarId}
                />
                <p className="field-hint">Wird fuer deinen Sitz und fuer geteilte Tischlinks verwendet.</p>
              </div>

              <label className="field">
                <span>Seed-Code</span>
                <input
                  onChange={(event) => patchProfile({ preferredSeed: event.target.value })}
                  placeholder={todaySeed}
                  value={profile.preferredSeed}
                />
              </label>

              <div className="field">
                <span>Spieler gesamt</span>
                <div className="segment-row">
                  {[2, 3, 4, 5, 6].map((count) => (
                    <SegmentButton
                      current={String(profile.preferredTotalPlayers)}
                      key={count}
                      onClick={(value) =>
                        {
                          playSound('tap')
                          patchProfile({
                            preferredTotalPlayers: Number(value),
                            preferredHumanCount: Math.min(profile.preferredHumanCount, Number(value)),
                          })
                        }
                      }
                      value={String(count)}
                    >
                      {count}
                    </SegmentButton>
                  ))}
                </div>
              </div>

              <div className="field">
                <span>Menschliche Plaetze</span>
                <div className="segment-row">
                  {Array.from({ length: profile.preferredTotalPlayers }, (_, index) => index + 1).map((count) => (
                    <SegmentButton
                      current={String(profile.preferredHumanCount)}
                      key={count}
                      onClick={(value) => {
                        playSound('tap')
                        patchProfile({ preferredHumanCount: Number(value) })
                      }}
                      value={String(count)}
                    >
                      {count}
                    </SegmentButton>
                  ))}
                </div>
                <p className="field-hint">
                  {profile.preferredTotalPlayers - profile.preferredHumanCount} KI-Platz
                  {profile.preferredTotalPlayers - profile.preferredHumanCount === 1 ? '' : 'e'}.
                </p>
              </div>

              <div className="field">
                <span>Schwierigkeit</span>
                <div className="segment-row">
                  {(['wanderer', 'pathfinder', 'oracle'] as Difficulty[]).map((difficulty) => (
                    <SegmentButton
                      current={profile.preferredDifficulty}
                      key={difficulty}
                      onClick={(value) => {
                        playSound('tap')
                        patchProfile({ preferredDifficulty: value })
                      }}
                      value={difficulty}
                    >
                      {difficultyMeta[difficulty].label}
                    </SegmentButton>
                  ))}
                </div>
                <p className="field-hint">{difficultyMeta[profile.preferredDifficulty].summary}</p>
              </div>
            </div>

            <div className="stats-row">
              <article>
                <span>Bestwert</span>
                <strong>{profile.lastBestScore || '--'}</strong>
              </article>
              <article>
                <span>Letzter Sieger</span>
                <strong>{profile.lastWinner || '--'}</strong>
              </article>
              <article>
                <span>Modus</span>
                <strong>{modeMeta[profile.preferredMode].title}</strong>
              </article>
              <article>
                <span>Audio</span>
                <button
                  className="inline-toggle"
                  onClick={() => {
                    playSound('tap')
                    patchProfile({ soundEnabled: !profile.soundEnabled })
                  }}
                  type="button"
                >
                  {profile.soundEnabled ? 'An' : 'Aus'}
                </button>
              </article>
            </div>

            <div className="feature-rail">
              <article className="feature-card">
                <span>Premium HUD</span>
                <strong>Command Rail</strong>
                <p>Ziel, aktiver Platz, Marktfenster und Meteorechos bleiben sofort lesbar.</p>
              </article>
              <article className="feature-card">
                <span>Match-Regie</span>
                <strong>Phase Marquee</strong>
                <p>Filmische Phasenbanner rahmen jede wichtige Eskalation ohne den Tisch zu blockieren.</p>
              </article>
              <article className="feature-card">
                <span>Intel Layer</span>
                <strong>Rivalen-Inspect</strong>
                <p>Alle gegnerischen Infos liegen hinter einem sauberen Detailfenster statt im Haupt-HUD.</p>
              </article>
            </div>
          </div>
        </section>

        {invitePromptOpen ? (
          <div aria-modal="true" className="modal-backdrop" role="dialog">
            <section className="modal-panel invite-join-modal">
              <div className="phase-copy">
                <span className="phase-tag">Freundesitz verbinden</span>
                <h2>Wie soll dein Platz an diesem Tisch heissen?</h2>
                <p>Waehle deinen Namen und ein Avatar-Signet, bevor du den geteilten Atlas betrittst.</p>
              </div>

              <label className="field">
                <span>Dein Name</span>
                <input
                  autoFocus
                  maxLength={20}
                  onChange={(event) => setPendingInviteName(event.target.value)}
                  placeholder="Erkunder"
                  value={pendingInviteName}
                />
              </label>

              <div className="field field-avatar">
                <span>Avatar waehlen</span>
                <AvatarPicker
                  onSelect={(avatarId) => {
                    playSound('tap')
                    setPendingInviteAvatarId(avatarId)
                  }}
                  selectedId={pendingInviteAvatarId}
                />
              </div>

              <div className="phase-actions modal-actions">
                <button className="primary-button" onClick={confirmInviteProfile} type="button">
                  Profil uebernehmen
                </button>
                <button
                  className="ghost-button"
                  onClick={() => {
                    playSound('tap')
                    setInvitePromptOpen(false)
                  }}
                  type="button"
                >
                  Spaeter
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    )
  }

  function renderTopBar(activeMatch: MatchState) {
    return (
      <header className="top-bar">
        <div>
          <span className="eyebrow">Runde {activeMatch.round} / {activeMatch.maxRounds}</span>
          <h1>{modeMeta[activeMatch.config.mode].title}</h1>
        </div>
        <div className="top-bar-metrics">
          <div>
            <span>Seed-Code</span>
            <strong>{activeMatch.seedLabel}</strong>
          </div>
          <div>
            <span>Phase</span>
            <strong>{phaseLabels[activeMatch.phase]}</strong>
          </div>
          <button
            className="ghost-button"
            onClick={() => {
              playSound('tap')
              setRulesOpen((value) => !value)
            }}
            type="button"
          >
            {rulesOpen ? 'Regeln ausblenden' : 'Regeln einblenden'}
          </button>
          <button
            className="ghost-button"
            onClick={() => {
              playSound('tap')
              patchProfile({ soundEnabled: !profile.soundEnabled })
            }}
            type="button"
          >
            Audio {profile.soundEnabled ? 'An' : 'Aus'}
          </button>
          <button
            className="ghost-button"
            onClick={() =>
              void copyInviteLink({
                ...profile,
                preferredMode: activeMatch.config.mode,
                preferredHumanCount: activeMatch.config.humanCount,
                preferredTotalPlayers: activeMatch.config.humanCount + activeMatch.config.aiCount,
                preferredSeed: activeMatch.seedLabel,
                preferredDifficulty: activeMatch.config.difficulty,
              })
            }
            type="button"
          >
            Tischlink kopieren
          </button>
        </div>
      </header>
    )
  }

  function renderOpeningSelection(activeMatch: MatchState, activeHumanPlayer: PlayerState) {
    return (
      <section className="phase-panel phase-panel-opening" key={`opening-${activeMatch.round}-${activeHumanPlayer.id}`}>
        <div className="phase-copy">
          <span className="phase-tag">Auftaktdraft</span>
          <h2>{activeHumanPlayer.name}, behalte drei deiner fuenf Startregionen.</h2>
          <p>Der erweiterte Modus legt das Puzzle nach vorn. Reiche das Geraet nach dem Verriegeln weiter, wenn mehrere Freunde lokal spielen.</p>
        </div>
        <div className="seat-banner">Steuerung an {activeHumanPlayer.name}</div>
        <div className="card-grid">
          {activeHumanPlayer.hand.map((card) => (
            <CardFace
              card={card}
              compact
              minimal
              key={card.id}
              onClick={() => {
                playSound('select')
                setMatch((current) => (current ? selectOpeningRegion(current, card.id) : current))
              }}
              selectable
              selected={activeMatch.openingSelectionIds.includes(card.id)}
            />
          ))}
        </div>
        <button
          className="primary-button"
          disabled={!activeMatch.openingReady}
          onClick={() => {
            playSound('lock')
            setMatch((current) => (current ? confirmOpeningSelection(current) : current))
          }}
          type="button"
        >
          Auftakthand verriegeln
        </button>
      </section>
    )
  }

  function renderChooseRegion(activeMatch: MatchState, activeHumanPlayer: PlayerState) {
    return (
      <section className="phase-panel phase-panel-choose" key={`choose-${activeMatch.round}-${activeHumanPlayer.id}`}>
        <div className="phase-copy">
          <span className="phase-tag">Region waehlen</span>
          <h2>{activeHumanPlayer.name}, plane deinen naechsten Schritt.</h2>
          <p>Niedrige Dauer bedeutet fruehere Draft-Prioritaet. Hoehere Dauer kann Refugien freischalten, wenn du deine letzte Karte uebertriffst.</p>
        </div>
        <div className="seat-banner">Aktiver Platz: {activeHumanPlayer.name}</div>
        <div className="card-grid">
          {activeHumanPlayer.hand.map((card) => (
            <CardFace
              card={card}
              compact
              minimal
              key={card.id}
              onClick={() => {
                playSound('select')
                setMatch((current) => (current ? selectRegionToPlay(current, card.id) : current))
              }}
              selectable
              selected={activeMatch.selectedRegionId === card.id}
            />
          ))}
        </div>
        <div className="phase-actions">
          <button
            className="primary-button"
            disabled={!activeMatch.selectedRegionId}
            onClick={() => {
              playSound('lock')
              setMatch((current) => (current ? confirmRegionChoice(current) : current))
            }}
            type="button"
          >
            Platzwahl verriegeln
          </button>
          {selectedHandCard ? (
            <div className="selection-preview">
              <span>Verriegelte Karte</span>
              <strong>{selectedHandCard.title}</strong>
            </div>
          ) : null}
        </div>
      </section>
    )
  }

  function renderReveal(activeMatch: MatchState) {
    return (
      <section className="phase-panel phase-panel-reveal" key={`reveal-${activeMatch.round}`}>
        <div className="phase-copy">
          <span className="phase-tag">Aufdecken</span>
          <h2>Der Tisch loest sich in Temporeihenfolge auf.</h2>
          <p>Schnelle Routen draften zuerst. Refugiumspruefungen passieren vor dem Marktdraft und koennen die ganze Runde kippen.</p>
        </div>
        <RevealSummary match={activeMatch} />
        <button
          className="primary-button"
          onClick={() => {
            playSound('lock')
            setMatch((current) => (current ? beginDraftPhase(current) : current))
          }}
          type="button"
        >
          Weiter zur Marktphase
        </button>
      </section>
    )
  }

  function renderDraft(activeMatch: MatchState, activeHumanPlayer: PlayerState) {
    const isHumanTurn = currentPlayer?.id === activeHumanPlayer.id
    const selectedMarketCard = activeMatch.market.find((card) => card.id === humanDraftSelection.regionId)
    const selectedSanctuary = activeHumanPlayer.pendingSanctuaries.find((card) => card.id === humanDraftSelection.sanctuaryId)
    const needsRegion = activeMatch.round < activeMatch.maxRounds && activeMatch.market.length > 0
    const needsSanctuary = activeHumanPlayer.pendingSanctuaries.length > 0

    return (
      <section className="phase-panel phase-draft" key={`draft-${activeMatch.round}-${currentPlayer?.id ?? 'none'}-${activeMatch.draftIndex}`}>
        <div className="phase-copy">
          <span className="phase-tag">Marktphase</span>
          <h2>{isHumanTurn ? `${activeHumanPlayer.name}, du bist mit dem Draft dran.` : `${currentPlayer?.name} draftet gerade.`}</h2>
          <p>
            Die Draft-Reihenfolge beginnt bei der niedrigsten Dauer. Nimm eine Region aus dem Markt und sichere danach ein Refugium aus deinen Funden.
          </p>
        </div>

        <div className="draft-columns">
          <div className="draft-column">
            <div className="column-heading">
              <span>Markt</span>
              <strong>{activeMatch.round === activeMatch.maxRounds ? 'In Runde 8 geschlossen' : 'Waehle eine Region'}</strong>
            </div>
            <div className="card-grid compact-grid">
              {activeMatch.market.length === 0 ? <div className="strip-empty">In diesem Schritt gibt es keinen Marktdraft.</div> : null}
              {activeMatch.market.map((card) => (
                <CardFace
                  card={card}
                  compact
                  key={card.id}
                  onClick={
                    isHumanTurn
                      ? () => {
                          playSound('select')
                          updateHumanDraft({ regionId: card.id })
                        }
                      : undefined
                  }
                  selectable={isHumanTurn && activeMatch.round < activeMatch.maxRounds}
                  selected={humanDraftSelection.regionId === card.id}
                  dimmed={isHumanTurn && Boolean(humanDraftSelection.regionId) && humanDraftSelection.regionId !== card.id}
                />
              ))}
            </div>
          </div>

          <div className="draft-column">
            <div className="column-heading">
              <span>Offene Refugien</span>
              <strong>{activeHumanPlayer.pendingSanctuaries.length > 0 ? 'Waehle eins zum Behalten' : 'Kein Refugiumsbonus in dieser Runde'}</strong>
            </div>
            <div className="card-grid compact-grid">
              {activeHumanPlayer.pendingSanctuaries.length === 0 ? <div className="strip-empty">Hier gibt es nichts auszuwaehlen.</div> : null}
              {activeHumanPlayer.pendingSanctuaries.map((card) => (
                <CardFace
                  card={card}
                  compact
                  key={card.id}
                  onClick={
                    isHumanTurn
                      ? () => {
                          playSound('select')
                          updateHumanDraft({ sanctuaryId: card.id })
                        }
                      : undefined
                  }
                  selectable={isHumanTurn}
                  selected={humanDraftSelection.sanctuaryId === card.id}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="draft-action-bar">
          <div className="draft-selection-status">
            <span>Auswahlstatus</span>
            <strong>
              {needsRegion
                ? selectedMarketCard
                  ? `Region bereit: ${selectedMarketCard.title}`
                  : 'Region fehlt'
                : 'Kein Marktpick noetig'}
            </strong>
            <p>
              {needsSanctuary
                ? selectedSanctuary
                  ? `Refugium gesichert: ${selectedSanctuary.title}`
                  : 'Refugium fehlt'
                : 'Kein Refugium in dieser Runde erforderlich'}
            </p>
          </div>

          {isHumanTurn ? (
            <button
              className="primary-button draft-confirm-button"
              disabled={!humanDraftCanConfirm(activeMatch)}
              onClick={() => {
                playSound('lock')
                setMatch((current) => (current ? confirmHumanDraft(current) : current))
              }}
              type="button"
            >
              Draft bestaetigen
            </button>
          ) : (
            <div className="waiting-chip draft-waiting-chip">Warte auf {currentPlayer?.name} ...</div>
          )}
        </div>
      </section>
    )
  }

  function renderFinished(activeMatch: MatchState) {
    const activeStanding = standings[Math.min(scoreReveal.playerIndex, Math.max(standings.length - 1, 0))]
    const revealActionLabel = getRevealActionLabel(scoreReveal, activeStanding, standings.length)
    const finalScreenVisible = scoreReveal.complete || standings.length === 0
    const winnerName = standings[0]?.playerName ?? 'Der Tisch'

    return (
      <section className="phase-panel phase-finished" key={`finished-${activeMatch.round}`}>
        <div className="phase-copy">
          <span className="phase-tag">{finalScreenVisible ? 'Endscore' : 'Live-Wertung'}</span>
          <h2>{finalScreenVisible ? `${winnerName} fuehrt den Atlas an.` : 'Oeffne die Wertung Karte fuer Karte.'}</h2>
          <p>
            {finalScreenVisible
              ? dailySummary.join('  |  ')
              : 'Der Host klickt weiter, alle koennen die gleiche Spannungswertung am Tisch verfolgen.'}
          </p>
        </div>
        {finalScreenVisible ? <FinalScoreboard standings={standings} /> : <ScoreRevealCeremony reveal={scoreReveal} standings={standings} />}
        <div className={`phase-actions ${finalScreenVisible ? 'final-actions' : ''}`}>
          {!finalScreenVisible ? (
            <>
              <button className="primary-button" onClick={advanceScoreReveal} type="button">
                {revealActionLabel}
              </button>
              <button className="ghost-button" onClick={skipScoreReveal} type="button">
                Skip zum Endscore
              </button>
            </>
          ) : (
            <>
              <section className="final-rematch-panel">
                <div className="final-rematch-copy">
                  <span>Neustart</span>
                  <strong>Waehle direkt deine naechste Variante.</strong>
                </div>
                <div className="final-variant-grid">
                  {restartModeOrder.map((mode) => (
                    <button
                      className={`variant-restart-button ${mode === activeMatch.config.mode ? 'is-current' : ''}`}
                      key={mode}
                      onClick={() => restartFromScore(activeMatch, mode)}
                      style={{ '--mode-accent': modeMeta[mode].accent } as CSSProperties}
                      type="button"
                    >
                      <span>{mode === activeMatch.config.mode ? 'Revanche' : 'Variante'}</span>
                      <strong>{modeMeta[mode].title}</strong>
                      <em>{modeMeta[mode].summary}</em>
                    </button>
                  ))}
                </div>
              </section>
              <button
                className="ghost-button final-menu-button"
                onClick={() => {
                  playSound('tap')
                  syncFinishedStats(activeMatch)
                  setMatch(null)
                  setScoreReveal(createScoreRevealState())
                }}
                type="button"
              >
                Zurueck zum Menue
              </button>
            </>
          )}
        </div>
      </section>
    )
  }

  if (!match || !human) {
    return renderMenu()
  }

  return (
    <main className="screen screen-game" data-phase={match.phase}>
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <div className="noise-layer" />
      <div className="hud-head">
        {renderTopBar(match)}
        <RulesDrawer open={rulesOpen} />
        <section className="command-rail">
          {commandRailItems.map((item) => (
            <article className="command-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>
      </div>

      <section className="playfield">
        <div className="playfield-main">
          {match.phase === 'opening-hand' && activeHuman ? renderOpeningSelection(match, activeHuman) : null}
          {match.phase === 'choose-region' && activeHuman ? renderChooseRegion(match, activeHuman) : null}
          {match.phase === 'reveal' ? renderReveal(match) : null}
          {match.phase === 'draft' ? renderDraft(match, activeHuman ?? human) : null}
          {match.phase === 'finished' ? renderFinished(match) : null}
        </div>

        <aside className="side-panel">
          <div className="side-section side-section-roster">
            <span>Tischuebersicht</span>
            <div className="roster-list">
              {match.players.map((player) => {
                const avatar = getAvatarForPlayer(player.id, player.avatarId)
                const isActiveSeat =
                  (match.phase === 'draft' && currentPlayer?.id === player.id) ||
                  ((match.phase === 'opening-hand' || match.phase === 'choose-region') && activeHuman?.id === player.id)

                return (
                  <button
                    className={[
                      'roster-entry',
                      player.kind === 'human' ? 'is-human' : '',
                      isActiveSeat ? 'is-active' : '',
                      inspectedPlayerId === player.id ? 'is-highlighted' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={player.id}
                    onClick={() => {
                      playSound('tap')
                      setInspectedPlayerId((current) => (current === player.id ? null : player.id))
                    }}
                    type="button"
                  >
                    <img alt={`${player.name} avatar`} className="roster-avatar" src={avatar} />
                    <div className="roster-copy">
                      <div className="roster-headline">
                        <span>{player.kind === 'human' ? 'Platz' : 'Rivale'}</span>
                        <strong>{player.name}</strong>
                      </div>
                      <div className="roster-stats">
                        <span>R {player.tableau.length}/8</span>
                        <span>S {player.sanctuaries.length}</span>
                        <span>Ruhm {player.scorePreview}</span>
                      </div>
                      <p>{buildPlayerStatusLine(player)}</p>
                    </div>
                    <span className="roster-cta">Details</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="side-section side-section-market">
            <span>Marktpuls</span>
            <div className="market-mini-list">
              {match.market.length === 0 ? <p>Der Markt ist aktuell leer.</p> : null}
              {match.market.map((card) => (
                <button
                  className="market-mini"
                  key={card.id}
                  onClick={() => {
                    if (match.phase === 'draft' && currentPlayer?.kind === 'human') {
                      playSound('select')
                      updateHumanDraft({ regionId: card.id })
                    }
                  }}
                  type="button"
                >
                  <strong>{card.title}</strong>
                  <span>{card.duration}h</span>
                </button>
              ))}
            </div>
          </div>

          <div className="side-section side-section-log">
            <span>Expeditionslog</span>
            <div className="log-list">
              {match.log.slice(0, 4).map((entry) => (
                <p key={entry}>{entry}</p>
              ))}
            </div>
          </div>

          <div className="side-section side-section-echo">
            <span>{viewedHuman ? `Echo-Ziffern von ${viewedHuman.name}` : 'Echo-Ziffern'}</span>
            <div className="digit-row">
              {humanEchoDigits.length === 0 ? <p>Noch keine Meteorechos.</p> : null}
              {humanEchoDigits.map((digit) => (
                <span className="digit-chip" key={digit}>
                  {digit}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {inspectedPlayer ? (
        <PlayerInspectModal
          echoDigits={getPlayerDigitEchoes(inspectedPlayer, match.config.mode)}
          mode={match.config.mode}
          onClose={() => setInspectedPlayerId(null)}
          player={inspectedPlayer}
        />
      ) : null}

      {phaseAnnouncement ? (
        <div className="phase-marquee">
          <span>{phaseLabels[match.phase]}</span>
          <strong>{phaseAnnouncement.title}</strong>
          <p>{phaseAnnouncement.detail}</p>
        </div>
      ) : null}
    </main>
  )
}

export default App
