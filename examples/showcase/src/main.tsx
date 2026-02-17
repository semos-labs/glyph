import React, { useState, useEffect, useCallback } from "react";
import {
  render,
  Box,
  Text,
  Input,
  Button,
  Link,
  Select,
  Checkbox,
  Radio,
  Progress,
  Spinner,
  Keybind,
  Spacer,
  ToastHost,
  useToast,
  useApp,
  useMediaQuery,
} from "@semos-labs/glyph";

// ── Palette — calm dark theme ──────────────────────────────────
// Muted interface with vivid progress bars only.

const C = {
  surface: "#1c1c1c",       // card / panel surfaces
  elevated: "#282828",       // inputs, hover states
  // Progress bar colors — the only vivid ones
  green: "#22c55e",       // healthy / success
  amber: "#f59e0b",       // degraded / warning
  red: "#ef4444",       // down / error
  // UI text — all subdued
  text: "#b3b3b3",       // primary text — neutral gray
  dim: "#808080",       // secondary text
  muted: "#555555",       // labels / hints
} as const;

// ── Data ───────────────────────────────────────────────────────

interface Service {
  name: string;
  status: "healthy" | "degraded" | "down";
  cpu: number;
  mem: number;
  rps: number;
}

type ServiceStatus = Service["status"];
type EventKind = "info" | "warning" | "error";

const SERVICES: Service[] = [
  { name: "api-gateway", status: "healthy", cpu: 0.34, mem: 0.41, rps: 12847 },
  { name: "auth-service", status: "healthy", cpu: 0.15, mem: 0.33, rps: 5621 },
  { name: "user-service", status: "degraded", cpu: 0.78, mem: 0.82, rps: 8934 },
  { name: "payment-svc", status: "healthy", cpu: 0.31, mem: 0.55, rps: 3201 },
  { name: "search-index", status: "down", cpu: 0.0, mem: 0.0, rps: 0 },
  { name: "cdn-proxy", status: "healthy", cpu: 0.42, mem: 0.61, rps: 24103 },
];

const EVENTS: { time: string; msg: string; kind: EventKind }[] = [
  { time: "14:32", msg: "Deployment v2.4.1 started", kind: "info" },
  { time: "14:31", msg: "search-index health check failed", kind: "error" },
  { time: "14:28", msg: "user-service CPU spike (78%)", kind: "warning" },
  { time: "14:25", msg: "SSL certificate renewed", kind: "info" },
  { time: "14:20", msg: "Backup completed (42 GB)", kind: "info" },
  { time: "14:15", msg: "Rate limit: 203.0.113.5", kind: "warning" },
  { time: "14:12", msg: "New API key issued", kind: "info" },
  { time: "14:08", msg: "Container restarted: email", kind: "warning" },
];

const BRANCHES = [
  { label: "main", value: "main" },
  { label: "develop", value: "develop" },
  { label: "feature/auth-v2", value: "feature/auth-v2" },
  { label: "hotfix/login", value: "hotfix/login" },
];

const STATUS_DOT: Record<ServiceStatus, string> = {
  healthy: "●", degraded: "◑", down: "○",
};

const STATUS_CLR = {
  healthy: C.dim, degraded: C.dim, down: C.dim,
} as const;

const EVENT_ICON: Record<EventKind, string> = {
  info: "·", warning: "▲", error: "●",
};

const EVENT_CLR = {
  info: C.muted, warning: C.dim, error: C.dim,
} as const;

// ── Header ─────────────────────────────────────────────────────

function Header() {
  const healthy = SERVICES.filter((s) => s.status === "healthy").length;
  const total = SERVICES.length;
  const allHealthy = healthy === total;

  return (
    <Box
      style={{
        flexDirection: "row",
        alignItems: "center",
        bg: C.surface,
        paddingX: 2,
      }}
    >
      <Text style={{ bold: true, color: C.text }}>◆ nexus</Text>
      <Text style={{ color: C.muted }}>{" · infrastructure"}</Text>
      <Spacer />
      <Spinner style={{ color: C.dim }} intervalMs={100} />
      <Text style={{ color: C.dim }}>{" syncing  "}</Text>
      <Text style={{ color: C.dim }}>{STATUS_DOT[allHealthy ? "healthy" : "degraded"]} </Text>
      <Text style={{ color: C.dim }}>
        {healthy}/{total}
      </Text>
    </Box>
  );
}

// ── Stats Bar ──────────────────────────────────────────────────

