export class Motion {
  constructor() {
    this.jobs = new Set();
  }
  tween(duration, step) {
    return new Promise((resolve) => {
      this.jobs.add({ duration, step, elapsed: 0, resolve });
    });
  }
  update(dt) {
    for (const job of [...this.jobs]) {
      job.elapsed += Math.min(dt, 0.05);
      const t = Math.min(1, job.elapsed / job.duration);
      job.step(t * t * (3 - 2 * t));
      if (t === 1) {
        this.jobs.delete(job);
        job.resolve(true);
      }
    }
  }
  cancel() {
    for (const job of this.jobs) job.resolve(false);
    this.jobs.clear();
  }
}
