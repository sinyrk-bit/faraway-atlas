import cityArt from '../assets/card-art/city-cyberpunk.jpg'
import desertArt from '../assets/card-art/desert-cyberpunk.jpg'
import forestArt from '../assets/card-art/forest-cyberpunk.jpg'
import riverArt from '../assets/card-art/river-cyberpunk.jpg'
import sanctuaryArt from '../assets/card-art/sanctuary-cyberpunk.jpg'
import avatar1 from '../assets/avatars/avatar-1.svg'
import avatar2 from '../assets/avatars/avatar-2.svg'
import avatar3 from '../assets/avatars/avatar-3.svg'
import avatar4 from '../assets/avatars/avatar-4.svg'
import avatar5 from '../assets/avatars/avatar-5.svg'
import avatar6 from '../assets/avatars/avatar-6.svg'
import type { PlayCard } from './types'

const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6]

export function getCardArt(card: PlayCard) {
  if (card.cardType === 'sanctuary') {
    return sanctuaryArt
  }

  switch (card.biome) {
    case 'river':
      return riverArt
    case 'city':
      return cityArt
    case 'forest':
      return forestArt
    case 'desert':
      return desertArt
    default:
      return sanctuaryArt
  }
}

export function getAvatarForPlayer(playerId: string) {
  const numericId = Number(playerId.split('-').at(-1) ?? 0)
  return avatars[numericId % avatars.length]
}
