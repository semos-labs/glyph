import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { InputHandle } from "@semos-labs/glyph";
import {
  render,
  Box,
  Text,
  Input,
  ScrollView,
  List,
  Progress,
  Spacer,
  Keybind,
  Spinner,
  useApp,
  useInput,
} from "@semos-labs/glyph";
import type { FrameTiming } from "@semos-labs/glyph";

// ── Config ──────────────────────────────────────────────────────

const TICK_RATES = [10, 20, 30, 60, 120] as const;
const SPARKLINE_WIDTH = 32;
const SPARKLINE_CHARS = " ▁▂▃▄▅▆▇█";
const PROCESS_COUNT = 80;
const LOG_MAX = 200;

// ── Helpers ─────────────────────────────────────────────────────

function sparkline(values: number[], max: number): string {
  return values
    .map((v) => {
      const idx = Math.round((Math.min(v, max) / max) * 8);
      return SPARKLINE_CHARS[idx] ?? " ";
    })
    .join("");
}

function fmtMs(ms: number): string {
  if (ms < 0.01) return "0.00";
  if (ms < 10) return ms.toFixed(2);
  return ms.toFixed(1);
}

function fmtUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function randomName(): string {
  const names = [
    "node", "postgres", "redis", "nginx", "docker",
    "containerd", "kubelet", "etcd", "prometheus", "grafana",
    "clickhouse", "kafka", "zookeeper", "elasticsearch", "vault",
    "consul", "nomad", "traefik", "envoy", "haproxy",
    "memcached", "rabbitmq", "mongodb", "mysql", "minio",
    "temporal", "caddy", "pgbouncer", "patroni", "ceph-osd",
    "coredns", "flannel", "calico", "istio-proxy", "jaeger",
    "loki", "telegraf", "vector", "fluentd", "logstash",
  ];
  return names[Math.floor(Math.random() * names.length)]!;
}

function randomLogMessage(tick: number): string {
  const msgs = [
    "Health check passed",
    "Connection pool recycled",
    "GC pause: 12ms",
    "Request timeout on upstream",
    "TLS certificate renewed",
    "Cache hit ratio: 94.2%",
    "New connection from 10.0.0." + Math.floor(Math.random() * 255),
    "Query completed in " + Math.floor(Math.random() * 200) + "ms",
    "Worker thread spawned",
    "Compaction finished, freed 128MB",
    "Replication lag: " + Math.floor(Math.random() * 50) + "ms",
    "Rate limit triggered for client-" + Math.floor(Math.random() * 100),
    "Snapshot created successfully",
    "Index rebuild: 45% complete",
    "Memory pressure detected, evicting cache",
    "Lease renewed for 30s",
    "Raft election: leader changed",
    "DNS resolution: 2ms",
    "WAL segment rotated",
    "Backup completed: 2.3GB",
  ];
  return msgs[Math.floor(Math.random() * msgs.length)]!;
}

// ── Types ───────────────────────────────────────────────────────

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  status: "running" | "sleeping" | "idle";
  uptime: number;
}

interface LogEntry {
  id: number;
  time: string;
  message: string;
  level: "info" | "warn" | "error";
}

interface FrameStats {
  current: number;
  min: number;
  max: number;
  avg: number;
  p99: number;
  samples: number[];
  /** Averaged per-phase breakdown. */
  phases: { layout: number; paint: number; diff: number; swap: number };
}

// ── Frame Stats Tracker ─────────────────────────────────────────

