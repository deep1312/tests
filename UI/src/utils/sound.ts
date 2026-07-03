let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

export function playAlertSound(): void {
  try {
    const ctx = getAudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, ctx.currentTime)
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.25)
  } catch {
    // Audio not available — silently ignore
  }
}
