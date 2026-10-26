let context: AudioContext | undefined;
let enabled = true;
let volume = 0.18;
export function configureAudio(on: boolean, value: number) {
  enabled = on;
  volume = value;
}
export function sound(kind: 'deploy' | 'hit' | 'win' | 'click') {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const osc = context.createOscillator(),
      gain = context.createGain();
    const notes = { deploy: [190, 350], hit: [110, 60], win: [420, 840], click: [500, 650] }[kind];
    osc.type = kind === 'hit' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(notes[0], context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(notes[1], context.currentTime + 0.12);
    gain.gain.setValueAtTime(volume * 0.25, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + 0.16);
  } catch {
    /* 无音频设备时不影响战斗。 */
  }
}
