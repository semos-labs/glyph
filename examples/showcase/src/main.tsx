import React, { useState, useEffect, useCallback } from "react";
import {
  render,
  Box,
  Text,
  Progress,
  Spinner,
  ToastHost,
  useToast,
  Keybind,
  Spacer,
  useApp,
} from "@semos-labs/glyph";

const VARIANTS = ["info", "success", "warning", "error"] as const;

function App() {
  const { exit } = useApp();
  const toast = useToast();

  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(true);

  // Simulate progress 0 → 1
  useEffect(() => {
    if (!running) return;
    if (progress >= 1) {
      setRunning(false);
      toast({ message: "Task completed!", variant: "success", title: "Done" });
      return;
    }
    const timer = setTimeout(() => {
      setProgress((p) => Math.min(1, p + 0.02));
    }, 80);
    return () => clearTimeout(timer);
  }, [progress, running]);

  const restart = useCallback(() => {
    setProgress(0);
    setRunning(true);
  }, []);

  const randomToast = useCallback(() => {
    const variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)]!;
    const messages: Record<string, string> = {
      info: "Something happened",
      success: "Operation succeeded",
      warning: "Disk space is low",
      error: "Connection failed",
    };
    toast({
      message: messages[variant]!,
      variant,
      title: variant.charAt(0).toUpperCase() + variant.slice(1),
    });
  }, [toast]);

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        border: "round",
        borderColor: "magenta",
        padding: 1,
        gap: 1,
      }}
    >
      <Text style={{ bold: true, color: "magentaBright", textAlign: "center" }}>
        Glyph Component Showcase
      </Text>

      <Box style={{ flexDirection: "column", gap: 1 }}>
        <Text style={{ bold: true, color: "cyan" }}>Progress (determinate)</Text>
        <Progress
          value={progress}
          showPercent
          style={{ paddingX: 1 }}
        />
      </Box>

      <Box style={{ flexDirection: "column", gap: 1 }}>
        <Text style={{ bold: true, color: "cyan" }}>Progress (indeterminate)</Text>
        <Progress indeterminate style={{ paddingX: 1 }} />
      </Box>

      <Box style={{ flexDirection: "row", gap: 2 }}>
        <Box style={{ flexDirection: "column", gap: 1 }}>
          <Text style={{ bold: true, color: "cyan" }}>Spinners</Text>
          <Spinner label="Loading..." style={{ color: "green" }} />
          <Spinner
            frames={["|", "/", "-", "\\"]}
            label="Processing..."
            style={{ color: "yellow" }}
          />
        </Box>

        <Box style={{ flexDirection: "column", gap: 1 }}>
          <Text style={{ bold: true, color: "cyan" }}>Status</Text>
          <Text>
            {running
              ? `Running... ${Math.round(progress * 100)}%`
              : "Idle (press p to restart)"}
          </Text>
        </Box>
      </Box>

      <Spacer />

      <Box style={{ bg: "magenta", justifyContent: "center" }}>
        <Text style={{ bold: true, color: "black" }}>
          t = toast | p = restart progress | q = quit
        </Text>
      </Box>

      <Keybind keypress="t" onPress={randomToast} />
      <Keybind keypress="p" onPress={restart} />
      <Keybind keypress="q" onPress={() => exit()} />
    </Box>
  );
}

function Root() {
  return (
    <ToastHost position="top-right">
      <App />
    </ToastHost>
  );
}

render(<Root />);