function useFrameStats(lastFrameTime: number, timing: FrameTiming, tick: number): FrameStats {
  const samplesRef = useRef<number[]>([]);
  const phasesRef = useRef<{ layout: number[]; paint: number[]; diff: number[]; swap: number[] }>({
    layout: [], paint: [], diff: [], swap: [],
  });

  if (tick > 0 && lastFrameTime > 0) {
    const samples = samplesRef.current;
    samples.push(lastFrameTime);
    if (samples.length > 300) samples.shift();

    const p = phasesRef.current;
    p.layout.push(timing.layout);
    p.paint.push(timing.paint);
    p.diff.push(timing.diff);
    p.swap.push(timing.swap);
    if (p.layout.length > 300) {
      p.layout.shift();
      p.paint.shift();
      p.diff.shift();
      p.swap.shift();
    }
  }

  return useMemo(() => {
    const samples = samplesRef.current;
    if (samples.length === 0) {
      return {
        current: 0, min: 0, max: 0, avg: 0, p99: 0, samples: [],
        phases: { layout: 0, paint: 0, diff: 0, swap: 0 },
      };
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const sum = samples.reduce((a, b) => a + b, 0);
    const p99Idx = Math.floor(sorted.length * 0.99);

    const p = phasesRef.current;
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return {
      current: lastFrameTime,
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      avg: sum / samples.length,
      p99: sorted[p99Idx] ?? sorted[sorted.length - 1]!,
      samples: samples.slice(-SPARKLINE_WIDTH),
      phases: {
        layout: avg(p.layout),
        paint: avg(p.paint),
        diff: avg(p.diff),
        swap: avg(p.swap),
      },
    };
  }, [tick, lastFrameTime]);
}

// ── Simulated Data ──────────────────────────────────────────────

function generateProcesses(count: number): ProcessInfo[] {
  const procs: ProcessInfo[] = [];
  for (let i = 0; i < count; i++) {
    procs.push({
      pid: 1000 + i * 7,
      name: randomName(),
      cpu: Math.random() * 30,
      mem: Math.random() * 20,
      status: Math.random() > 0.15 ? "running" : Math.random() > 0.5 ? "sleeping" : "idle",
      uptime: Math.floor(Math.random() * 86400),
    });
  }
  return procs;
}

function tickProcesses(procs: ProcessInfo[]): ProcessInfo[] {
  return procs.map((p) => ({
    ...p,
    cpu: Math.max(0, Math.min(100, p.cpu + (Math.random() - 0.48) * 8)),
    mem: Math.max(0, Math.min(100, p.mem + (Math.random() - 0.5) * 2)),
    uptime: p.uptime + 1,
    status: Math.random() > 0.02 ? p.status : (Math.random() > 0.5 ? "running" : "sleeping"),
  }));
}

// ── Components ──────────────────────────────────────────────────

function PhaseBar({ label, ms, max, color }: { label: string; ms: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((ms / max) * 100) : 0;
  return (
    <Box style={{ flexDirection: "row", gap: 1 }}>
      <Text style={{ width: 7, dim: true }}>{label}</Text>
      <Text style={{ width: 8, color: color as any }}>{fmtMs(ms)}ms</Text>
      <Text style={{ dim: true }}>({pct}%)</Text>
    </Box>
  );
}

function FrameHUD({ stats, tickRate, timing }: { stats: FrameStats; tickRate: number; timing: FrameTiming }) {
  const frameSparkline = sparkline(stats.samples, Math.max(stats.max, 1));
  const color = stats.current < 2 ? "green" : stats.current < 5 ? "yellow" : "red";
  const { phases } = stats;

  return (
    <Box style={{ flexDirection: "column" }}>
      {/* Summary line */}
      <Box style={{ flexDirection: "row", paddingX: 1, gap: 1 }}>
        <Text style={{ bold: true, color }}>
          {fmtMs(stats.current)}ms
        </Text>
        <Text style={{ dim: true }}>│</Text>
        <Text style={{ dim: true }}>avg </Text>
        <Text>{fmtMs(stats.avg)}ms</Text>
        <Text style={{ dim: true }}>│</Text>
        <Text style={{ dim: true }}>p99 </Text>
        <Text>{fmtMs(stats.p99)}ms</Text>
        <Text style={{ dim: true }}>│</Text>
        <Text style={{ dim: true }}>min </Text>
        <Text>{fmtMs(stats.min)}</Text>
        <Text style={{ dim: true }}> max </Text>
        <Text>{fmtMs(stats.max)}</Text>
        <Text style={{ dim: true }}>│</Text>
        <Text style={{ color: "cyan" }}>{tickRate}fps</Text>
        <Spacer />
        <Text style={{ dim: true }}>{frameSparkline}</Text>
      </Box>
      {/* Phase breakdown */}
      <Box style={{ flexDirection: "row", paddingX: 1, gap: 2 }}>
        <PhaseBar label="layout" ms={phases.layout} max={stats.avg} color="yellow" />
        <PhaseBar label="paint" ms={phases.paint} max={stats.avg} color="magenta" />
        <PhaseBar label="diff" ms={phases.diff} max={stats.avg} color="cyan" />
        <PhaseBar label="swap" ms={phases.swap} max={stats.avg} color="red" />
      </Box>
    </Box>
  );
}

function MetricRow({
  label,
  values,
  max,
  current,
  color,
}: {
  label: string;
  values: number[];
  max: number;
  current: number;
  color: "green" | "yellow" | "cyan" | "magenta" | "red" | "blue";
}) {
  const spark = sparkline(values.slice(-SPARKLINE_WIDTH), max);
  const pct = ((current / max) * 100).toFixed(0);

  return (
    <Box style={{ flexDirection: "row", gap: 1, paddingX: 1 }}>
      <Text style={{ color, bold: true, width: 4 }}>{label}</Text>
      <Text style={{ color: "blackBright" }}>{spark}</Text>
      <Text style={{ width: 5, color }}>{pct.padStart(3)}%</Text>
    </Box>
  );
}

function SystemMetrics({ tick }: { tick: number }) {
  const historyRef = useRef<{
    cpu: number[];
    mem: number[];
    net: number[];
    disk: number[];
  }>({ cpu: [], mem: [], net: [], disk: [] });

  const h = historyRef.current;

  // Generate new data points each tick
  const prev = {
    cpu: h.cpu[h.cpu.length - 1] ?? 40,
    mem: h.mem[h.mem.length - 1] ?? 60,
    net: h.net[h.net.length - 1] ?? 15,
    disk: h.disk[h.disk.length - 1] ?? 8,
  };

  const cpu = Math.max(0, Math.min(100, prev.cpu + (Math.random() - 0.45) * 20));
  const mem = Math.max(0, Math.min(100, prev.mem + (Math.random() - 0.5) * 5));
  const net = Math.max(0, Math.min(100, prev.net + (Math.random() - 0.48) * 15));
  const disk = Math.max(0, Math.min(100, prev.disk + (Math.random() - 0.5) * 6));

  h.cpu.push(cpu);
  h.mem.push(mem);
  h.net.push(net);
  h.disk.push(disk);

  // Keep bounded
  if (h.cpu.length > SPARKLINE_WIDTH + 10) {
    h.cpu = h.cpu.slice(-SPARKLINE_WIDTH);
    h.mem = h.mem.slice(-SPARKLINE_WIDTH);
    h.net = h.net.slice(-SPARKLINE_WIDTH);
    h.disk = h.disk.slice(-SPARKLINE_WIDTH);
  }

  return (
    <Box style={{ flexDirection: "column" }}>
      <MetricRow label="CPU" values={h.cpu} max={100} current={cpu} color="green" />
      <MetricRow label="MEM" values={h.mem} max={100} current={mem} color="yellow" />
      <MetricRow label="NET" values={h.net} max={100} current={net} color="cyan" />
      <MetricRow label="DISK" values={h.disk} max={100} current={disk} color="magenta" />
    </Box>
  );
}

function ProcessTable({
  processes,
  filter,
}: {
  processes: ProcessInfo[];
  filter: string;
}) {
  const filtered = useMemo(() => {
    if (!filter) return processes;
    const q = filter.toLowerCase();
    return processes.filter((p) => p.name.includes(q) || String(p.pid).includes(q));
  }, [processes, filter]);

  return (
    <Box style={{ flexDirection: "column", flexGrow: 1, flexShrink: 1, clip: true }}>
      {/* Header */}
      <Box style={{ flexDirection: "row", paddingX: 1, bg: "blackBright" }}>
        <Text style={{ width: 7, bold: true }}>PID</Text>
        <Text style={{ width: 16, bold: true }}>NAME</Text>
        <Text style={{ width: 7, bold: true }}>CPU%</Text>
        <Text style={{ width: 7, bold: true }}>MEM%</Text>
        <Text style={{ width: 10, bold: true }}>STATUS</Text>
        <Text style={{ bold: true }}>UPTIME</Text>
      </Box>

      {/* Scrollable rows */}
      <ScrollView
        style={{ flexGrow: 1, flexShrink: 1, flexDirection: "column" }}
        disableKeyboard
      >
        {filtered.map((p) => {
          const cpuColor = p.cpu > 50 ? "red" : p.cpu > 20 ? "yellow" : undefined;
          const memColor = p.mem > 60 ? "red" : p.mem > 30 ? "yellow" : undefined;
          const statusColor =
            p.status === "running" ? "green" : p.status === "sleeping" ? "yellow" : "blackBright";

          return (
            <Box key={p.pid} style={{ flexDirection: "row", paddingX: 1 }}>
              <Text style={{ width: 7, dim: true }}>{p.pid}</Text>
              <Text style={{ width: 16 }}>{p.name}</Text>
              <Text style={{ width: 7, color: cpuColor }}>{p.cpu.toFixed(1)}</Text>
              <Text style={{ width: 7, color: memColor }}>{p.mem.toFixed(1)}</Text>
              <Text style={{ width: 10, color: statusColor }}>{p.status}</Text>
              <Text style={{ dim: true }}>{fmtUptime(p.uptime)}</Text>
            </Box>
          );
        })}
      </ScrollView>

      <Box style={{ paddingX: 1 }}>
        <Text style={{ dim: true }}>
          {filtered.length} processes
          {filter ? ` (filtered from ${processes.length})` : ""}
        </Text>
      </Box>
    </Box>
  );
}

function ActivityLog({ logs, tick }: { logs: LogEntry[]; tick: number }) {
  // Simple approach: just show the last N items, no ScrollView
  const visible = logs.slice(-20);
  return (
    <Box style={{ flexDirection: "column", flexGrow: 1 }}>
      <Box style={{ paddingX: 1, bg: "blackBright" }}>
        <Text style={{ bold: true }}>Activity</Text>
        <Spacer />
        <Text style={{ dim: true }}>{logs.length} entries</Text>
      </Box>
      {visible.map((log, i) => {
        const levelColor =
          log.level === "error" ? "red" : log.level === "warn" ? "yellow" : "blackBright";
        return (
          <Box key={i} style={{ flexDirection: "row", paddingX: 1, gap: 1 }}>
            <Text style={{ color: levelColor, dim: log.level === "info" }}>
              {log.time}
            </Text>
            <Text style={{ dim: log.level === "info" }}>{log.message}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

function NodeCounter({ processes, logs, tick }: { processes: ProcessInfo[]; logs: LogEntry[]; tick: number }) {
  // Rough estimate of rendered node count
  // Each process row: 1 Box + 6 Text = 7 nodes
  // Metric rows: 4 × (1 Box + 3 Text) = 16
  // Log entries: logs visible ~6 × (1 Box + 2 Text) = 18
  // Frame HUD + chrome: ~40
  const estimated = processes.length * 7 + 16 + Math.min(logs.length, 6) * 3 + 40;

  return (
    <Text style={{ dim: true }}>~{estimated} nodes</Text>
  );
}

// ── App ─────────────────────────────────────────────────────────

function App() {
  const { exit, lastFrameTime, frameTiming } = useApp();

  // Tick state
  const [tickRateIdx, setTickRateIdx] = useState(2); // Start at 30fps
  const tickRate = TICK_RATES[tickRateIdx]!;
  const [tick, setTick] = useState(0);

  // Data state
  const [processes, setProcesses] = useState<ProcessInfo[]>(() => generateProcesses(PROCESS_COUNT));
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const logIdRef = useRef(0);
  const inputRef = useRef<InputHandle>(null);

  // Frame stats
  const frameStats = useFrameStats(lastFrameTime, frameTiming, tick);

  // Main tick loop — uses recursive setTimeout so the next tick
  // only schedules after React finishes processing the current one.
  // setInterval can stack calls faster than React can flush them,
  // hitting the "Maximum update depth" limit.
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    const delay = Math.floor(1000 / tickRate);

    function doTick() {
      if (cancelled) return;
      const currentTick = tickRef.current;

      // Build new log entries
      const count = 1 + Math.floor(Math.random() * 3);
      const newLogs: LogEntry[] = [];
      for (let i = 0; i < count; i++) {
        const id = logIdRef.current++;
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
        const level = Math.random() > 0.92 ? "error" : Math.random() > 0.85 ? "warn" : "info";
        newLogs.push({ id, time, message: randomLogMessage(currentTick), level: level as LogEntry["level"] });
      }

      setTick((t) => t + 1);
      setProcesses((p) => tickProcesses(p));
      setLogs((prev) => {
        const next = [...prev, ...newLogs];
        return next.length > LOG_MAX ? next.slice(-LOG_MAX) : next;
      });

      // Schedule next tick AFTER this one is dispatched
      setTimeout(doTick, delay);
    }

    const timer = setTimeout(doTick, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [tickRate, paused]);

  // Keybinds
  useInput((key) => {
    if (key.name === "+" || key.name === "=") {
      setTickRateIdx((i) => Math.min(i + 1, TICK_RATES.length - 1));
    } else if (key.name === "-" || key.name === "_") {
      setTickRateIdx((i) => Math.max(i - 1, 0));
    }
  });

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      {/* Title bar */}
      <Box style={{ flexDirection: "row", paddingX: 1, bg: "blackBright" }}>
        <Text style={{ bold: true }}>Glyph Benchmark</Text>
        <Spacer />
        {paused && <Text style={{ color: "yellow", bold: true }}> PAUSED </Text>}
        <NodeCounter processes={processes} logs={logs} tick={tick} />
      </Box>

      {/* Frame timing HUD */}
      <FrameHUD stats={frameStats} tickRate={tickRate} timing={frameTiming} />

      {/* Divider */}
      <Box style={{ height: 1, bg: "blackBright" }} />

      {/* System metrics sparklines */}
      <SystemMetrics tick={tick} />

      {/* Divider */}
      <Box style={{ height: 1, bg: "blackBright" }} />

      {/* Main content: processes + logs side by side */}
      <Box style={{ flexDirection: "row", flexGrow: 1, flexShrink: 1, clip: true }}>
        {/* Process table (left) */}
        <ProcessTable processes={processes} filter={filter} />

        {/* Vertical divider */}
        <Box style={{ width: 1, bg: "blackBright" }} />

        {/* Activity log (right) */}
        <Box style={{ flexDirection: "column", width: 48, flexShrink: 0 }}>
          <ActivityLog logs={logs} tick={tick} />
        </Box>
      </Box>

      {/* Bottom bar */}
      <Box style={{ flexDirection: "row", paddingX: 1, gap: 2, flexShrink: 0 }}>
        <Box style={{ flexDirection: "row", gap: 1 }}>
          <Text style={{ dim: true }}>search:</Text>
          <Input
            ref={inputRef}
            value={filter}
            onChange={setFilter}
            placeholder="filter processes..."
            style={{ width: 24 }}
            focusedStyle={{ bg: "white", color: "black" }}
          />
        </Box>
        <Box style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
          <Text style={{ dim: true }}>speed:</Text>
          <Progress
            value={tickRateIdx / (TICK_RATES.length - 1)}
            style={{ width: 10 }}
          />
          <Text style={{ dim: true }}>{tickRate}fps</Text>
        </Box>
        <Spacer />
        <Text style={{ dim: true }}>
          +/- speed · space pause · / search · q quit
        </Text>
      </Box>

      {/* Global keybinds */}
      <Keybind keypress="q" onPress={() => exit()} />
      <Keybind keypress="space" onPress={() => setPaused((p) => !p)} />
      <Keybind keypress="/" onPress={() => inputRef.current?.focus()} />
    </Box>
  );
}

// ── Entry ───────────────────────────────────────────────────────

render(<App />, { debug: true });
