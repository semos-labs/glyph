/**
 * Frame-level performance profiling.
 *
 * Each function in the pipeline writes its sub-phase timings and
 * counters into `framePerf`.  `render.ts` resets it at the start of
 * each frame and flushes it to disk periodically.
 *
 * @internal — remove this entire module once profiling is done.
 */

import { appendFileSync, writeFileSync } from "node:fs";

// ── Per-frame measurements ──────────────────────────────────────
export const framePerf = {
  // Layout sub-phases (ms)
  resolveStyles: 0,
  syncYogaStyles: 0,
  yogaCalculate: 0,
  extractLayout: 0,

  // Paint sub-phases (ms)
  collectEntries: 0,
  sortEntries: 0,
  paintLoop: 0,

  // Paint counters
  totalEntries: 0,
  dirtyEntries: 0,
  textCacheHits: 0,
  textCacheMisses: 0,
  preClearCells: 0,

  // Diff sub-phases (ms)
  diffLoop: 0,
  diffToString: 0,

  // Diff counters
  cellsTotal: 0,
  cellsChanged: 0,
  cursorMoves: 0,
  sgrChanges: 0,
  outputBytes: 0,

  // Swap (ms)
  swapCopy: 0,
};

export function resetFramePerf(): void {
  framePerf.resolveStyles = 0;
  framePerf.syncYogaStyles = 0;
  framePerf.yogaCalculate = 0;
  framePerf.extractLayout = 0;
  framePerf.collectEntries = 0;
  framePerf.sortEntries = 0;
  framePerf.paintLoop = 0;
  framePerf.totalEntries = 0;
  framePerf.dirtyEntries = 0;
  framePerf.textCacheHits = 0;
  framePerf.textCacheMisses = 0;
  framePerf.preClearCells = 0;
  framePerf.diffLoop = 0;
  framePerf.diffToString = 0;
  framePerf.cellsTotal = 0;
  framePerf.cellsChanged = 0;
  framePerf.cursorMoves = 0;
  framePerf.sgrChanges = 0;
  framePerf.outputBytes = 0;
  framePerf.swapCopy = 0;
}

// ── Accumulator ─────────────────────────────────────────────────
const FLUSH_EVERY = 30; // frames
let frameCount = 0;

interface Accum {
  sum: Record<string, number>;
  min: Record<string, number>;
  max: Record<string, number>;
}

let accum: Accum = { sum: {}, min: {}, max: {} };

const LOG_PATH = "/tmp/glyph-profile.log";

export function initPerfLog(): void {
  writeFileSync(LOG_PATH, `# Glyph frame profiler — ${new Date().toISOString()}\n`);
  writeFileSync(LOG_PATH + ".csv", csvHeader() + "\n");
  accum = { sum: {}, min: {}, max: {} };
  frameCount = 0;
}

function csvHeader(): string {
  return Object.keys(framePerf).join(",") + ",total";
}

function csvRow(total: number): string {
  return Object.values(framePerf).join(",") + `,${total}`;
}

export function flushFramePerf(totalMs: number): void {
  // Write raw CSV row for every frame — easy to analyze
  appendFileSync(LOG_PATH + ".csv", csvRow(totalMs) + "\n");

  // Accumulate for human-readable summary
  const keys = Object.keys(framePerf) as (keyof typeof framePerf)[];
  for (const k of keys) {
    const v = framePerf[k];
    accum.sum[k] = (accum.sum[k] ?? 0) + v;
    accum.min[k] = Math.min(accum.min[k] ?? Infinity, v);
    accum.max[k] = Math.max(accum.max[k] ?? -Infinity, v);
  }
  // Also track total
  accum.sum["total"] = (accum.sum["total"] ?? 0) + totalMs;
  accum.min["total"] = Math.min(accum.min["total"] ?? Infinity, totalMs);
  accum.max["total"] = Math.max(accum.max["total"] ?? -Infinity, totalMs);

  frameCount++;
  if (frameCount % FLUSH_EVERY === 0) {
    const lines: string[] = [`\n── Frame ${frameCount - FLUSH_EVERY + 1}–${frameCount} ──`];
    const allKeys = [...keys, "total" as const];
    for (const k of allKeys) {
      const avg = (accum.sum[k] ?? 0) / FLUSH_EVERY;
      const min = accum.min[k] ?? 0;
      const max = accum.max[k] ?? 0;
      // Only show non-zero timing entries or always show totals
      if (avg > 0.001 || k === "total" || typeof framePerf[k as keyof typeof framePerf] === "number" && framePerf[k as keyof typeof framePerf] > 0) {
        const isMs = !["totalEntries", "dirtyEntries", "textCacheHits", "textCacheMisses",
          "preClearCells", "cellsTotal", "cellsChanged", "cursorMoves", "sgrChanges"].includes(k);
        if (isMs) {
          lines.push(`  ${k.padEnd(20)} avg=${avg.toFixed(3)}ms  min=${min.toFixed(3)}  max=${max.toFixed(3)}`);
        } else {
          lines.push(`  ${k.padEnd(20)} avg=${avg.toFixed(1)}  min=${min}  max=${max}`);
        }
      }
    }
    appendFileSync(LOG_PATH, lines.join("\n") + "\n");

    // Reset accumulator
    accum = { sum: {}, min: {}, max: {} };
  }
}
