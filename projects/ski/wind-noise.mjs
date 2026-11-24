const SAMPLE_RATE = 44100;
const LOOP_SECONDS = 8;
const CROSSFADE_SECONDS = 0.04;

export function createPinkNoise(context, random = Math.random) {
  const length = SAMPLE_RATE * LOOP_SECONDS;
  const overlap = Math.round(SAMPLE_RATE * CROSSFADE_SECONDS);
  const buffer = context.createBuffer(1, length, SAMPLE_RATE);
  const samples = buffer.getChannelData(0);

  // Paul Kellet's pinking filter, evaluated at its design sample rate.
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = -overlap; i < length + overlap; i++) {
    const white = 2 * random() - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.15;
    b6 = white * 0.115926;
    if (i < 0) continue;
    if (i < length) {
      samples[i] = pink;
    } else {
      // Start the loop with the continuation of the tail, then blend into its head.
      const head = i - length;
      const angle = head / (overlap - 1) * Math.PI / 2;
      samples[head] = pink * Math.cos(angle) + samples[head] * Math.sin(angle);
    }
  }
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0.95) {
    const scale = 0.95 / peak;
    for (let i = 0; i < length; i++) samples[i] *= scale;
  }
  return buffer;
}
