import { startTransition, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import './App.css'
import { CardFace } from './components/CardFace'
import { PlayerRow } from './components/PlayerRow'
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
      {match.revealEntries.map((entry) => {
        const player = match.players.find((candidate) => candidate.id === entry.playerId)
        return (
          <article className="reveal-card" key={entry.playerId}>
            <div>
              <span>{player?.name}</span>
              <strong>{entry.card.title}</strong>
            </div>
            <div className="reveal-meta">
              <span>{entry.card.duration}h</span>
              <span>{entry.card.time}</span>
            </div>
            <p>
              {entry.foundSanctuary
                ? `${entry.sanctuaryCount} Sanctuary option${entry.sanctuaryCount === 1 ? '' : 's'} unlocked.`
                : 'No Sanctuary found this round.'}
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
        <span>Core Loop</span>
        <p>Play one region per round, reveal simultaneously, then draft from the market in ascending duration order.</p>
      </div>
      <div className="rules-block">
        <span>Sanctuaries</span>
        <p>You find sanctuaries only when the region you just played has a higher duration than the region before it.</p>
      </div>
      <div className="rules-block">
        <span>Scoring</span>
        <p>At the end, region cards score from right to left. Earlier cards only see what has already been revealed, plus all sanctuaries.</p>
      </div>
      <div className="rules-block">
        <span>Starfall Variant</span>
        <p>Meteor cards stay visible during scoring and make all regions with the same last digit visible too.</p>
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
        <span>{rank === 0 ? 'Winner' : `#${rank + 1}`}</span>
        <div>
          <h3>{player.playerName}</h3>
          <strong>{player.total} Fame</strong>
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

  useEffect(() => {
    updateProfile(profile)
  }, [profile])

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
  }, [match])

  useEffect(() => {
    if (!match || match.phase !== 'finished') {
      return
    }

    const timer = window.setInterval(() => {
      setFocusedStandingEntry((value) => value + 1)
    }, 1400)

    return () => window.clearInterval(timer)
  }, [match])

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
      playerName: profile.playerName || 'Explorer',
      humanCount,
      aiCount: totalPlayers - humanCount,
      difficulty: profile.preferredDifficulty,
      seed: (profile.preferredSeed || todaySeed).trim() || todaySeed,
    }

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
    setInviteStatus('Invite link copied.')
    window.setTimeout(() => setInviteStatus(''), 1800)
  }

  function syncFinishedStats(activeMatch: MatchState) {
    const latestStandings = buildFinalStandings(activeMatch)
    const bestScore = bestScoreFromStandings(latestStandings, profile.playerName || 'Explorer')
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
            <p className="eyebrow">Unofficial premium tribute build</p>
            <h1>Faraway Atlas</h1>
            <p className="hero-text">
              A polished browser adaptation with reverse scoring, sanctuary chaining, multiple variants and AI rivals built for instant testing on GitHub and Render.
            </p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => startMatch()} type="button">
                Start Expedition
              </button>
              <button
                className="ghost-button"
                onClick={() => {
                  patchProfile({ preferredSeed: todaySeed })
                  startMatch('starfall')
                }}
                type="button"
              >
                Play Daily Starfall
              </button>
              <button className="ghost-button" onClick={() => void copyInviteLink()} type="button">
                Copy Invite Link
              </button>
            </div>
            {inviteStatus ? <div className="invite-status">{inviteStatus}</div> : null}
          </div>

          <div className="hero-panel">
            <div className="panel-section">
              <span className="panel-label">Play Styles</span>
              <div className="mode-grid">
                {(['classic', 'advanced', 'starfall'] as MatchMode[]).map((mode) => (
                  <ModeTile
                    active={profile.preferredMode === mode}
                    key={mode}
                    mode={mode}
                    onSelect={(value) => patchProfile({ preferredMode: value })}
                  />
                ))}
              </div>
            </div>

            <div className="panel-section settings-grid">
              <label className="field">
                <span>Explorer Name</span>
                <input
                  onChange={(event) => patchProfile({ playerName: event.target.value })}
                  placeholder="Explorer"
                  value={profile.playerName}
                />
              </label>

              <label className="field">
                <span>Seed</span>
                <input
                  onChange={(event) => patchProfile({ preferredSeed: event.target.value })}
                  placeholder={todaySeed}
                  value={profile.preferredSeed}
                />
              </label>

              <div className="field">
                <span>Total Players</span>
                <div className="segment-row">
                  {[2, 3, 4, 5, 6].map((count) => (
                    <SegmentButton
                      current={String(profile.preferredTotalPlayers)}
                      key={count}
                      onClick={(value) =>
                        patchProfile({
                          preferredTotalPlayers: Number(value),
                          preferredHumanCount: Math.min(profile.preferredHumanCount, Number(value)),
                        })
                      }
                      value={String(count)}
                    >
                      {count}
                    </SegmentButton>
                  ))}
                </div>
              </div>

              <div className="field">
                <span>Human Seats</span>
                <div className="segment-row">
                  {Array.from({ length: profile.preferredTotalPlayers }, (_, index) => index + 1).map((count) => (
                    <SegmentButton
                      current={String(profile.preferredHumanCount)}
                      key={count}
                      onClick={(value) => patchProfile({ preferredHumanCount: Number(value) })}
                      value={String(count)}
                    >
                      {count}
                    </SegmentButton>
                  ))}
                </div>
                <p className="field-hint">
                  {profile.preferredTotalPlayers - profile.preferredHumanCount} AI seat
                  {profile.preferredTotalPlayers - profile.preferredHumanCount === 1 ? '' : 's'}.
                </p>
              </div>

              <div className="field">
                <span>Difficulty</span>
                <div className="segment-row">
                  {(['wanderer', 'pathfinder', 'oracle'] as Difficulty[]).map((difficulty) => (
                    <SegmentButton
                      current={profile.preferredDifficulty}
                      key={difficulty}
                      onClick={(value) => patchProfile({ preferredDifficulty: value })}
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
                <span>Best Score</span>
                <strong>{profile.lastBestScore || '--'}</strong>
              </article>
              <article>
                <span>Last Winner</span>
                <strong>{profile.lastWinner || '--'}</strong>
              </article>
              <article>
                <span>Mode</span>
                <strong>{modeMeta[profile.preferredMode].title}</strong>
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
          <span className="eyebrow">Round {activeMatch.round} / {activeMatch.maxRounds}</span>
          <h1>{modeMeta[activeMatch.config.mode].title}</h1>
        </div>
        <div className="top-bar-metrics">
          <div>
            <span>Seed</span>
            <strong>{activeMatch.seedLabel}</strong>
          </div>
          <div>
            <span>Phase</span>
            <strong>{activeMatch.phase.replace('-', ' ')}</strong>
          </div>
          <button className="ghost-button" onClick={() => setRulesOpen((value) => !value)} type="button">
            {rulesOpen ? 'Hide Rules' : 'Show Rules'}
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
            Copy Table Link
          </button>
        </div>
      </header>
    )
  }

  function renderOpeningSelection(activeMatch: MatchState, activeHumanPlayer: PlayerState) {
    return (
      <section className="phase-panel">
        <div className="phase-copy">
          <span className="phase-tag">Opening Draft</span>
          <h2>{activeHumanPlayer.name}, keep three of your five opening regions.</h2>
          <p>Advanced mode front-loads the puzzle. Pass the device after locking the current seat if multiple friends are playing locally.</p>
        </div>
        <div className="card-grid">
          {activeHumanPlayer.hand.map((card) => (
            <CardFace
              card={card}
              compact
              key={card.id}
              onClick={() => setMatch((current) => (current ? selectOpeningRegion(current, card.id) : current))}
              selectable
              selected={activeMatch.openingSelectionIds.includes(card.id)}
            />
          ))}
        </div>
        <button
          className="primary-button"
          disabled={!activeMatch.openingReady}
          onClick={() => setMatch((current) => (current ? confirmOpeningSelection(current) : current))}
          type="button"
        >
          Lock Opening Hand
        </button>
      </section>
    )
  }

  function renderChooseRegion(activeMatch: MatchState, activeHumanPlayer: PlayerState) {
    return (
      <section className="phase-panel">
        <div className="phase-copy">
          <span className="phase-tag">Choose Region</span>
          <h2>{activeHumanPlayer.name}, plot your next step.</h2>
          <p>Lower duration means earlier draft priority. Higher duration can unlock sanctuaries if you outpace your previous card.</p>
        </div>
        <div className="card-grid">
          {activeHumanPlayer.hand.map((card) => (
            <CardFace
              card={card}
              compact
              key={card.id}
              onClick={() => setMatch((current) => (current ? selectRegionToPlay(current, card.id) : current))}
              selectable
              selected={activeMatch.selectedRegionId === card.id}
            />
          ))}
        </div>
        <div className="phase-actions">
          <button
            className="primary-button"
            disabled={!activeMatch.selectedRegionId}
            onClick={() => setMatch((current) => (current ? confirmRegionChoice(current) : current))}
            type="button"
          >
            Lock Seat Choice
          </button>
          {selectedHandCard ? (
            <div className="selection-preview">
              <span>Locked card</span>
              <strong>{selectedHandCard.title}</strong>
            </div>
          ) : null}
        </div>
      </section>
    )
  }

  function renderReveal(activeMatch: MatchState) {
    return (
      <section className="phase-panel">
        <div className="phase-copy">
          <span className="phase-tag">Reveal</span>
          <h2>The table resolves in tempo order.</h2>
          <p>Fast routes draft first. Sanctuary checks happen before the market draft and can reshape the entire round.</p>
        </div>
        <RevealSummary match={activeMatch} />
        <button className="primary-button" onClick={() => setMatch((current) => (current ? beginDraftPhase(current) : current))} type="button">
          Continue To Draft
        </button>
      </section>
    )
  }

  function renderDraft(activeMatch: MatchState, activeHumanPlayer: PlayerState) {
    const isHumanTurn = currentPlayer?.id === activeHumanPlayer.id

    return (
      <section className="phase-panel phase-draft">
        <div className="phase-copy">
          <span className="phase-tag">Draft</span>
          <h2>{isHumanTurn ? `${activeHumanPlayer.name}, it is your turn to draft.` : `${currentPlayer?.name} is drafting.`}</h2>
          <p>
            Draft order follows the lowest duration first. Claim one region from the market, then keep one sanctuary from any set you discovered.
          </p>
        </div>

        <div className="draft-columns">
          <div className="draft-column">
            <div className="column-heading">
              <span>Market</span>
              <strong>{activeMatch.round === activeMatch.maxRounds ? 'Closed on round 8' : 'Pick one region'}</strong>
            </div>
            <div className="card-grid compact-grid">
              {activeMatch.market.length === 0 ? <div className="strip-empty">No market draft this step.</div> : null}
              {activeMatch.market.map((card) => (
                <CardFace
                  card={card}
                  compact
                  key={card.id}
                  onClick={
                    isHumanTurn
                      ? () => updateHumanDraft({ regionId: card.id })
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
              <span>Pending Sanctuaries</span>
              <strong>{activeHumanPlayer.pendingSanctuaries.length > 0 ? 'Choose one to keep' : 'No sanctuary reward this round'}</strong>
            </div>
            <div className="card-grid compact-grid">
              {activeHumanPlayer.pendingSanctuaries.length === 0 ? <div className="strip-empty">Nothing to choose here.</div> : null}
              {activeHumanPlayer.pendingSanctuaries.map((card) => (
                <CardFace
                  card={card}
                  compact
                  key={card.id}
                  onClick={isHumanTurn ? () => updateHumanDraft({ sanctuaryId: card.id }) : undefined}
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
            onClick={() => setMatch((current) => (current ? confirmHumanDraft(current) : current))}
            type="button"
          >
            Confirm Draft
          </button>
        ) : (
          <div className="waiting-chip">Waiting for {currentPlayer?.name}...</div>
        )}
      </section>
    )
  }

  function renderFinished(activeMatch: MatchState) {
    return (
      <section className="phase-panel phase-finished">
        <div className="phase-copy">
          <span className="phase-tag">Final Fame</span>
          <h2>{standings[0]?.playerName} leads the atlas.</h2>
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
              syncFinishedStats(activeMatch)
              startMatch(activeMatch.config.mode)
            }}
            type="button"
          >
            Rematch Same Mode
          </button>
          <button
            className="ghost-button"
            onClick={() => {
              syncFinishedStats(activeMatch)
              setMatch(null)
            }}
            type="button"
          >
            Return To Menu
          </button>
        </div>
      </section>
    )
  }

  if (!match || !human) {
    return renderMenu()
  }

  return (
    <main className="screen screen-game">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      {renderTopBar(match)}
      <RulesDrawer open={rulesOpen} />

      <section className="playfield">
        <div className="playfield-main">
          {match.phase === 'opening-hand' && activeHuman ? renderOpeningSelection(match, activeHuman) : null}
          {match.phase === 'choose-region' && activeHuman ? renderChooseRegion(match, activeHuman) : null}
          {match.phase === 'reveal' ? renderReveal(match) : null}
          {match.phase === 'draft' ? renderDraft(match, activeHuman ?? human) : null}
          {match.phase === 'finished' ? renderFinished(match) : null}

          <section className="rivals-stack" style={{ gridTemplateColumns: playerGridColumns }}>
            {match.players.map((player) => (
              <PlayerRow
                active={currentPlayer?.id === player.id && match.phase === 'draft'}
                echoDigits={getPlayerDigitEchoes(player, match.config.mode)}
                human={player.id === human.id}
                key={player.id}
                player={player}
              />
            ))}
          </section>
        </div>

        <aside className="side-panel">
          <div className="side-section">
            <span>Market Pulse</span>
            <div className="market-mini-list">
              {match.market.length === 0 ? <p>Market is currently empty.</p> : null}
              {match.market.map((card) => (
                <button
                  className="market-mini"
                  key={card.id}
                  onClick={() => {
                    if (match.phase === 'draft' && currentPlayer?.kind === 'human') {
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
            <span>Expedition Log</span>
            <div className="log-list">
              {match.log.slice(0, 5).map((entry) => (
                <p key={entry}>{entry}</p>
              ))}
            </div>
          </div>

          <div className="side-section">
            <span>{viewedHuman ? `${viewedHuman.name}'s Echo Digits` : 'Echo Digits'}</span>
            <div className="digit-row">
              {humanEchoDigits.length === 0 ? <p>No meteor echoes yet.</p> : null}
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
