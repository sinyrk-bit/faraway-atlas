import type { CSSProperties } from 'react'
import clueIcon from '../assets/icons/clue-icon.png'
import goldlogIcon from '../assets/icons/goldlog-icon.png'
import meteorIcon from '../assets/icons/meteor-icon.png'
import moonSymbolIcon from '../assets/icons/moon-symbol-clean.png'
import okikoIcon from '../assets/icons/okiko-icon.png'
import sanctuaryIcon from '../assets/icons/sanctuary-icon.png'
import sunSymbolIcon from '../assets/icons/sun-symbol-clean.png'
import udduIcon from '../assets/icons/uddu-icon.png'
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
  river: '≈',
  city: '■',
  forest: '▲',
  desert: '◆',
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
  className?: string
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
  const artStats: ArtStat[] =
    card.cardType === 'region'
      ? [
          { key: 'serial', label: `${card.serial}`, title: `Karte ${card.serial}`, className: 'is-serial' },
          { key: 'biome', label: biomeSigils[card.biome], title: biomeMeta[card.biome].label, className: 'is-biome' },
          {
            key: 'time',
            iconSrc: card.time === 'night' ? moonSymbolIcon : sunSymbolIcon,
            title: card.time === 'night' ? 'Nachtkarte' : 'Tageskarte',
            imageClassName: 'card-art-stat-symbol',
            className: 'is-time',
          },
        ]
      : [
          { key: 'sanctuary', iconSrc: sanctuaryIcon, title: 'Refugium', imageClassName: 'card-art-stat-symbol', className: 'is-serial' },
          {
            key: 'biome',
            label: card.linkedBiome ? biomeSigils[card.linkedBiome] : '◇',
            title: card.linkedBiome ? biomeMeta[card.linkedBiome].label : 'Neutral',
            className: 'is-biome',
          },
          {
            key: 'rarity',
            label: card.rarity === 'rare' ? '◆◆' : '◆',
            title: card.rarity === 'rare' ? 'Selten' : 'Gewoehnlich',
            className: 'is-time',
          },
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
              <span
                className={['card-art-stat', item.className].filter(Boolean).join(' ')}
                key={`${card.id}-${item.key}`}
                title={item.title}
              >
                {item.iconSrc ? <img alt="" className={item.imageClassName ?? 'card-art-stat-symbol'} src={item.iconSrc} /> : null}
                {item.label ? <span className="card-art-stat-text">{item.label}</span> : null}
              </span>
            ))}
          </div>
          {'meteor' in card && card.meteor ? (
            <span className="card-art-badge" title="Meteorspur">
              <img alt="" className="card-art-stat-symbol" src={meteorIcon} />
            </span>
          ) : null}
          <div className="card-art-symbol-overlay" aria-label={card.title}>
            {quest ? (
              <div className="card-art-symbol-cluster is-score" title="Punkte">
                <span className="card-score-badge" title={`${questPoints} Punkte`}>
                  <span className="card-score-star">✦</span>
                  <span>{questPoints}</span>
                </span>
                {questItems.map((item) => (
                  <SymbolChip compact item={item} key={`${card.id}-quest-${item.key}`} />
                ))}
              </div>
            ) : null}
            {prerequisiteItems.length > 0 ? (
              <div className="card-art-symbol-cluster is-need" title="Benoetigt">
                {prerequisiteItems.map((item) => (
                  <SymbolChip compact item={item} key={`${card.id}-need-${item.key}`} />
                ))}
              </div>
            ) : null}
            {counters.length > 0 ? (
              <div className="card-art-symbol-cluster is-gain" title="Gibt">
                {counters.map((item) => (
                  <SymbolChip compact item={item} key={`${card.id}-counter-${item.key}`} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  )
}
