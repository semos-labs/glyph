import React from "react";
import {
  render,
  Box,
  Text,
  Keybind,
  Spacer,
  Progress,
  Match,
  useApp,
  useMediaQuery,
} from "@semos-labs/glyph";

// ── Data ────────────────────────────────────────────────────────

const SERVICES = [
  { name: "api-gateway", status: "healthy", cpu: 0.23, mem: 0.41, reqs: 12847 },
  { name: "auth-service", status: "healthy", cpu: 0.15, mem: 0.33, reqs: 5621 },
  { name: "user-service", status: "degraded", cpu: 0.78, mem: 0.82, reqs: 8934 },
  { name: "payment-svc", status: "healthy", cpu: 0.31, mem: 0.55, reqs: 3201 },
  { name: "email-worker", status: "healthy", cpu: 0.08, mem: 0.19, reqs: 1456 },
  { name: "search-index", status: "down", cpu: 0.0, mem: 0.0, reqs: 0 },
  { name: "cdn-proxy", status: "healthy", cpu: 0.42, mem: 0.61, reqs: 24103 },
  { name: "analytics-db", status: "healthy", cpu: 0.56, mem: 0.73, reqs: 7712 },
];

const EVENTS = [
  { time: "14:32", msg: "Deployment v2.4.1 started", kind: "info" },
  { time: "14:31", msg: "search-index health check failed", kind: "error" },
  { time: "14:28", msg: "user-service CPU spike detected", kind: "warn" },
  { time: "14:25", msg: "SSL cert renewed (*.example.com)", kind: "info" },
  { time: "14:20", msg: "Backup completed (42 GB)", kind: "info" },
  { time: "14:15", msg: "Rate limit triggered: 203.0.113.5", kind: "warn" },
  { time: "14:12", msg: "New API key issued (team-backend)", kind: "info" },
  { time: "14:08", msg: "Container restarted: email-worker", kind: "warn" },
];

type StatusColor = "green" | "yellow" | "red" | "blackBright";

const STATUS_COLOR: Record<string, StatusColor> = {
  healthy: "green",
  degraded: "yellow",
  down: "red",
};

const EVENT_COLOR: Record<string, StatusColor> = {
  info: "blackBright",
  warn: "yellow",
  error: "red",
};

// ── Size indicator ──────────────────────────────────────────────

function SizeIndicator() {
  const { columns, rows } = useApp();
  const isXs = useMediaQuery({ maxColumns: 39 });
  const isSm = useMediaQuery({ minColumns: 40, maxColumns: 79 });
  const isMd = useMediaQuery({ minColumns: 80, maxColumns: 119 });
  const isLg = useMediaQuery({ minColumns: 120, maxColumns: 159 });
  const isXl = useMediaQuery({ minColumns: 160 });

  const label = isXs
    ? "xs"
    : isSm
      ? "sm"
      : isMd
        ? "md"
        : isLg
          ? "lg"
          : isXl
            ? "xl"
            : "?";

  return (
    <Text style={{ dim: true }}>
      {columns}×{rows} [{label}]
    </Text>
  );
}

// ── Header ──────────────────────────────────────────────────────

function Header() {
  const healthy = SERVICES.filter((s) => s.status === "healthy").length;
  const total = SERVICES.length;

  return (
    <Box
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingX: 1,
        bg: { base: undefined, md: "#1a1a2e" },
      }}
    >
      <Text style={{ bold: true, color: "cyan" }}>◆ </Text>
      <Text style={{ bold: true }}>infra monitor</Text>
      <Text style={{ dim: true }}> · </Text>
      <Text style={{ color: healthy === total ? "green" : "yellow" }}>
        {healthy}/{total} healthy
      </Text>
      <Spacer />
      <SizeIndicator />
    </Box>
  );
}

// ── Service card ────────────────────────────────────────────────

function ServiceCard(props: {
  name: string;
  status: string;
  cpu: number;
  mem: number;
  reqs: number;
}) {
  const { name, status, cpu, mem, reqs } = props;
  const color = STATUS_COLOR[status] ?? "blackBright";
  const icon = status === "healthy" ? "●" : status === "degraded" ? "◑" : "○";

  return (
    <Box
      style={{
        flexDirection: "column",
        border: "round",
        borderColor: color,
        paddingX: 1,
        // Responsive width: full on narrow, half on wide
        width: { base: "100%", lg: "50%" },
      }}
    >
      <Box style={{ flexDirection: "row", gap: 1 }}>
        <Text style={{ color }}>{icon}</Text>
        <Text style={{ bold: true }}>{name}</Text>
        <Spacer />
        <Text style={{ dim: true, color }}>{status}</Text>
      </Box>

      {/* Full metrics only on md+ */}
      <Match minColumns={80}>
        <Box style={{ flexDirection: "row", gap: 2 }}>
          <Box style={{ flexDirection: "row", gap: 1, flexGrow: 1 }}>
            <Text style={{ dim: true }}>cpu</Text>
            <Box style={{ flexGrow: 1 }}>
              <Progress
                value={cpu}
                style={{ color: cpu > 0.7 ? "red" : cpu > 0.5 ? "yellow" : "green" }}
              />
            </Box>
          </Box>
          <Box style={{ flexDirection: "row", gap: 1, flexGrow: 1 }}>
            <Text style={{ dim: true }}>mem</Text>
            <Box style={{ flexGrow: 1 }}>
              <Progress
                value={mem}
                style={{ color: mem > 0.7 ? "red" : mem > 0.5 ? "yellow" : "green" }}
              />
            </Box>
          </Box>
          <Text style={{ dim: true }}>{reqs.toLocaleString()} req/s</Text>
        </Box>
      </Match>
    </Box>
  );
}

