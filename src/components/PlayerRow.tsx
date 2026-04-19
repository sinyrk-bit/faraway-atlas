import { CardFace } from './CardFace'
import type { PlayerState } from '../game/types'

interface PlayerRowProps {
  player: PlayerState
  active?: boolean
  human?: boolean
  scoreLabel?: string
  echoDigits?: number[]
}

export function PlayerRow({ player, active = false, human = false, scoreLabel, echoDigits = [] }: PlayerRowProps) {
  return (
    <section className={`player-row ${active ? 'is-active' : ''} ${human ? 'is-human' : ''}`}>
      <header className="player-row-header">
        <div>
          <span className="player-role">{human ? 'You' : 'Rival'}</span>
          <h2>{player.name}</h2>
        </div>
        <div className="player-score">
          <span>Projected Fame</span>
          <strong>{scoreLabel ?? `${player.scorePreview}`}</strong>
        </div>
      </header>

      <div className="player-strip">
        <div className="player-strip-column">
          <div className="strip-heading">
            <span>Route</span>
            <strong>{player.tableau.length} cards</strong>
          </div>
          <div className="mini-card-row">
            {player.tableau.length === 0 ? <div className="strip-empty">No regions yet.</div> : null}
            {player.tableau.map((card) => (
              <CardFace
                card={card}
                compact
                key={card.id}
                echoing={echoDigits.includes(card.serial % 10)}
                highlight={card.id === player.tableau.at(-1)?.id}
              />
            ))}
          </div>
        </div>

        <div className="player-strip-column">
          <div className="strip-heading">
            <span>Sanctuaries</span>
            <strong>{player.sanctuaries.length}</strong>
          </div>
          <div className="mini-card-row">
            {player.sanctuaries.length === 0 ? <div className="strip-empty">No sanctuaries claimed.</div> : null}
            {player.sanctuaries.map((card) => (
              <CardFace card={card} compact key={card.id} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
