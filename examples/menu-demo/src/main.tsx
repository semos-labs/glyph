import React, { useState } from "react";
import {
  render,
  Box,
  Text,
  Menu,
  Keybind,
  useApp,
} from "glyph";

function App() {
  const { exit } = useApp();
  const [lastAction, setLastAction] = useState("(none)");

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
      <Text style={{ bold: true, color: "magentaBright" }}>
        Menu Demo
      </Text>
      <Text style={{ dim: true }}>
        Up/Down to navigate | Enter to select | q to quit
      </Text>

      <Box style={{ flexDirection: "row", flexGrow: 1, gap: 3 }}>
        <Box
          style={{
            border: "single",
            borderColor: "yellow",
            width: 25,
            flexDirection: "column",
            padding: 1,
          }}
        >
          <Text style={{ bold: true, color: "yellowBright", textAlign: "center" }}>
            File Menu
          </Text>
          <Menu
            items={[
              { label: "New File", value: "new" },
              { label: "Open File", value: "open" },
              { label: "Save", value: "save" },
              { label: "Save As...", value: "save-as" },
              { label: "Export", value: "export", disabled: true },
              { label: "Close", value: "close" },
              { label: "Quit", value: "quit" },
            ]}
            onSelect={(value) => {
              if (value === "quit") {
                exit();
              } else {
                setLastAction(value);
              }
            }}
            highlightColor="yellow"
          />
        </Box>

        <Box style={{ flexDirection: "column", gap: 1 }}>
          <Text style={{ bold: true, color: "cyan" }}>Last action:</Text>
          <Text style={{ color: "white" }}>{lastAction}</Text>
        </Box>
      </Box>

      <Box style={{ bg: "magenta", justifyContent: "center" }}>
        <Text style={{ bold: true, color: "black" }}>
          Menu with disabled items
        </Text>
      </Box>

      <Keybind keypress="q" onPress={() => exit()} />
    </Box>
  );
}

render(<App />);
