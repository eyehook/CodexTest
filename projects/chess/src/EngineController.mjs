import { effectiveElo } from "./Settings.mjs?v=ratings-2";
export const ENGINE_URL = new URL(
  "../vendor/stockfish/stockfish-17.1-lite-single-03e3232.js",
  import.meta.url,
);
export class EngineController {
  constructor({
    createWorker = () => new Worker(ENGINE_URL),
    onStatus = () => {},
  } = {}) {
    this.createWorker = createWorker;
    this.onStatus = onStatus;
    this.waiters = [];
    this.generation = 0;
    this.busy = false;
  }
  dispose() {
    ++this.generation;
    this.ready = false;
    this.busy = false;
    this.worker?.terminate();
    this.worker = null;
    for (const w of this.waiters.splice(0)) {
      clearTimeout(w.timer);
      w.reject(new Error("Engine cancelled"));
    }
  }
  wait(test, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const w = { test, resolve, reject };
      w.timer = setTimeout(() => {
        this.waiters = this.waiters.filter((x) => x !== w);
        reject(new Error("Stockfish response timed out"));
      }, timeout);
      this.waiters.push(w);
    });
  }
  send(command) {
    if (!this.worker) throw new Error("Engine unavailable");
    this.worker.postMessage(command);
  }
  async initialize(elo) {
    this.dispose();
    const generation = this.generation;
    this.range = null;
    this.onStatus("Loading Stockfish…");
    try {
      this.worker = this.createWorker();
      this.worker.onmessage = ({ data }) => {
        if (generation !== this.generation) return;
        for (const line of String(data).split("\n")) {
          const range = line.match(
            /^option name UCI_Elo type spin .*min (\d+) max (\d+)/,
          );
          if (range)
            this.range = { min: Number(range[1]), max: Number(range[2]) };
          for (const w of [...this.waiters])
            if (w.test(line)) {
              this.waiters = this.waiters.filter((x) => x !== w);
              clearTimeout(w.timer);
              w.resolve(line);
            }
        }
      };
      this.worker.onerror = (event) => {
        event.preventDefault?.();
        if (generation !== this.generation) return;
        this.dispose();
        this.onStatus("Stockfish failed to load. Restart to retry.");
      };
      const uci = this.wait((l) => l === "uciok");
      this.send("uci");
      await uci;
      if (generation !== this.generation) throw new Error("Engine cancelled");
      this.elo = effectiveElo(elo, this.range);
      this.send("setoption name Hash value 16");
      this.send("setoption name UCI_LimitStrength value true");
      this.send(`setoption name UCI_Elo value ${this.elo}`);
      this.send("ucinewgame");
      const ready = this.wait((l) => l === "readyok");
      this.send("isready");
      await ready;
      if (generation !== this.generation) throw new Error("Engine cancelled");
      this.ready = true;
      this.onStatus(
        `Stockfish ready · target ${elo}${this.elo !== Number(elo) ? ` → engine minimum ${this.elo}` : ""} · approximate strength`,
      );
      return this.elo;
    } catch (error) {
      if (generation === this.generation) {
        this.dispose();
        this.onStatus(error.message);
      }
      throw error;
    }
  }
  async bestMove(fen) {
    if (!this.ready || this.busy)
      throw new Error("Engine unavailable or already searching");
    const generation = this.generation;
    this.busy = true;
    try {
      const result = this.wait((l) => l.startsWith("bestmove "), 10000);
      this.send(`position fen ${fen}`);
      this.send("go movetime 300");
      const line = await result;
      if (generation !== this.generation) throw new Error("Engine cancelled");
      const token = line.split(/\s+/)[1];
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token))
        throw new Error(`Invalid Stockfish move: ${token}`);
      return {
        from: token.slice(0, 2),
        to: token.slice(2, 4),
        ...(token[4] ? { promotion: token[4] } : {}),
      };
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
}
