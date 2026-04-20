import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import './App.css'
import { CardFace } from './components/CardFace'
import { PlayerRow } from './components/PlayerRow'
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
import type {
  Difficulty,
  DraftSelection,
  MatchConfig,
  MatchMode,
  MatchState,
  PersistedProfile,
  PlayerState,
} from './game/types'

type MatchSnapshot = {
  phase: MatchState['phase']
  round: number
  draftIndex: number
  revealCount: number
  activeHumanPlayerId?: string
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

function StandingPanel({
  player,
  rank,
  focusedEntryIndex,
}: {
  player: ReturnType<typeof buildFinalStandings>[number]
  rank: number
  focusedEntryIndex: number
}) {
  return (
    <article className={`standing-panel ${rank === 0 ? 'is-winner' : ''}`}>
      <header>
        <span>{rank === 0 ? 'Sieger' : `#${rank + 1}`}</span>
        <div>
          <h3>{player.playerName}</h3>
          <strong>{player.total} Ruhm</strong>
        </div>
      </header>
      <div className="standing-breakdown">
        {player.entries.slice(0, 8).map((entry, index) => (
          <div className={`standing-entry ${focusedEntryIndex % Math.max(player.entries.length, 1) === index ? 'is-focused' : ''}`} key={entry.sourceId}>
            <span>{entry.sourceName}</span>
            <strong>{entry.points}</strong>
          </div>
        ))}
      </div>
    </article>
  )
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
  const [focusedStandingEntry, setFocusedStandingEntry] = useState(0)
  const [inviteStatus, setInviteStatus] = useState('')
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
    if (!match || match.phase !== 'finished') {
      return
    }

    const timer = window.setInterval(() => {
      setFocusedStandingEntry((value) => value + 1)
    }, 1400)

    return () => window.clearInterval(timer)
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

    if (previousSnapshot) {
      if (previousSnapshot.phase !== match.phase) {
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
      } else if (previousSnapshot.revealCount !== match.revealEntries.length && match.phase === 'reveal') {
        playSound('reveal')
      }
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
  const playerGridColumns = match
    ? match.players.length <= 2
      ? '1fr'
      : match.players.length <= 4
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(3, minmax(0, 1fr))'
    : '1fr'

  function patchProfile(patch: Partial<PersistedProfile>) {
    setProfile((current) => ({
      ...current,
      ...patch,
    }))
  }

  function startMatch(modeOverride?: MatchMode) {
    const mode = modeOverride ?? profile.preferredMode
    const totalPlayers = Math.min(6, Math.max(2, profile.preferredTotalPlayers))
    const humanCount = Math.min(totalPlayers, Math.max(1, profile.preferredHumanCount))
    const config: MatchConfig = {
      mode,
      playerName: profile.playerName || 'Erkunder',
      humanCount,
      aiCount: totalPlayers - humanCount,
      difficulty: profile.preferredDifficulty,
      seed: (profile.preferredSeed || todaySeed).trim() || todaySeed,
    }

    playSound('lock')
    startTransition(() => {
      setMatch(createMatch(config))
      setFocusedStandingEntry(0)
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
          </div>
        </section>
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

        {isHumanTurn ? (
          <button
            className="primary-button"
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
          <div className="waiting-chip">Warte auf {currentPlayer?.name} ...</div>
        )}
      </section>
    )
  }

  function renderFinished(activeMatch: MatchState) {
    return (
      <section className="phase-panel phase-finished" key={`finished-${activeMatch.round}`}>
        <div className="phase-copy">
          <span className="phase-tag">Endwert</span>
          <h2>{standings[0]?.playerName} fuehrt den Atlas an.</h2>
          <p>{dailySummary.join('  |  ')}</p>
        </div>
        <div className="standings-grid">
          {standings.map((standing, index) => (
            <StandingPanel focusedEntryIndex={focusedStandingEntry} key={standing.playerId} player={standing} rank={index} />
          ))}
        </div>
        <div className="phase-actions">
          <button
            className="primary-button"
            onClick={() => {
              playSound('lock')
              syncFinishedStats(activeMatch)
              startMatch(activeMatch.config.mode)
            }}
            type="button"
          >
            Revanche im selben Modus
          </button>
          <button
            className="ghost-button"
            onClick={() => {
              playSound('tap')
              syncFinishedStats(activeMatch)
              setMatch(null)
            }}
            type="button"
          >
            Zurueck zum Menue
          </button>
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
      <div className="hud-head">
        {renderTopBar(match)}
        <RulesDrawer open={rulesOpen} />
      </div>

      <section className="playfield">
        <div className="playfield-main">
          {match.phase === 'opening-hand' && activeHuman ? renderOpeningSelection(match, activeHuman) : null}
          {match.phase === 'choose-region' && activeHuman ? renderChooseRegion(match, activeHuman) : null}
          {match.phase === 'reveal' ? renderReveal(match) : null}
          {match.phase === 'draft' ? renderDraft(match, activeHuman ?? human) : null}
          {match.phase === 'finished' ? renderFinished(match) : null}

          <section className="rivals-stack" data-count={match.players.length} style={{ gridTemplateColumns: playerGridColumns }}>
            {match.players.map((player) => (
              <PlayerRow
                active={currentPlayer?.id === player.id && match.phase === 'draft'}
                echoDigits={getPlayerDigitEchoes(player, match.config.mode)}
                human={player.kind === 'human'}
                key={player.id}
                player={player}
              />
            ))}
          </section>
        </div>

        <aside className="side-panel">
          <div className="side-section">
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

          <div className="side-section">
            <span>Expeditionslog</span>
            <div className="log-list">
              {match.log.slice(0, 4).map((entry) => (
                <p key={entry}>{entry}</p>
              ))}
            </div>
          </div>

          <div className="side-section">
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
    </main>
  )
}

export default App