// ── Services panel ──────────────────────────────────────────────

function ServicesPanel() {
  return (
    <Box
      style={{
        flexDirection: "column",
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
      }}
    >
      <Box style={{ paddingX: 1 }}>
        <Text style={{ bold: true, color: "blueBright" }}>services</Text>
      </Box>
      <Box
        style={{
          flexDirection: { base: "column", lg: "row" },
          flexWrap: { base: "nowrap", lg: "wrap" },
        }}
      >
        {SERVICES.map((svc) => (
          <ServiceCard key={svc.name} {...svc} />
        ))}
      </Box>
    </Box>
  );
}

// ── Event log ───────────────────────────────────────────────────

function EventLog() {
  const isWide = useMediaQuery({ minColumns: 80 });
  // Show fewer events on narrow terminals
  const maxEvents = isWide ? EVENTS.length : 4;

  return (
    <Box
      style={{
        flexDirection: "column",
        // Responsive: sidebar on wide, full-width footer on narrow
        width: { base: "100%", md: 32 },
        flexShrink: 0,
      }}
    >
      <Box style={{ paddingX: 1 }}>
        <Text style={{ bold: true, color: "blueBright" }}>event log</Text>
      </Box>
      <Box
        style={{
          flexDirection: "column",
          border: "round",
          borderColor: "blackBright",
          paddingX: 1,
        }}
      >
        {EVENTS.slice(0, maxEvents).map((evt, i) => (
          <Box key={i} style={{ flexDirection: "row", gap: 1 }}>
            <Text style={{ dim: true }}>{evt.time}</Text>
            <Text
              style={{
                color: EVENT_COLOR[evt.kind] ?? "white",
                wrap: "truncate",
              }}
            >
              {evt.msg}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Quick stats (only on lg+) ───────────────────────────────────

function QuickStats() {
  const totalReqs = SERVICES.reduce((sum, s) => sum + s.reqs, 0);
  const avgCpu = SERVICES.reduce((sum, s) => sum + s.cpu, 0) / SERVICES.length;
  const avgMem = SERVICES.reduce((sum, s) => sum + s.mem, 0) / SERVICES.length;

  return (
    <Box
      style={{
        flexDirection: "row",
        gap: 2,
        paddingX: 1,
        paddingY: 0,
      }}
    >
      <Box style={{ flexDirection: "row", gap: 1 }}>
        <Text style={{ dim: true }}>total req/s</Text>
        <Text style={{ bold: true, color: "cyan" }}>
          {totalReqs.toLocaleString()}
        </Text>
      </Box>
      <Box style={{ flexDirection: "row", gap: 1 }}>
        <Text style={{ dim: true }}>avg cpu</Text>
        <Text
          style={{
            bold: true,
            color: avgCpu > 0.7 ? "red" : avgCpu > 0.4 ? "yellow" : "green",
          }}
        >
          {(avgCpu * 100).toFixed(0)}%
        </Text>
      </Box>
      <Box style={{ flexDirection: "row", gap: 1 }}>
        <Text style={{ dim: true }}>avg mem</Text>
        <Text
          style={{
            bold: true,
            color: avgMem > 0.7 ? "red" : avgMem > 0.4 ? "yellow" : "green",
          }}
        >
          {(avgMem * 100).toFixed(0)}%
        </Text>
      </Box>
    </Box>
  );
}

// ── Footer ──────────────────────────────────────────────────────

function Footer() {
  return (
    <Box style={{ paddingX: 1 }}>
      <Text style={{ dim: true }}>
        q quit · r force redraw · resize the terminal to see responsive layout
      </Text>
    </Box>
  );
}

// ── App ─────────────────────────────────────────────────────────

function App() {
  const { exit, forceRedraw, columns, rows } = useApp();
  const [redrawCount, setRedrawCount] = React.useState(0);

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      <Header />

      {/* Stats bar — only visible on lg+ */}
      <Match minColumns={120}>
        <QuickStats />
      </Match>

      {/* Main content: stacks vertically on narrow, row on md+ */}
      <Box
        style={{
          flexDirection: { base: "column", md: "row" },
          flexGrow: 1,
          clip: true,
        }}
      >
        <ServicesPanel />
        <EventLog />
      </Box>

      <Box style={{ paddingX: 1, bg: redrawCount > 0 ? "yellow" : undefined }}>
        <Text style={{ color: redrawCount > 0 ? "black" : "blackBright", bold: redrawCount > 0 }}>
          redraw #{redrawCount} · {columns}×{rows}
        </Text>
      </Box>

      <Footer />

      <Keybind keypress="q" onPress={() => exit()} />
      <Keybind
        keypress="r"
        onPress={() => {
          setRedrawCount((c) => c + 1);
          forceRedraw();
        }}
      />
    </Box>
  );
}

render(<App />);