function StatsBar() {
  const totalRps = SERVICES.reduce((s, svc) => s + svc.rps, 0);
  const avgCpu =
    SERVICES.reduce((s, svc) => s + svc.cpu, 0) / SERVICES.length;
  const avgMem =
    SERVICES.reduce((s, svc) => s + svc.mem, 0) / SERVICES.length;

  return (
    <Box
      style={{
        flexDirection: "row",
        bg: C.surface,
        paddingX: 2,
        gap: 3,
      }}
    >
      <Box style={{ flexDirection: "row", gap: 1 }}>
        <Text style={{ color: C.muted }}>requests</Text>
        <Text style={{ bold: true, color: C.text }}>
          {(totalRps / 1000).toFixed(1)}k/s
        </Text>
      </Box>
      <Box style={{ flexDirection: "row", gap: 1 }}>
        <Text style={{ color: C.muted }}>avg cpu</Text>
        <Text style={{ color: C.text }}>
          {(avgCpu * 100).toFixed(0)}%
        </Text>
      </Box>
      <Box style={{ flexDirection: "row", gap: 1 }}>
        <Text style={{ color: C.muted }}>avg mem</Text>
        <Text style={{ color: C.text }}>
          {(avgMem * 100).toFixed(0)}%
        </Text>
      </Box>
      <Box style={{ flexDirection: "row", gap: 1 }}>
        <Text style={{ color: C.muted }}>uptime</Text>
        <Text style={{ color: C.text }}>99.87%</Text>
      </Box>
    </Box>
  );
}

// ── Service Card ───────────────────────────────────────────────

function ServiceCard({ service }: { service: Service }) {
  const { name, status, cpu, mem, rps } = service;
  const statusColor = STATUS_CLR[status];
  const cpuColor = cpu > 0.7 ? C.red : cpu > 0.4 ? C.amber : C.green;
  const memColor = mem > 0.7 ? C.red : mem > 0.4 ? C.amber : C.green;

  return (
    <Box
      style={{
        flexDirection: "row",
        bg: C.surface,
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
      }}
    >
      {/* Left accent bar — status color */}
      <Box style={{ width: 1, bg: statusColor, flexShrink: 0 }} />

      <Box
        style={{
          flexDirection: "column",
          paddingLeft: 1,
          paddingRight: 1,
          flexGrow: 1,
          minWidth: 0,
        }}
      >
        <Box style={{ flexDirection: "row" }}>
          <Text style={{ bold: true, color: C.text }}>{name}</Text>
          <Spacer />
          <Text style={{ color: C.dim }}>
            {rps > 0 ? `${(rps / 1000).toFixed(1)}k` : "off"}
          </Text>
          <Text style={{ color: statusColor }}> {STATUS_DOT[status]}</Text>
        </Box>

        <Box style={{ flexDirection: "row", gap: 1 }}>
          <Text style={{ color: C.muted }}>cpu</Text>
          <Box style={{ flexGrow: 1 }}>
            <Progress value={cpu} style={{ color: cpuColor }} />
          </Box>
          <Text style={{ color: C.muted }}>mem</Text>
          <Box style={{ flexGrow: 1 }}>
            <Progress value={mem} style={{ color: memColor }} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ── Service Grid ───────────────────────────────────────────────

function ServiceGrid() {
  const isWide = useMediaQuery({ minColumns: 100 });
  const cols = isWide ? 3 : 2;

  const rows: Service[][] = [];
  for (let i = 0; i < SERVICES.length; i += cols) {
    rows.push(SERVICES.slice(i, i + cols));
  }

  return (
    <Box style={{ flexDirection: "column", gap: 1 }}>
      {rows.map((row, i) => (
        <Box key={i} style={{ flexDirection: "row", gap: 1 }}>
          {row.map((svc) => (
            <ServiceCard key={svc.name} service={svc} />
          ))}
        </Box>
      ))}
    </Box>
  );
}

// ── Deploy Panel ───────────────────────────────────────────────

function DeployPanel() {
  const toast = useToast();
  const [branch, setBranch] = useState("main");
  const [env, setEnv] = useState("production");
  const [message, setMessage] = useState("Fix auth timeout handling");
  const [runTests, setRunTests] = useState(true);
  const [notify, setNotify] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!deploying) return;
    if (progress >= 1) {
      setDeploying(false);
      setProgress(0);
      toast({
        title: "Deployed",
        message: `${branch} → ${env}`,
        variant: "success",
      });
      return;
    }
    const t = setTimeout(
      () => setProgress((p) => Math.min(1, p + 0.04)),
      100,
    );
    return () => clearTimeout(t);
  }, [deploying, progress]);

  const handleDeploy = useCallback(() => {
    if (!deploying) {
      setDeploying(true);
      setProgress(0);
    }
  }, [deploying]);

  return (
    <Box
      style={{
        flexDirection: "column",
        bg: C.surface,
        paddingX: 1,
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
      }}
    >
      <Text style={{ bold: true, color: C.text }}>deploy</Text>

      <Text style={{ color: C.muted }}>branch</Text>
      <Select
        items={BRANCHES}
        value={branch}
        onChange={setBranch}
        style={{ bg: C.elevated, paddingX: 1, color: C.text }}
        focusedStyle={{ bg: "#383838", color: C.text, paddingX: 1 }}
        dropdownStyle={{ bg: C.elevated }}
        highlightColor={"#383838"}
        maxVisible={4}
      />

      <Radio
        items={[
          { label: "staging", value: "staging" },
          { label: "production", value: "production" },
          { label: "canary", value: "canary" },
        ]}
        value={env}
        onChange={setEnv}
        direction="row"
        gap={2}
        selectedChar="●"
        unselectedChar="○"
        focusedItemStyle={{ color: C.text }}
        selectedItemStyle={{ bold: true, color: C.text }}
      />

      <Input
        value={message}
        onChange={setMessage}
        placeholder="Commit message..."
        style={{ bg: C.elevated, paddingX: 1, color: C.text }}
        focusedStyle={{ bg: "#383838", color: C.text, paddingX: 1 }}
      />

      <Box style={{ flexDirection: "row", gap: 2 }}>
        <Checkbox
          checked={runTests}
          onChange={setRunTests}
          label="Run tests"
          focusedStyle={{ color: C.text }}
        />
        <Checkbox
          checked={notify}
          onChange={setNotify}
          label="Notify team"
          focusedStyle={{ color: C.text }}
        />
      </Box>

      {deploying ? (
        <Box style={{ flexDirection: "column" }}>
          <Box style={{ flexDirection: "row", gap: 1 }}>
            <Spinner style={{ color: C.dim }} />
            <Text style={{ color: C.dim }}>
              deploying {Math.round(progress * 100)}%
            </Text>
          </Box>
          <Progress value={progress} style={{ color: C.text }} />
        </Box>
      ) : (
        <Button
          onPress={handleDeploy}
          label="Deploy"
          style={{ bg: C.elevated, paddingX: 2, bold: true, color: C.text }}
          focusedStyle={{ bg: "#383838", color: C.text, paddingX: 2 }}
        />
      )}
    </Box>
  );
}

