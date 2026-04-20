import { availableAvatars } from '../game/visuals'

interface AvatarPickerProps {
  selectedId: string
  onSelect: (avatarId: string) => void
}

export function AvatarPicker({ selectedId, onSelect }: AvatarPickerProps) {
  return (
    <div className="avatar-picker-grid">
      {availableAvatars.map((avatar) => (
        <button
          className={`avatar-choice ${selectedId === avatar.id ? 'is-selected' : ''}`}
          key={avatar.id}
          onClick={() => onSelect(avatar.id)}
          type="button"
        >
          <img alt={avatar.label} className="avatar-choice-image" src={avatar.src} />
          <span>{avatar.label}</span>
        </button>
      ))}
    </div>
  )
}
