import React, { useRef, useState } from "react";
import {
  render,
  Box,
  Text,
  Button,
  ScrollView,
  Keybind,
  useApp,
} from "@semos-labs/glyph";
import type { ScrollViewHandle } from "@semos-labs/glyph";

// ─── Section 1: Follow-Focus ─────────────────────────────────────────
// A list of focusable buttons inside a ScrollView.
// Tab / Shift+Tab between them — the ScrollView should auto-scroll
// to keep the focused button visible.

function FollowFocusDemo() {
  const items = Array.from({ length: 30 }, (_, i) => `Item ${i + 1}`);

  return (
    <Box style={{ flexDirection: "column", flexGrow: 1, gap: 1 }}>
      <Text style={{ bold: true, color: "greenBright" }}>
        1 · Follow Focus
      </Text>
      <Text style={{ dim: true }}>
        Tab / Shift+Tab through the buttons — ScrollView auto-scrolls.
      </Text>

      <ScrollView
        style={{
          flexGrow: 1,
          border: "single",
          borderColor: "green",
          padding: 1,
        }}
      >
        {items.map((label) => (
          <Button
            key={label}
            label={label}
            style={{ paddingX: 1 }}
            focusedStyle={{ bg: "green", color: "black" }}
          />
        ))}
      </ScrollView>
    </Box>
  );
}

// ─── Section 2: scrollIntoView ───────────────────────────────────────
// A ScrollView with numbered items and buttons to programmatically
// scroll to specific items using different alignment modes.

function ScrollIntoViewDemo() {
  const svRef = useRef<ScrollViewHandle>(null);
  const [targetIdx, setTargetIdx] = useState(15);

  const items = Array.from({ length: 40 }, (_, i) => `Row ${i + 1}`);

  return (
    <Box style={{ flexDirection: "column", flexGrow: 1, gap: 1 }}>
      <Text style={{ bold: true, color: "magentaBright" }}>
        2 · scrollToIndex
      </Text>
      <Text style={{ dim: true }}>
        Press 1/2/3/4 to scroll to Row {targetIdx + 1} with different
        alignments. +/- to change target.
      </Text>

      {/* Control buttons */}
      <Box style={{ flexDirection: "row", gap: 1 }}>
        <Button
          label=" ← "
          onPress={() => setTargetIdx((i) => Math.max(0, i - 5))}
          focusedStyle={{ bg: "magenta", color: "black" }}
        />
        <Text style={{ color: "magentaBright", bold: true }}>
          Target: Row {targetIdx + 1}
        </Text>
        <Button
          label=" → "
          onPress={() => setTargetIdx((i) => Math.min(items.length - 1, i + 5))}
          focusedStyle={{ bg: "magenta", color: "black" }}
        />
      </Box>

      <ScrollView
        ref={svRef}
        style={{
          flexGrow: 1,
          border: "single",
          borderColor: "magenta",
          padding: 1,
        }}
      >
        {items.map((label, i) => {
          const isTarget = i === targetIdx;
          return (
            <Box
              key={i}
              style={{
                paddingX: 1,
                ...(isTarget ? { bg: "magenta", color: "black" } : {}),
              }}
            >
              <Text
                style={{
                  bold: isTarget,
                  ...(isTarget ? { color: "black" } : {}),
                  ...(!isTarget && i % 2 === 0 ? { dim: true } : {}),
                }}
              >
                {isTarget ? `▶ ${label} ◀  (target)` : `  ${label}`}
              </Text>
            </Box>
          );
        })}
      </ScrollView>

      {/* Alignment keybinds — use ref-based scrollToIndex (works for off-screen items) */}
      <Keybind keypress="1" onPress={() => svRef.current?.scrollToIndex(targetIdx, { block: "nearest" })} />
      <Keybind keypress="2" onPress={() => svRef.current?.scrollToIndex(targetIdx, { block: "start" })} />
      <Keybind keypress="3" onPress={() => svRef.current?.scrollToIndex(targetIdx, { block: "center" })} />
      <Keybind keypress="4" onPress={() => svRef.current?.scrollToIndex(targetIdx, { block: "end" })} />
    </Box>
  );
}

// ─── Section 3: Follow-Focus (virtualized) ───────────────────────────
// Same as Section 1 but with virtualize={true} to exercise the
// virtualised path.

function VirtualizedFollowFocusDemo() {
  const items = Array.from({ length: 100 }, (_, i) => `Virtual ${i + 1}`);

  return (
    <Box style={{ flexDirection: "column", flexGrow: 1, gap: 1 }}>
      <Text style={{ bold: true, color: "cyanBright" }}>
        3 · Follow Focus (virtualized)
      </Text>
      <Text style={{ dim: true }}>
        Same as #1 but with virtualize. 100 items, only visible ones
        mounted.
      </Text>

      <ScrollView
        virtualize
        style={{
          flexGrow: 1,
          border: "single",
          borderColor: "cyan",
          padding: 1,
        }}
      >
        {items.map((label) => (
          <Button
            key={label}
            label={label}
            style={{ paddingX: 1 }}
            focusedStyle={{ bg: "cyan", color: "black" }}
          />
        ))}
      </ScrollView>
    </Box>
  );
}

// ─── App ─────────────────────────────────────────────────────────────

function App() {
  const { exit } = useApp();

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: 1,
        gap: 1,
      }}
    >
      <Text style={{ bold: true, color: "blueBright" }}>
        ScrollView Demo — Follow Focus + scrollIntoView
      </Text>
      <Text style={{ dim: true }}>
        Tab between sections · 1-4 scroll alignment · +/- change target · q quit
      </Text>

      <Box style={{ flexDirection: "row", flexGrow: 1, gap: 2 }}>
        <FollowFocusDemo />
        <ScrollIntoViewDemo />
        <VirtualizedFollowFocusDemo />
      </Box>

      <Box style={{ bg: "blue", justifyContent: "center", paddingX: 1 }}>
        <Text style={{ bold: true }}>
          1 nearest · 2 start · 3 center · 4 end · Tab focus · q quit
        </Text>
      </Box>

      <Keybind keypress="q" onPress={() => exit()} />
    </Box>
  );
}

render(<App />, { debug: true });
