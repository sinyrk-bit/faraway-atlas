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
import avatar1 from '../assets/avatars/avatar-1.svg'
import avatar2 from '../assets/avatars/avatar-2.svg'
import avatar3 from '../assets/avatars/avatar-3.svg'
import avatar4 from '../assets/avatars/avatar-4.svg'
import avatar5 from '../assets/avatars/avatar-5.svg'
import avatar6 from '../assets/avatars/avatar-6.svg'
import type { PlayCard } from './types'

const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6]
const artPools = {
  river: [riverArt, riverArt2, riverArt3],
  city: [cityArt, cityArt2, cityArt3],
  forest: [forestArt, forestArt2, forestArt3],
  desert: [desertArt, desertArt2, desertArt3],
  sanctuary: [sanctuaryArt, sanctuaryArt2, sanctuaryArt3],
} as const

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

export function getCardArt(card: PlayCard) {
  if (card.cardType === 'sanctuary') {
    const sanctuarySeed = hashString(`${card.id}:${card.title}:${card.linkedBiome ?? 'neutral'}`)
    return pickVariant(artPools.sanctuary, sanctuarySeed)
  }

  const biomePool = artPools[card.biome]
  const regionSeed = card.serial + (card.meteor ? 1 : 0) + card.duration + (card.time === 'night' ? 2 : 0)
  return pickVariant(biomePool, regionSeed)
}

export function getAvatarForPlayer(playerId: string) {
  const numericId = Number(playerId.split('-').at(-1) ?? 0)
  return avatars[numericId % avatars.length]
}
