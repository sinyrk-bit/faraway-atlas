export type SoundCue = 'tap' | 'select' | 'lock' | 'turn' | 'reveal' | 'draft' | 'victory'

type Note = {
  at: number
  frequency: number
  duration: number
  volume: number
  type?: OscillatorType
  glideTo?: number
}

export class AtlasAudioEngine {
  private context?: AudioContext

  private enabled = true

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  async play(cue: SoundCue) {
    if (!this.enabled || typeof window === 'undefined') {
      return
    }

    const context = this.ensureContext()
    if (context.state === 'suspended') {
      await context.resume()
    }

    const startAt = context.currentTime + 0.01
    this.sequence(startAt, this.cueNotes(cue))
  }

  private ensureContext() {
    if (!this.context) {
      this.context = new window.AudioContext()
    }

    return this.context
  }

  private cueNotes(cue: SoundCue): Note[] {
    switch (cue) {
      case 'tap':
        return [
          { at: 0, frequency: 520, duration: 0.08, volume: 0.04, type: 'triangle', glideTo: 660 },
          { at: 0.04, frequency: 760, duration: 0.06, volume: 0.025, type: 'sine' },
        ]
      case 'select':
        return [
          { at: 0, frequency: 392, duration: 0.1, volume: 0.045, type: 'triangle', glideTo: 468 },
          { at: 0.05, frequency: 586, duration: 0.1, volume: 0.03, type: 'sine' },
        ]
      case 'lock':
        return [
          { at: 0, frequency: 320, duration: 0.09, volume: 0.05, type: 'square', glideTo: 360 },
          { at: 0.08, frequency: 480, duration: 0.12, volume: 0.04, type: 'triangle', glideTo: 620 },
        ]
      case 'turn':
        return [
          { at: 0, frequency: 260, duration: 0.12, volume: 0.04, type: 'triangle', glideTo: 420 },
          { at: 0.1, frequency: 520, duration: 0.08, volume: 0.026, type: 'sine' },
        ]
      case 'reveal':
        return [
          { at: 0, frequency: 220, duration: 0.18, volume: 0.05, type: 'sawtooth', glideTo: 300 },
          { at: 0.12, frequency: 330, duration: 0.16, volume: 0.04, type: 'triangle', glideTo: 520 },
          { at: 0.24, frequency: 640, duration: 0.12, volume: 0.03, type: 'sine' },
        ]
      case 'draft':
        return [
          { at: 0, frequency: 310, duration: 0.09, volume: 0.045, type: 'square', glideTo: 280 },
          { at: 0.05, frequency: 620, duration: 0.07, volume: 0.025, type: 'triangle' },
        ]
      case 'victory':
        return [
          { at: 0, frequency: 392, duration: 0.18, volume: 0.045, type: 'triangle', glideTo: 440 },
          { at: 0.14, frequency: 523.25, duration: 0.18, volume: 0.04, type: 'triangle', glideTo: 659.25 },
          { at: 0.28, frequency: 783.99, duration: 0.28, volume: 0.05, type: 'sine' },
          { at: 0.36, frequency: 659.25, duration: 0.34, volume: 0.035, type: 'triangle', glideTo: 880 },
        ]
      default:
        return []
    }
  }

  private sequence(startAt: number, notes: Note[]) {
    const context = this.ensureContext()

    notes.forEach((note) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = note.type ?? 'sine'
      oscillator.frequency.setValueAtTime(note.frequency, startAt + note.at)
      if (note.glideTo) {
        oscillator.frequency.exponentialRampToValueAtTime(
          note.glideTo,
          startAt + note.at + note.duration,
        )
      }

      gain.gain.setValueAtTime(0.0001, startAt + note.at)
      gain.gain.exponentialRampToValueAtTime(note.volume, startAt + note.at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + note.at + note.duration)

      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(startAt + note.at)
      oscillator.stop(startAt + note.at + note.duration + 0.02)
    })
  }
}
