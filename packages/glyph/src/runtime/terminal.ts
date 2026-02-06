const ESC = "\x1b";
const CSI = `${ESC}[`;

export class Terminal {
  stdout: NodeJS.WriteStream;
  stdin: NodeJS.ReadStream;
  private wasRaw = false;
  private cleanedUp = false;

  // Data handler dispatch - single stdin listener, filters OSC, dispatches clean data
  private dataHandlers = new Set<(data: string) => void>();
  private stdinAttached = false;

  // OSC response filtering state
  private oscState: "normal" | "esc" | "osc" | "osc_esc" = "normal";
  private oscAccum = "";
  private escFlushTimer: ReturnType<typeof setTimeout> | null = null;

  // Terminal palette (populated by queryPalette)
  palette = new Map<number, [number, number, number]>();
  private paletteResolve: (() => void) | null = null;

  constructor(
    stdout: NodeJS.WriteStream = process.stdout,
    stdin: NodeJS.ReadStream = process.stdin,
  ) {
    this.stdout = stdout;
    this.stdin = stdin;
  }

  get columns(): number {
    return this.stdout.columns || 80;
  }

  get rows(): number {
    return this.stdout.rows || 24;
  }

  enterRawMode(): void {
    if (this.stdin.isTTY) {
      this.wasRaw = this.stdin.isRaw;
      this.stdin.setRawMode(true);
      this.stdin.resume();
      this.stdin.setEncoding("utf-8");
    }
  }

  exitRawMode(): void {
    if (this.stdin.isTTY && !this.wasRaw) {
      this.stdin.setRawMode(false);
      this.stdin.pause();
    }
  }

  write(data: string): void {
    this.stdout.write(data);
  }

  hideCursor(): void {
    this.write(`${CSI}?25l`);
  }

  showCursor(): void {
    this.write(`${CSI}?25h`);
  }

  /** Move cursor to (x, y) position (0-indexed) */
  moveCursor(x: number, y: number): void {
    // ANSI uses 1-indexed positions
    this.write(`${CSI}${y + 1};${x + 1}H`);
  }

  /** Set cursor color using OSC 12 */
  setCursorColor(color: string): void {
    // OSC 12 sets cursor color, terminated by BEL
    this.write(`${ESC}]12;${color}\x07`);
  }

  /** Reset cursor color to terminal default */
  resetCursorColor(): void {
    // Empty color resets to default
    this.write(`${ESC}]112\x07`);
  }

  enterAltScreen(): void {
    this.write(`${CSI}?1049h`);
  }

  exitAltScreen(): void {
    this.write(`${CSI}?1049l`);
  }

  clearScreen(): void {
    this.write(`${CSI}2J${CSI}H`);
  }

  resetStyles(): void {
    this.write(`${CSI}0m`);
  }

  setup(): void {
    this.enterRawMode();
    this.enterAltScreen();
    this.hideCursor();
    this.clearScreen();
    this.attachStdinListener();
    this.installCleanupHandlers();
  }

  cleanup(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;

    if (this.escFlushTimer !== null) {
      clearTimeout(this.escFlushTimer);
      this.escFlushTimer = null;
    }

    this.resetStyles();
    this.resetCursorColor();
    this.showCursor();
    this.exitAltScreen();
    this.exitRawMode();
  }

  /** Restore terminal state for background suspension (does NOT mark as cleaned up). */
  suspend(): void {
    if (this.escFlushTimer !== null) {
      clearTimeout(this.escFlushTimer);
      this.escFlushTimer = null;
    }
    this.oscState = "normal";
    this.oscAccum = "";

    this.resetStyles();
    this.resetCursorColor();
    this.showCursor();
    this.exitAltScreen();
    this.exitRawMode();
  }

  /** Re-enter raw mode and alt screen after SIGCONT resume. */
  resume(): void {
    this.enterRawMode();
    this.enterAltScreen();
    this.hideCursor();
    this.clearScreen();
  }

  // ---- Data handling with OSC filtering ----

  private attachStdinListener(): void {
    if (this.stdinAttached) return;
    this.stdinAttached = true;

    this.stdin.on("data", (data: Buffer | string) => {
      let str = typeof data === "string" ? data : data.toString("utf-8");
      this.dispatchFiltered(str);
    });
  }

  onData(handler: (data: string) => void): () => void {
    this.dataHandlers.add(handler);
    return () => {
      this.dataHandlers.delete(handler);
    };
  }

  // ---- OSC response filtering ----

