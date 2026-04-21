import type { CSSProperties } from 'react'
import clueIcon from '../assets/icons/clue-icon.jpg'
import goldlogIcon from '../assets/icons/goldlog-icon.jpg'
import meteorIcon from '../assets/icons/meteor-icon.jpg'
import moonSymbolIcon from '../assets/icons/moon-symbol.png'
import okikoIcon from '../assets/icons/okiko-icon.jpg'
import sanctuaryIcon from '../assets/icons/sanctuary-icon.jpg'
import sunSymbolIcon from '../assets/icons/sun-symbol.png'
import udduIcon from '../assets/icons/uddu-icon.jpg'
import { biomeMeta, resourceMeta } from '../game/content'
import { getCardArtTreatment } from '../game/visuals'
import type { Biome, PlayCard, Prerequisite, Quest, RegionCard, ResourceType, SanctuaryCard } from '../game/types'

interface CardFaceProps {
  card: PlayCard
  compact?: boolean
  minimal?: boolean
  selected?: boolean
  selectable?: boolean
  highlight?: boolean
  echoing?: boolean
  dimmed?: boolean
  onClick?: () => void
}

const rarityLabels = {
  common: 'Gewoehnlich',
  rare: 'Selten',
  mythic: 'Mythisch',
} as const

type IconArtKey = 'uddu' | 'okiko' | 'goldlog' | 'clue' | 'night' | 'sanctuary' | 'meteor'

const iconArt: Record<IconArtKey, string> = {
  uddu: udduIcon,
  okiko: okikoIcon,
  goldlog: goldlogIcon,
  clue: clueIcon,
  night: moonSymbolIcon,
  sanctuary: sanctuaryIcon,
  meteor: meteorIcon,
}

const biomeSigils: Record<Biome, string> = {
  river: 'KN',
  city: 'ST',
  forest: 'WA',
  desert: 'WU',
}

const iconMeta = {
  uddu: { glyph: 'UD', accent: resourceMeta.uddu.accent, label: 'Uddu', iconKey: 'uddu' as const },
  okiko: { glyph: 'OK', accent: resourceMeta.okiko.accent, label: 'Okiko', iconKey: 'okiko' as const },
  goldlog: { glyph: 'GL', accent: resourceMeta.goldlog.accent, label: 'Goldlog', iconKey: 'goldlog' as const },
  clue: { glyph: 'CL', accent: '#9eeaff', label: 'Spur', iconKey: 'clue' as const },
  night: { glyph: 'NT', accent: '#93a2ff', label: 'Nacht', iconKey: 'night' as const },
  sanctuary: { glyph: 'RF', accent: '#ffd78d', label: 'Refugium', iconKey: 'sanctuary' as const },
  digit: { glyph: '##', accent: '#ffd85f', label: 'Endziffer' },
  set: { glyph: 'S4', accent: '#9dff9a', label: 'Viererset' },
  flat: { glyph: 'FX', accent: '#f2f6ff', label: 'Fixwert' },
} as const

type SymbolItem = {
  key: string
  glyph: string
  label: string
  accent: string
  value?: number | string
  iconKey?: IconArtKey
}

type ArtStat = {
  key: string
  label?: string
  iconSrc?: string
  title: string
  imageClassName?: string
}

function buildBiomeItem(biome: Biome): SymbolItem {
  return {
    key: `biome-${biome}`,
    glyph: biomeSigils[biome],
    label: biomeMeta[biome].short,
    accent: biomeMeta[biome].accent,
  }
}

function buildResourceItem(resource: ResourceType, count: number): SymbolItem {
  return {
    key: `${resource}-${count}`,
    glyph: iconMeta[resource].glyph,
    label: iconMeta[resource].label,
    accent: iconMeta[resource].accent,
    value: count,
    iconKey: iconMeta[resource].iconKey,
  }
}

function buildCounterItems(card: RegionCard | SanctuaryCard) {
  const items = Object.entries(card.resources).flatMap(([resource, count]) =>
    count > 0 ? [buildResourceItem(resource as ResourceType, count)] : [],
  )

  if (card.clues > 0) {
    items.push({
      key: `clue-${card.clues}`,
      glyph: iconMeta.clue.glyph,
      label: iconMeta.clue.label,
      accent: iconMeta.clue.accent,
      value: card.clues,
      iconKey: iconMeta.clue.iconKey,
    })
  }

  if ('bonusNight' in card && card.bonusNight > 0) {
    items.push({
      key: `night-${card.bonusNight}`,
      glyph: iconMeta.night.glyph,
      label: iconMeta.night.label,
      accent: iconMeta.night.accent,
      value: card.bonusNight,
      iconKey: iconMeta.night.iconKey,
    })
  }

  return items
}

