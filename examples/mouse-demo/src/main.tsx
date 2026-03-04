import React, { useState } from "react";
import {
  render,
  Box,
  Text,
  Button,
  Input,
  Checkbox,
  ScrollView,
  useMouse,
} from "@semos-labs/glyph";
import type { MouseEvent } from "@semos-labs/glyph";

function MousePosition() {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useMouse((event: MouseEvent) => {
    if (event.type === "mousemove") {
      setPos({ x: event.x, y: event.y });
    }
  });

  return (
    <Text style={{ dim: true }}>
      Mouse: ({pos.x}, {pos.y})
    </Text>
  );
}

function App() {
  const [log, setLog] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [checked, setChecked] = useState(false);

  const addLog = (msg: string) => {
    setLog((prev) => [...prev.slice(-8), msg]);
  };

  return (
    <Box style={{ flexDirection: "column", padding: 1, gap: 1 }}>
      <Text style={{ bold: true, color: "cyan" }}>Mouse Demo</Text>
      <MousePosition />

      <Box style={{ flexDirection: "row", gap: 2 }}>
        {/* Clickable buttons */}
        <Box style={{ flexDirection: "column", gap: 1, width: 30 }}>
          <Text style={{ bold: true }}>Buttons (click me!)</Text>
          <Button
            label={`Clicked ${count} times`}
            onPress={() => {
              setCount((c) => c + 1);
              addLog(`Button clicked! Count: ${count + 1}`);
            }}
            style={{ border: "round", paddingX: 2 }}
            focusedStyle={{ bg: "cyan", color: "black" }}
          />
          <Button
            label="Reset"
            onPress={() => {
              setCount(0);
              addLog("Counter reset");
            }}
            style={{ border: "round", paddingX: 2 }}
            focusedStyle={{ bg: "red", color: "white" }}
          />
        </Box>

        {/* Input with click-to-position cursor */}
        <Box style={{ flexDirection: "column", gap: 1, width: 30 }}>
          <Text style={{ bold: true }}>Input (click to focus)</Text>
          <Input
            value={inputValue}
            onChange={setInputValue}
            placeholder="Click here to type..."
            style={{ border: "round", paddingX: 1 }}
            focusedStyle={{ borderColor: "cyan" }}
          />
          <Checkbox
            checked={checked}
            onChange={(v) => {
              setChecked(v);
              addLog(`Checkbox: ${v ? "checked" : "unchecked"}`);
            }}
            label="Click to toggle"
          />
        </Box>
      </Box>

      {/* Scrollable area with wheel support */}
      <Box style={{ flexDirection: "column", gap: 1 }}>
        <Text style={{ bold: true }}>ScrollView (use mouse wheel)</Text>
        <ScrollView style={{ height: 6, border: "single", width: 40 }}>
          {Array.from({ length: 20 }, (_, i) => (
            <Box
              key={i}
              style={{ paddingX: 1 }}
              onClick={() => addLog(`Clicked item ${i}`)}
            >
              <Text>Item {i} - click or scroll</Text>
            </Box>
          ))}
        </ScrollView>
      </Box>

      {/* Event log */}
      <Box style={{ flexDirection: "column" }}>
        <Text style={{ bold: true, color: "yellow" }}>Event Log:</Text>
        {log.map((entry, i) => (
          <Text key={i} style={{ dim: true }}>
            {entry}
          </Text>
        ))}
      </Box>

      <Text style={{ dim: true }}>Press Ctrl+C to exit</Text>
    </Box>
  );
}

render(<App />);