// ── Activity Log ───────────────────────────────────────────────

function ActivityLog() {
  const isWide = useMediaQuery({ minColumns: 100 });
  const maxEvents = isWide ? 6 : 4;

  return (
    <Box
      style={{
        flexDirection: "column",
        bg: C.surface,
        paddingX: 1,
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
      }}
    >
      <Text style={{ bold: true, color: C.text }}>activity</Text>

      {EVENTS.slice(0, maxEvents).map((evt, i) => (
        <Box key={i} style={{ flexDirection: "row", gap: 1 }}>
          <Text style={{ color: EVENT_CLR[evt.kind] }}>
            {EVENT_ICON[evt.kind]}
          </Text>
          <Text style={{ color: C.muted }}>{evt.time}</Text>
          <Text
            style={{
              color: C.dim,
              wrap: "truncate",
            }}
          >
            {evt.msg}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Footer ─────────────────────────────────────────────────────

function QuickLinks() {
  return (
    <Box
      style={{
        flexDirection: "row",
        bg: C.surface,
        paddingX: 1,
        flexShrink: 0,
        gap: 2,
        alignItems: "center",
      }}
    >
      <Text style={{ bold: true, color: C.text }}>links</Text>
      <Link
        href="https://github.com"
        style={{ color: C.dim }}
        focusedStyle={{ color: "cyanBright", underline: true }}
      >
        <Text>↗ documentation</Text>
      </Link>
      <Link
        href="https://example.com/status"
        style={{ color: C.dim }}
        focusedStyle={{ color: "cyanBright", underline: true }}
      >
        <Text>↗ status page</Text>
      </Link>
      <Link
        href="https://example.com/support"
        style={{ color: C.dim }}
        focusedStyle={{ color: "cyanBright", underline: true }}
      >
        <Text>↗ support</Text>
      </Link>
    </Box>
  );
}

function Footer() {
  const { columns, rows } = useApp();

  return (
    <Box
      style={{
        flexDirection: "row",
        paddingX: 2,
        bg: C.surface,
        flexShrink: 0,
      }}
    >
      <Text style={{ color: C.muted }}>
        tab navigate · space select · ⏎ confirm · t toast · q quit
      </Text>
      <Spacer />
      <Text style={{ color: C.muted }}>
        {columns}×{rows}
      </Text>
    </Box>
  );
}

// ── App ────────────────────────────────────────────────────────

function App() {
  const { exit } = useApp();
  const toast = useToast();

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      <Header />
      <StatsBar />

      <Box
        style={{
          flexDirection: "column",
          flexGrow: 1,
          paddingX: 2,
          paddingTop: 1,
          gap: 1,
        }}
      >
        <Text style={{ bold: true, color: C.text }}>services</Text>
        <ServiceGrid />

        <Box style={{ flexDirection: "row", gap: 1 }}>
          <DeployPanel />
          <ActivityLog />
        </Box>

        <QuickLinks />
      </Box>

      <Footer />

      <Keybind keypress="q" onPress={() => exit()} />
      <Keybind
        keypress="t"
        onPress={() => {
          const variants = [
            "info",
            "success",
            "warning",
            "error",
          ] as const;
          const v =
            variants[Math.floor(Math.random() * variants.length)]!;
          toast({
            title: v,
            message: "Test notification",
            variant: v,
          });
        }}
      />
    </Box>
  );
}

// ── Root ───────────────────────────────────────────────────────

function Root() {
  return (
    <ToastHost position="top-right">
      <App />
    </ToastHost>
  );
}

render(<Root />);
