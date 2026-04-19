import type { CSSProperties } from 'react'
import { biomeMeta } from '../game/content'
import { getAvatarForPlayer } from '../game/visuals'
import type { PlayerState } from '../game/types'

interface PlayerRowProps {
  player: PlayerState
  active?: boolean
  human?: boolean
  scoreLabel?: string
  echoDigits?: number[]
}

function totals(player: PlayerState) {
  return {
    clues:
      player.tableau.reduce((sum, card) => sum + card.clues, 0) +
      player.sanctuaries.reduce((sum, card) => sum + card.clues, 0),
    uddu:
      player.tableau.reduce((sum, card) => sum + card.resources.uddu, 0) +
      player.sanctuaries.reduce((sum, card) => sum + card.resources.uddu, 0),
    okiko:
      player.tableau.reduce((sum, card) => sum + card.resources.okiko, 0) +
      player.sanctuaries.reduce((sum, card) => sum + card.resources.okiko, 0),
    goldlog:
      player.tableau.reduce((sum, card) => sum + card.resources.goldlog, 0) +
      player.sanctuaries.reduce((sum, card) => sum + card.resources.goldlog, 0),
  }
}

export function PlayerRow({ player, active = false, human = false, scoreLabel, echoDigits = [] }: PlayerRowProps) {
  const resourceTotals = totals(player)
  const routeSlots = Array.from({ length: 8 }, (_, index) => player.tableau[index] ?? null)
  const avatar = getAvatarForPlayer(player.id)

  return (
    <section className={`player-row ${active ? 'is-active' : ''} ${human ? 'is-human' : ''}`}>
      <header className="player-row-header">
        <div className="player-id-block">
          <img alt={`${player.name} avatar`} className="player-avatar" src={avatar} />
          <div>
            <span className="player-role">{human ? 'You' : 'Rival'}</span>
            <h2>{player.name}</h2>
          </div>
        </div>
        <div className="player-score">
          <span>Projected Fame</span>
          <strong>{scoreLabel ?? `${player.scorePreview}`}</strong>
        </div>
      </header>

      <div className="player-summary-badges">
        <span className="summary-badge">S {player.sanctuaries.length}</span>
        <span className="summary-badge">C {resourceTotals.clues}</span>
        <span className="summary-badge">U {resourceTotals.uddu}</span>
        <span className="summary-badge">O {resourceTotals.okiko}</span>
        <span className="summary-badge">G {resourceTotals.goldlog}</span>
      </div>

      <div className="route-grid">
        {routeSlots.map((card, index) =>
          card ? (
            <article
              className={`route-slot ${card.id === player.tableau.at(-1)?.id ? 'is-latest' : ''} ${echoDigits.includes(card.serial % 10) ? 'is-echoing' : ''}`}
              key={card.id}
              style={{ '--slot-accent': biomeMeta[card.biome].accent } as CSSProperties}
            >
              <div className="route-slot-top">
                <strong>{card.serial}</strong>
                <span>{card.duration}h</span>
              </div>
              <div className="route-slot-bottom">
                <span>{biomeMeta[card.biome].short.slice(0, 2)}</span>
                <span>{card.time === 'night' ? 'N' : 'D'}</span>
                {card.meteor ? <span>M</span> : null}
              </div>
            </article>
          ) : (
            <div className="route-slot route-slot-empty" key={`${player.id}-empty-${index}`}>
              <span>{index + 1}</span>
            </div>
          ),
        )}
      </div>

      <div className="sanctuary-chip-row">
        {player.sanctuaries.length === 0 ? <div className="strip-empty compact-empty">No sanctuaries yet.</div> : null}
        {player.sanctuaries.map((card) => (
          <div className="sanctuary-chip" key={card.id}>
            <strong>{card.title}</strong>
            <span>{card.linkedBiome ? biomeMeta[card.linkedBiome].short : 'Wild'}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
