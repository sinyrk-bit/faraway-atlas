import cityArt from '../assets/card-art/city-cyberpunk.jpg'
import cityArt2 from '../assets/card-art/city-cyberpunk-2.jpg'
import cityArt3 from '../assets/card-art/city-cyberpunk-3.jpg'
import desertArt from '../assets/card-art/desert-cyberpunk.jpg'
import desertArt2 from '../assets/card-art/desert-cyberpunk-2.jpg'
import desertArt3 from '../assets/card-art/desert-cyberpunk-3.jpg'
import forestArt from '../assets/card-art/forest-cyberpunk.jpg'
import forestArt2 from '../assets/card-art/forest-cyberpunk-2.jpg'
import forestArt3 from '../assets/card-art/forest-cyberpunk-3.jpg'
import riverArt from '../assets/card-art/river-cyberpunk.jpg'
import riverArt2 from '../assets/card-art/river-cyberpunk-2.jpg'
import riverArt3 from '../assets/card-art/river-cyberpunk-3.jpg'
import sanctuaryArt from '../assets/card-art/sanctuary-cyberpunk.jpg'
import sanctuaryArt2 from '../assets/card-art/sanctuary-cyberpunk-2.jpg'
import sanctuaryArt3 from '../assets/card-art/sanctuary-cyberpunk-3.jpg'
import avatarCyber1 from '../assets/avatars/avatar-cyber-01.jpg'
import avatarCyber2 from '../assets/avatars/avatar-cyber-02.jpg'
import avatarCyber3 from '../assets/avatars/avatar-cyber-03.jpg'
import avatarCyber4 from '../assets/avatars/avatar-cyber-04.jpg'
import avatarCyber5 from '../assets/avatars/avatar-cyber-05.jpg'
import avatarCyber6 from '../assets/avatars/avatar-cyber-06.jpg'
import avatarCyber7 from '../assets/avatars/avatar-cyber-07.jpg'
import avatarCyber8 from '../assets/avatars/avatar-cyber-08.jpg'
import avatarCyber9 from '../assets/avatars/avatar-cyber-09.jpg'
import avatarCyber10 from '../assets/avatars/avatar-cyber-10.jpg'
import type { PlayCard } from './types'

export interface CardArtTreatment {
  src: string
  position: string
  transform: string
  filter: string
  riftX: string
  riftY: string
  bloomX: string
  bloomY: string
}

export const availableAvatars = [
  { id: 'cyber-01', label: 'Cyan Visier', src: avatarCyber1 },
  { id: 'cyber-02', label: 'Nacht-Orakel', src: avatarCyber2 },
  { id: 'cyber-03', label: 'Duenenlaeufer', src: avatarCyber3 },
  { id: 'cyber-04', label: 'Myzel-Scout', src: avatarCyber4 },
  { id: 'cyber-05', label: 'Kanal-Pilot', src: avatarCyber5 },
  { id: 'cyber-06', label: 'Archivistin', src: avatarCyber6 },
  { id: 'cyber-07', label: 'Dusk-Ranger', src: avatarCyber7 },
  { id: 'cyber-08', label: 'Void-Mechanik', src: avatarCyber8 },
  { id: 'cyber-09', label: 'Schrein-Wache', src: avatarCyber9 },
  { id: 'cyber-10', label: 'Sternen-Karte', src: avatarCyber10 },
] as const

const artPools = {
  river: [riverArt, riverArt2, riverArt3],
  city: [cityArt, cityArt2, cityArt3],
  forest: [forestArt, forestArt2, forestArt3],
  desert: [desertArt, desertArt2, desertArt3],
  sanctuary: [sanctuaryArt, sanctuaryArt2, sanctuaryArt3],
} as const

const generatedCardArt = import.meta.glob('../assets/card-art/generated/*.svg', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

function hashString(value: string) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function pickVariant<T>(items: readonly T[], seed: number) {
  return items[seed % items.length]
}

function buildCardVisualSeed(card: PlayCard) {
  if (card.cardType === 'sanctuary') {
    return hashString(`${card.id}:${card.title}:${card.linkedBiome ?? 'neutral'}:${card.clues}:${card.bonusNight}`)
  }

  return hashString(`${card.id}:${card.serial}:${card.title}:${card.biome}:${card.time}:${card.meteor ? 'meteor' : 'base'}`)
}

export function getAvatarById(avatarId?: string) {
  if (!avatarId) {
    return availableAvatars[0].src
  }

  return availableAvatars.find((avatar) => avatar.id === avatarId)?.src ?? availableAvatars[0].src
}

export function getCardArt(card: PlayCard) {
  const generated = generatedCardArt[`../assets/card-art/generated/${card.id}.svg`]
  if (generated) {
    return generated
  }

  if (card.cardType === 'sanctuary') {
    const sanctuarySeed = buildCardVisualSeed(card)
    return pickVariant(artPools.sanctuary, sanctuarySeed)
  }

  const biomePool = artPools[card.biome]
  const regionSeed = buildCardVisualSeed(card)
  return pickVariant(biomePool, regionSeed)
}

export function getCardArtTreatment(card: PlayCard): CardArtTreatment {
  const seed = buildCardVisualSeed(card)
  const src = getCardArt(card)
  const positionX = 10 + (seed % 76)
  const positionY = 12 + ((seed >>> 6) % 58)
  const scale = 1.08 + ((seed >>> 12) % 12) * 0.025
  const rotate = ((seed >>> 17) % 13) - 6
  const flip = ((seed >>> 21) & 1) === 0 ? 1 : -1
  const saturate = 0.94 + ((seed >>> 4) % 9) * 0.07
  const brightness = 0.9 + ((seed >>> 10) % 7) * 0.04
  const contrast = 0.96 + ((seed >>> 15) % 5) * 0.06
  const hueShift = ((seed >>> 22) % 17) - 8

  return {
    src,
    position: `${positionX}% ${positionY}%`,
    transform: `scale(${(flip * scale).toFixed(3)}, ${scale.toFixed(3)}) rotate(${rotate}deg)`,
    filter: `saturate(${saturate.toFixed(2)}) brightness(${brightness.toFixed(2)}) contrast(${contrast.toFixed(2)}) hue-rotate(${hueShift}deg)`,
    riftX: `${8 + ((seed >>> 3) % 72)}%`,
    riftY: `${8 + ((seed >>> 8) % 28)}%`,
    bloomX: `${64 + ((seed >>> 19) % 24)}%`,
    bloomY: `${10 + ((seed >>> 24) % 26)}%`,
  }
}

export function getAvatarForPlayer(playerId: string, avatarId?: string) {
  if (avatarId) {
    return getAvatarById(avatarId)
  }

  const numericId = Number(playerId.split('-').at(-1) ?? 0)
  return availableAvatars[numericId % availableAvatars.length].src
}
