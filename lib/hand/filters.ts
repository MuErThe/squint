/**
 * One Euro Filter (Casiez et al., CHI 2012) — adaptive low-pass filter for
 * noisy input signals. At rest the cutoff drops to `minCutoff` and jitter is
 * smoothed away; during fast motion the cutoff rises with speed (scaled by
 * `beta`) so the output tracks with minimal lag. Strictly better than a
 * fixed-alpha EMA for pointing tasks: smooth when slow, responsive when fast.
 */
export class OneEuroFilter {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;

  private prevValue: number | null = null;
  private prevDeriv = 0;
  private prevTimeSec = 0;

  /**
   * @param minCutoff baseline cutoff frequency in Hz — lower = smoother at rest
   * @param beta speed coefficient — higher = snappier during fast movement
   * @param dCutoff cutoff for the derivative estimate (1 Hz is the paper default)
   */
  constructor(minCutoff: number, beta: number, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  /** Feed one sample. `timeSec` must be monotonic (e.g. performance.now()/1000). */
  filter(value: number, timeSec: number): number {
    if (this.prevValue === null) {
      this.prevValue = value;
      this.prevTimeSec = timeSec;
      return value;
    }

    const dt = Math.max(1e-3, timeSec - this.prevTimeSec);
    this.prevTimeSec = timeSec;

    // Smoothed derivative of the signal.
    const rawDeriv = (value - this.prevValue) / dt;
    const aD = smoothingFactor(dt, this.dCutoff);
    const deriv = lowPass(rawDeriv, this.prevDeriv, aD);
    this.prevDeriv = deriv;

    // Cutoff rises with speed.
    const cutoff = this.minCutoff + this.beta * Math.abs(deriv);
    const a = smoothingFactor(dt, cutoff);
    const filtered = lowPass(value, this.prevValue, a);
    this.prevValue = filtered;
    return filtered;
  }

  /** Forget all history — call when the hand is lost so re-acquisition doesn't lag. */
  reset(): void {
    this.prevValue = null;
    this.prevDeriv = 0;
    this.prevTimeSec = 0;
  }
}

function smoothingFactor(dt: number, cutoff: number): number {
  const r = 2 * Math.PI * cutoff * dt;
  return r / (r + 1);
}

function lowPass(value: number, prev: number, alpha: number): number {
  return prev + alpha * (value - prev);
}