function buildQuestItems(quest?: Quest) {
  if (!quest) {
    return [] as SymbolItem[]
  }

  switch (quest.type) {
    case 'per-resource':
      return [
        {
          key: `quest-${quest.type}-${quest.resource}`,
          glyph: iconMeta[quest.resource].glyph,
          label: iconMeta[quest.resource].label,
          accent: iconMeta[quest.resource].accent,
          iconKey: iconMeta[quest.resource].iconKey,
        },
      ]
    case 'per-biome':
      return quest.biomes.map((biome) => buildBiomeItem(biome))
    case 'set':
      return [
        {
          key: `quest-${quest.type}`,
          glyph: iconMeta.set.glyph,
          label: iconMeta.set.label,
          accent: iconMeta.set.accent,
        },
      ]
    case 'per-night':
      return [
        {
          key: `quest-${quest.type}`,
          glyph: iconMeta.night.glyph,
          label: iconMeta.night.label,
          accent: iconMeta.night.accent,
          iconKey: iconMeta.night.iconKey,
        },
      ]
    case 'per-sanctuary':
      return [
        {
          key: `quest-${quest.type}`,
          glyph: iconMeta.sanctuary.glyph,
          label: iconMeta.sanctuary.label,
          accent: iconMeta.sanctuary.accent,
          iconKey: iconMeta.sanctuary.iconKey,
        },
      ]
    case 'per-digit-match':
      return [
        {
          key: `quest-${quest.type}`,
          glyph: iconMeta.digit.glyph,
          label: iconMeta.digit.label,
          accent: iconMeta.digit.accent,
        },
      ]
    case 'flat':
      return [
        {
          key: `quest-${quest.type}`,
          glyph: iconMeta.flat.glyph,
          label: iconMeta.flat.label,
          accent: iconMeta.flat.accent,
        },
      ]
    default:
      return []
  }
}

function buildPrerequisiteItems(prerequisite?: Prerequisite) {
  if (!prerequisite) {
    return [] as SymbolItem[]
  }

  switch (prerequisite.type) {
    case 'resource':
      return [
        {
          key: `need-${prerequisite.resource}`,
          glyph: iconMeta[prerequisite.resource].glyph,
          label: iconMeta[prerequisite.resource].label,
          accent: iconMeta[prerequisite.resource].accent,
          value: prerequisite.count,
          iconKey: iconMeta[prerequisite.resource].iconKey,
        },
      ]
    case 'resources':
      return prerequisite.resources.map((entry) => ({
        key: `need-${entry.resource}-${entry.count}`,
        glyph: iconMeta[entry.resource].glyph,
        label: iconMeta[entry.resource].label,
        accent: iconMeta[entry.resource].accent,
        value: entry.count,
        iconKey: iconMeta[entry.resource].iconKey,
      }))
    case 'clues':
      return [
        {
          key: `need-clues-${prerequisite.count}`,
          glyph: iconMeta.clue.glyph,
          label: iconMeta.clue.label,
          accent: iconMeta.clue.accent,
          value: prerequisite.count,
          iconKey: iconMeta.clue.iconKey,
        },
      ]
    case 'night':
      return [
        {
          key: `need-night-${prerequisite.count}`,
          glyph: iconMeta.night.glyph,
          label: iconMeta.night.label,
          accent: iconMeta.night.accent,
          value: prerequisite.count,
          iconKey: iconMeta.night.iconKey,
        },
      ]
    case 'biome':
      return [
        {
          ...buildBiomeItem(prerequisite.biome),
          key: `need-${prerequisite.biome}-${prerequisite.count}`,
          value: prerequisite.count,
        },
      ]
    case 'sanctuary':
      return [
        {
          key: `need-sanctuary-${prerequisite.count}`,
          glyph: iconMeta.sanctuary.glyph,
          label: iconMeta.sanctuary.label,
          accent: iconMeta.sanctuary.accent,
          value: prerequisite.count,
          iconKey: iconMeta.sanctuary.iconKey,
        },
      ]
    default:
      return []
  }
}

