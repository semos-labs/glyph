import React, { useState } from "react";
import {
  render,
  Box,
  Text,
  List,
  Keybind,
  useApp,
} from "@semos-labs/glyph";

const FRUITS = [
  "Apple", "Banana", "Cherry", "Dragonfruit", "Elderberry",
  "Fig", "Grape", "Honeydew", "Kiwi", "Lemon",
  "Mango", "Nectarine", "Orange", "Papaya", "Quince",
];

function App() {
  const { exit } = useApp();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        border: "round",
        borderColor: "green",
        padding: 1,
        gap: 1,
      }}
    >
      <Text style={{ bold: true, color: "greenBright" }}>
        List Demo - Fruit Picker
      </Text>
      <Text style={{ dim: true }}>
        Up/Down to navigate | Enter to select | q to quit
      </Text>

      <Box style={{ flexDirection: "row", flexGrow: 1, gap: 2 }}>
        <Box
          style={{
            border: "single",
            borderColor: "cyan",
            width: 30,
            flexDirection: "column",
          }}
        >
          <List
            count={FRUITS.length}
            onSelect={(index) => setSelected(FRUITS[index]!)}
            disabledIndices={new Set([3, 7])}
            renderItem={({ index, selected: isSel, focused }) => {
              const fruit = FRUITS[index]!;
              const disabled = index === 3 || index === 7;
              const highlight = isSel && focused;
              return (
                <Box
                  style={{
                    ...(highlight ? { bg: "cyan" } : {}),
                  }}
                >
                  <Text
                    style={
                      disabled
                        ? { dim: true }
                        : highlight
                          ? { bold: true, color: "black" }
                          : { color: isSel ? "cyan" : "white" }
                    }
                  >
                    {isSel ? "> " : "  "}{fruit}{disabled ? " (disabled)" : ""}
                  </Text>
                </Box>
              );
            }}
          />
        </Box>

        <Box style={{ flexDirection: "column", gap: 1 }}>
          <Text style={{ bold: true, color: "yellow" }}>Selection:</Text>
          {selected ? (
            <Text style={{ color: "greenBright" }}>You picked: {selected}</Text>
          ) : (
            <Text style={{ dim: true }}>Press Enter to pick a fruit</Text>
          )}
        </Box>
      </Box>

      <Box style={{ bg: "green", justifyContent: "center" }}>
        <Text style={{ bold: true, color: "black" }}>
          {FRUITS.length} items | Dragonfruit & Honeydew disabled
        </Text>
      </Box>

      <Keybind keypress="q" onPress={() => exit()} />
    </Box>
  );
}

render(<App />);
