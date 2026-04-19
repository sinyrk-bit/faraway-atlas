import type { CSSProperties } from 'react'
import { biomeMeta, resourceMeta } from '../game/content'
import type { PlayCard, RegionCard, SanctuaryCard } from '../game/types'

interface CardFaceProps {
  card: PlayCard
  compact?: boolean
  selected?: boolean
  selectable?: boolean
  highlight?: boolean
  echoing?: boolean
  dimmed?: boolean
  onClick?: () => void
}

function ResourceBadges({ card }: { card: RegionCard | SanctuaryCard }) {
  const tokens = Object.entries(card.resources).flatMap(([resource, count]) =>
    Array.from({ length: count }, (_, index) => (
      <span className="token token-resource" key={`${card.id}-${resource}-${index}`}>
        <span
          className="token-sigil"
          style={{ '--accent': resourceMeta[resource as keyof typeof resourceMeta].accent } as CSSProperties}
        >
          {resourceMeta[resource as keyof typeof resourceMeta].glyph}
        </span>
        {resourceMeta[resource as keyof typeof resourceMeta].label}
      </span>
    )),
  )

  if (card.clues > 0) {
    tokens.push(
      ...Array.from({ length: card.clues }, (_, index) => (
        <span className="token token-clue" key={`${card.id}-clue-${index}`}>
          <span className="token-sigil">CL</span>
          Clue
        </span>
      )),
    )
  }

  if ('bonusNight' in card && card.bonusNight > 0) {
    tokens.push(
      ...Array.from({ length: card.bonusNight }, (_, index) => (
        <span className="token token-night" key={`${card.id}-night-${index}`}>
          <span className="token-sigil">NT</span>
          Night
        </span>
      )),
    )
  }

  return <div className="card-tokens">{tokens.length > 0 ? tokens : <span className="token token-empty">No icons</span>}</div>
}

export function CardFace({
  card,
  compact = false,
  selected = false,
  selectable = false,
  highlight = false,
  echoing = false,
  dimmed = false,
  onClick,
}: CardFaceProps) {
  const biome = card.cardType === 'region' ? card.biome : card.linkedBiome
  const accent = biome ? biomeMeta[biome].accent : '#f4d79d'
  const classes = [
    'card-face',
    `card-face-${card.cardType}`,
    compact ? 'is-compact' : '',
    selected ? 'is-selected' : '',
    selectable ? 'is-selectable' : '',
    highlight ? 'is-highlighted' : '',
    echoing ? 'is-echoing' : '',
    dimmed ? 'is-dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={classes}
      onClick={onClick}
      style={{ '--card-accent': accent } as CSSProperties}
      type="button"
    >
      <div className="card-glow" />
      <div className="card-topline">
        <span className="card-type">{card.cardType === 'region' ? 'Region' : 'Sanctuary'}</span>
        {'serial' in card ? <span className="card-serial">#{card.serial}</span> : null}
      </div>

      <header className="card-header">
        <div>
          <h3>{card.title}</h3>
          <p>{card.subtitle}</p>
        </div>
        {'duration' in card ? (
          <div className="card-meta">
            <span className="card-duration">{card.duration}h</span>
            <span className={`card-time card-time-${card.time}`}>{card.time}</span>
          </div>
        ) : (
          <div className="card-meta">
            <span className="card-duration">{card.linkedBiome ? biomeMeta[card.linkedBiome].short : 'Wild'}</span>
          </div>
        )}
      </header>

      {card.cardType === 'region' ? (
        <div className="card-flags">
          <span className="card-flag" style={{ borderColor: biomeMeta[card.biome].accent }}>
            {biomeMeta[card.biome].short}
          </span>
          {card.meteor ? <span className="card-flag card-flag-meteor">Meteor</span> : null}
          <span className={`card-flag card-flag-${card.rarity}`}>{card.rarity}</span>
        </div>
      ) : (
        <div className="card-flags">
          {card.linkedBiome ? (
            <span className="card-flag" style={{ borderColor: biomeMeta[card.linkedBiome].accent }}>
              Counts as {biomeMeta[card.linkedBiome].short}
            </span>
          ) : (
            <span className="card-flag">Freeform</span>
          )}
          <span className={`card-flag card-flag-${card.rarity}`}>{card.rarity}</span>
        </div>
      )}

      <ResourceBadges card={card} />

      <section className="card-quest">
        <strong>Quest</strong>
        <p>{'quest' in card && card.quest ? card.quest.label : 'Adds support icons only.'}</p>
        {'quest' in card && card.quest?.prerequisite ? <span>{card.quest.prerequisite.label}</span> : null}
      </section>

      {!compact ? <footer className="card-flavor">{card.flavor}</footer> : null}
    </button>
  )
}
