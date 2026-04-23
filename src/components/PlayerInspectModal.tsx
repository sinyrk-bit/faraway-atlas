import { biomeMeta } from '../game/content'
import { getAvatarForPlayer } from '../game/visuals'
import type { MatchMode, PlayerState } from '../game/types'
import { CardFace } from './CardFace'

interface PlayerInspectModalProps {
  player: PlayerState
  mode: MatchMode
  echoDigits: number[]
  onClose: () => void
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

export function PlayerInspectModal({ player, mode, echoDigits, onClose }: PlayerInspectModalProps) {
  const avatar = getAvatarForPlayer(player.id, player.avatarId)
  const resourceTotals = totals(player)

  return (
    <div
      aria-modal="true"
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
    >
      <section
        className="modal-panel player-inspect-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="player-inspect-header">
          <div className="player-inspect-id">
            <img alt={`${player.name} avatar`} className="player-inspect-avatar" src={avatar} />
            <div>
              <span className="player-role">{player.kind === 'human' ? 'Platz' : 'Rivale'}</span>
              <h2>{player.name}</h2>
              <p>{mode === 'starfall' ? 'Sternensturz-Wertung aktiv.' : 'Standardwertung aktiv.'}</p>
            </div>
          </div>

          <div className="player-inspect-metrics">
            <div className="summary-badge">R {player.tableau.length}/8</div>
            <div className="summary-badge">S {player.sanctuaries.length}</div>
            <div className="summary-badge">C {resourceTotals.clues}</div>
            <div className="summary-badge">U {resourceTotals.uddu}</div>
            <div className="summary-badge">O {resourceTotals.okiko}</div>
            <div className="summary-badge">G {resourceTotals.goldlog}</div>
            <div className="summary-badge">Ruhm {player.scorePreview}</div>
          </div>

          <button className="ghost-button" onClick={onClose} type="button">
            Schließen
          </button>
        </header>

        <div className="player-inspect-meta">
          <div className="player-inspect-chipline">
            <span className="strip-heading">Echo-Ziffern</span>
            <div className="digit-row">
              {echoDigits.length === 0 ? <p>Keine aktiven Meteorechos.</p> : null}
              {echoDigits.map((digit) => (
                <span className="digit-chip" key={`${player.id}-digit-${digit}`}>
                  {digit}
                </span>
              ))}
            </div>
          </div>

          <div className="player-inspect-chipline">
            <span className="strip-heading">Biomfokus</span>
            <div className="player-inspect-badges">
              {Object.entries(biomeMeta).map(([biome, meta]) => {
                const count =
                  player.tableau.filter((card) => card.biome === biome).length +
                  player.sanctuaries.filter((card) => card.linkedBiome === biome).length

                return (
                  <span className="summary-badge" key={`${player.id}-${biome}`} style={{ borderColor: meta.accent }}>
                    {meta.short} {count}
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        <section className="player-inspect-section">
          <div className="strip-heading">
            <span>Gespielte Regionen</span>
            <strong>{player.tableau.length > 0 ? 'Alle offenen Infos' : 'Noch keine Region gespielt'}</strong>
          </div>
          <div className="inspect-card-grid">
            {player.tableau.length === 0 ? <div className="strip-empty">Hier liegen noch keine Regionen.</div> : null}
            {player.tableau.map((card) => (
              <CardFace
                card={card}
                compact
                echoing={echoDigits.includes(card.serial % 10)}
                key={card.id}
              />
            ))}
          </div>
        </section>

        <section className="player-inspect-section">
          <div className="strip-heading">
            <span>Heiligtümer</span>
            <strong>{player.sanctuaries.length > 0 ? 'Unterstützung und Endspielpunkte' : 'Noch keine Heiligtümer gesichert'}</strong>
          </div>
          <div className="inspect-card-grid inspect-card-grid-sanctuaries">
            {player.sanctuaries.length === 0 ? <div className="strip-empty">Noch keine Heiligtümer vorhanden.</div> : null}
            {player.sanctuaries.map((card) => (
              <CardFace card={card} compact key={card.id} />
            ))}
          </div>
        </section>
      </section>
    </div>
  )
}