function SymbolChip({ item, compact = false }: { item: SymbolItem; compact?: boolean }) {
  return (
    <span
      className={`symbol-chip ${compact ? 'is-compact' : ''}`}
      style={{ '--symbol-accent': item.accent } as CSSProperties}
      title={item.value !== undefined ? `${item.label} ${item.value}` : item.label}
    >
      <span className="symbol-chip-sigil">
        {item.iconKey ? <img alt="" className="symbol-chip-icon" src={iconArt[item.iconKey]} /> : item.glyph}
      </span>
      {item.value !== undefined ? <span className="symbol-chip-value">{item.value}</span> : null}
      {!compact ? <span className="symbol-chip-label">{item.label}</span> : null}
    </span>
  )
}

export function CardFace({
  card,
  compact = false,
  minimal = false,
  selected = false,
  selectable = false,
  highlight = false,
  echoing = false,
  dimmed = false,
  onClick,
}: CardFaceProps) {
  const biome = card.cardType === 'region' ? card.biome : card.linkedBiome
  const accent = biome ? biomeMeta[biome].accent : '#f4d79d'
  const secondaryAccent =
    card.cardType === 'region'
      ? card.time === 'night'
        ? '#9aa2ff'
        : '#ffd786'
      : card.rarity === 'rare'
        ? '#b58cff'
        : '#ffe29a'
  const art = getCardArtTreatment(card)
  const counters = buildCounterItems(card)
  const quest = 'quest' in card ? card.quest : undefined
  const questItems = buildQuestItems(quest)
  const prerequisiteItems = buildPrerequisiteItems(quest?.prerequisite)
  const questPoints = quest?.points ?? 0
  const artDescription = card.cardType === 'region' ? card.quest.label : card.quest?.label ?? card.subtitle
  const visibleCounterItems = counters.slice(0, 3)
  const visibleQuestItems = questItems.slice(0, 3)
  const visiblePrerequisiteItems = prerequisiteItems.slice(0, 3)
  const artStats: ArtStat[] =
    card.cardType === 'region'
      ? [
          { key: 'serial', label: `#${card.serial}`, title: `Karte ${card.serial}` },
          { key: 'biome', label: biomeSigils[card.biome], title: biomeMeta[card.biome].label },
          {
            key: 'time',
            iconSrc: card.time === 'night' ? moonSymbolIcon : sunSymbolIcon,
            title: card.time === 'night' ? 'Nachtkarte' : 'Tageskarte',
            imageClassName: 'card-art-stat-symbol',
          },
        ]
      : [
          { key: 'sanctuary', label: 'RF', title: 'Refugium' },
          {
            key: 'biome',
            label: card.linkedBiome ? biomeSigils[card.linkedBiome] : 'NE',
            title: card.linkedBiome ? biomeMeta[card.linkedBiome].label : 'Neutral',
          },
          { key: 'rarity', label: card.rarity === 'rare' ? 'SR' : 'GE', title: card.rarity === 'rare' ? 'Selten' : 'Gewoehnlich' },
        ]
  const classes = [
    'card-face',
    `card-face-${card.cardType}`,
    compact ? 'is-compact' : '',
    minimal ? 'is-minimal' : '',
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
      style={
        {
          '--card-accent': accent,
          '--card-secondary': secondaryAccent,
          '--card-orbit': `${'serial' in card ? (card.serial * 13) % 100 : (card.title.length * 17) % 100}%`,
          '--card-rift-x': art.riftX,
          '--card-rift-y': art.riftY,
          '--card-bloom-x': art.bloomX,
          '--card-bloom-y': art.bloomY,
        } as CSSProperties
      }
      type="button"
    >
      <div className="card-glow" />
      <div className="card-topline">
        <span className="card-type">{card.cardType === 'region' ? 'Region' : 'Refugium'}</span>
        {'serial' in card ? <span className="card-serial">#{card.serial}</span> : null}
      </div>

      <div className="card-art-wrap">
        <div className="card-art-shell">
          <img
            alt={card.cardType === 'region' ? `${card.title} Biombild` : `${card.title} Refugiumsbild`}
            className="card-art-image"
            src={art.src}
            style={{
              objectPosition: art.position,
              transform: art.transform,
              filter: art.filter,
            }}
          />
          <div className="card-art-overlay card-art-overlay-top">
            {artStats.map((item) => (
              <span className="card-art-stat" key={`${card.id}-${item.key}`} title={item.title}>
                {item.iconSrc ? (
                  <img alt="" className={item.imageClassName ?? 'card-art-stat-symbol'} src={item.iconSrc} />
                ) : (
                  item.label
                )}
              </span>
            ))}
          </div>
          <div className="card-art-overlay card-art-overlay-intel">
            <div className="card-art-data-rail">
              <div className="card-art-data-group is-score">
                <strong>+{questPoints}</strong>
                {visibleQuestItems.length > 0 ? (
                  visibleQuestItems.map((item) => (
                    <SymbolChip compact item={item} key={`${card.id}-art-quest-${item.key}`} />
                  ))
                ) : (
                  <span className="card-art-mini-label">Fix</span>
                )}
              </div>
              {visiblePrerequisiteItems.length > 0 ? (
                <div className="card-art-data-group is-need">
                  <span>!</span>
                  {visiblePrerequisiteItems.map((item) => (
                    <SymbolChip compact item={item} key={`${card.id}-art-need-${item.key}`} />
                  ))}
                </div>
              ) : null}
              {visibleCounterItems.length > 0 ? (
                <div className="card-art-data-group is-gain">
                  <span>+</span>
                  {visibleCounterItems.map((item) => (
                    <SymbolChip compact item={item} key={`${card.id}-art-counter-${item.key}`} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="card-art-description">
            <strong>{card.subtitle}</strong>
            <span>{artDescription}</span>
          </div>
          {'meteor' in card && card.meteor ? <span className="card-art-badge">Meteorspur</span> : null}
        </div>
      </div>

      <section className="card-info-panel">
        <header className="card-header">
          <div>
            <h3>{card.title}</h3>
            <p>{card.subtitle}</p>
          </div>
          <div className="card-meta">
            <span className="card-duration">
              {card.cardType === 'region'
                ? `#${card.serial}`
                : card.linkedBiome
                  ? biomeMeta[card.linkedBiome].short
                  : 'Neutral'}
            </span>
          </div>
        </header>

        <div className="card-symbol-board">
          <div className="card-symbol-main">
            <span className="card-score-badge">+{questPoints}</span>
            <div className="card-score-track">
              {questItems.length > 0 ? (
                questItems.map((item) => <SymbolChip compact item={item} key={`${card.id}-quest-${item.key}`} />)
              ) : (
                <span className="card-symbol-empty">Fix</span>
              )}
            </div>
          </div>
          {prerequisiteItems.length > 0 ? (
            <div className="card-symbol-row is-need" title="Benoetigt">
              <span>!</span>
              <div className="card-score-track">
                {prerequisiteItems.map((item) => (
                  <SymbolChip compact item={item} key={`${card.id}-need-${item.key}`} />
                ))}
              </div>
            </div>
          ) : null}
          {counters.length > 0 ? (
            <div className="card-symbol-row is-gain" title="Gibt">
              <span>+</span>
              <div className="card-score-track">
                {counters.map((item) => (
                  <SymbolChip compact item={item} key={`${card.id}-counter-${item.key}`} />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {card.cardType === 'region' ? (
          <div className="card-flags">
            <span className="card-flag" style={{ borderColor: biomeMeta[card.biome].accent }}>
              {biomeMeta[card.biome].short}
            </span>
            {card.meteor ? <span className="card-flag card-flag-meteor">Meteor</span> : null}
            <span className={`card-flag card-flag-${card.rarity}`}>{rarityLabels[card.rarity]}</span>
          </div>
        ) : (
          <div className="card-flags">
            {card.linkedBiome ? (
              <span className="card-flag" style={{ borderColor: biomeMeta[card.linkedBiome].accent }}>
                Zaehlt als {biomeMeta[card.linkedBiome].short}
              </span>
            ) : (
              <span className="card-flag">Neutral</span>
            )}
            <span className={`card-flag card-flag-${card.rarity}`}>{rarityLabels[card.rarity]}</span>
          </div>
        )}

        {!compact ? (
          <section className="card-quest">
            <strong>Auftrag</strong>
            <p>{'quest' in card && card.quest ? card.quest.label : 'Liefert nur Stuetzsymbole.'}</p>
            {'quest' in card && card.quest?.prerequisite ? <span>{card.quest.prerequisite.label}</span> : null}
          </section>
        ) : null}

        {!compact ? <footer className="card-flavor">{card.flavor}</footer> : null}
      </section>
    </button>
  )
}