  private dispatchFiltered(raw: string): void {
    // Cancel any pending standalone-ESC flush since more data arrived
    if (this.escFlushTimer !== null) {
      clearTimeout(this.escFlushTimer);
      this.escFlushTimer = null;
    }

    const clean = this.filterOsc(raw);

    if (clean.length > 0) {
      for (const handler of this.dataHandlers) {
        handler(clean);
      }
    }

    // If filterOsc ended in "esc" state, a standalone ESC byte is pending.
    // Use a short timeout to disambiguate: if no more data arrives within 50ms,
    // treat it as a standalone Escape keypress and flush it.
    if (this.oscState === "esc") {
      this.escFlushTimer = setTimeout(() => {
        this.escFlushTimer = null;
        this.oscState = "normal";
        for (const handler of this.dataHandlers) {
          handler("\x1b");
        }
      }, 50);
    }
  }

  private filterOsc(raw: string): string {
    let clean = "";

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i]!;
      const code = raw.charCodeAt(i);

      switch (this.oscState) {
        case "normal":
          if (code === 0x1b) {
            this.oscState = "esc";
          } else {
            clean += ch;
          }
          break;

        case "esc":
          if (ch === "]") {
            // Start of OSC sequence
            this.oscState = "osc";
            this.oscAccum = "";
          } else {
            // Not OSC — pass through the ESC and current char
            clean += "\x1b" + ch;
            this.oscState = "normal";
          }
          break;

        case "osc":
          if (code === 0x07) {
            // BEL terminator
            this.handleOscResponse(this.oscAccum);
            this.oscAccum = "";
            this.oscState = "normal";
          } else if (code === 0x1b) {
            // Possible ST (ESC \)
            this.oscState = "osc_esc";
          } else {
            this.oscAccum += ch;
          }
          break;

        case "osc_esc":
          if (ch === "\\") {
            // ST terminator
            this.handleOscResponse(this.oscAccum);
            this.oscAccum = "";
            this.oscState = "normal";
          } else {
            // Not ST, accumulate
            this.oscAccum += "\x1b" + ch;
            this.oscState = "osc";
          }
          break;
      }
    }

    return clean;
  }

  private handleOscResponse(data: string): void {
    // Parse OSC 4 response: "4;{index};rgb:{rrrr}/{gggg}/{bbbb}"
    const match = data.match(
      /^4;(\d+);rgb:([0-9a-fA-F]+)\/([0-9a-fA-F]+)\/([0-9a-fA-F]+)/,
    );
    if (match) {
      const index = parseInt(match[1]!, 10);
      // Terminal reports 16-bit hex (e.g. "ffff"), take high byte for 8-bit
      const r = parseInt(match[2]!.substring(0, 2), 16);
      const g = parseInt(match[3]!.substring(0, 2), 16);
      const b = parseInt(match[4]!.substring(0, 2), 16);
      this.palette.set(index, [r, g, b]);
      if (this.palette.size >= 16 && this.paletteResolve) {
        this.paletteResolve();
        this.paletteResolve = null;
      }
    }
  }

  // ---- Palette querying ----

  queryPalette(): Promise<Map<number, [number, number, number]>> {
    return new Promise((resolve) => {
      const done = () => resolve(this.palette);

      // If terminal doesn't respond, resolve with whatever we have after timeout
      const timeout = setTimeout(done, 200);

      this.paletteResolve = () => {
        clearTimeout(timeout);
        done();
      };

      // Query colors 0-15 (the 16 standard ANSI colors)
      let query = "";
      for (let i = 0; i < 16; i++) {
        query += `\x1b]4;${i};?\x07`;
      }
      this.write(query);
    });
  }

  // ---- Event handling ----

  onResize(handler: () => void): () => void {
    this.stdout.on("resize", handler);
    return () => {
      this.stdout.off("resize", handler);
    };
  }

  private installCleanupHandlers(): void {
    const doCleanup = () => this.cleanup();

    process.on("exit", doCleanup);

    const handleSignal = (signal: NodeJS.Signals) => {
      doCleanup();
      process.kill(process.pid, signal);
    };

    process.once("SIGINT", () => handleSignal("SIGINT"));
    process.once("SIGTERM", () => handleSignal("SIGTERM"));

    process.on("uncaughtException", (err) => {
      doCleanup();
      console.error(err);
      process.exit(1);
    });

    process.on("unhandledRejection", (err) => {
      doCleanup();
      console.error(err);
      process.exit(1);
    });
  }
}
