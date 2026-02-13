import React, { useState } from "react";
import {
  render,
  Box,
  Text,
  Input,
  Keybind,
  useInput,
  useApp,
} from "@semos-labs/glyph";

function App() {
  const { exit } = useApp();
  const [lastKeys, setLastKeys] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [ctrlEnterCount, setCtrlEnterCount] = useState(0);

  // Log ALL keys received (runs after focused handlers if not consumed)
  useInput((key) => {
    const keyInfo = JSON.stringify(key, null, 0);
    setLastKeys((prev) => [...prev.slice(-9), keyInfo]);
  });

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
      <Text style={{ bold: true, color: "cyan" }}>
        Keyboard Input Test - Press keys to see what your terminal sends
      </Text>

      <Box style={{ flexDirection: "column", gap: 0 }}>
        <Text style={{ color: "yellow" }}>Last 10 keys received:</Text>
        {lastKeys.map((k, i) => (
          <Text key={i} style={{ color: "white", dim: i < lastKeys.length - 1 }}>
            {k}
          </Text>
        ))}
        {lastKeys.length === 0 && (
          <Text style={{ color: "white", dim: true }}>(press any key)</Text>
        )}
      </Box>

      <Box style={{ height: 1 }} />

      <Text style={{ color: "green" }}>
        Ctrl+Enter detected (priority keybind): {ctrlEnterCount} times
      </Text>

      {/* Priority keybind for Ctrl+Enter */}
      <Keybind
        keypress="ctrl+return"
        onPress={() => {
          setCtrlEnterCount((c) => c + 1);
          setLastKeys((prev) => [...prev.slice(-9), ">>> CTRL+ENTER KEYBIND FIRED <<<"]);
        }}
        priority
      />

      <Box style={{ height: 1 }} />

      <Box style={{ flexDirection: "column", gap: 0 }}>
        <Text style={{ color: "magenta" }}>Input (type here, then try Ctrl+Enter):</Text>
        <Input
          value={inputValue}
          onChange={setInputValue}
          style={{ border: "round", borderColor: "magenta", padding: 1 }}
          focusedStyle={{ borderColor: "magentaBright" }}
          placeholder="Type something..."
          onKeyPress={(key) => {
            setLastKeys((prev) => [...prev.slice(-9), `[Input got] ${JSON.stringify(key)}`]);
            return false; // Don't consume, let it propagate
          }}
        />
      </Box>

      <Box style={{ flexGrow: 1 }} />

      <Box style={{ bg: "cyan" }}>
        <Text style={{ bold: true, color: "black" }}>
          Press 'q' to quit | Try: Ctrl+Enter, Enter, Ctrl+C, F1, Arrow keys
        </Text>
      </Box>

      <Keybind keypress="q" onPress={() => exit()} />
      <Keybind keypress="ctrl+c" onPress={() => exit()} />
    </Box>
  );
}

render(<App />);
