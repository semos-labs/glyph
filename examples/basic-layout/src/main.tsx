import React from "react";
import { render, Box, Text, useInput } from "glyph";

function App() {
  useInput((key) => {
    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      process.exit(0);
    }
  });

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        border: "round",
        borderColor: "cyan",
        padding: 1,
      }}
    >
      <Box
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ bold: true, color: "yellowBright" }}>
          Glyph - Terminal UI Framework
        </Text>
      </Box>

      <Box style={{ flexDirection: "row", flexGrow: 1 }}>
        <Box
          style={{
            flexGrow: 1,
            border: "single",
            borderColor: "green",
            padding: 1,
            flexDirection: "column",
          }}
        >
          <Text style={{ bold: true, color: "green" }}>Left Panel</Text>
          <Text style={{ color: "white" }}>
            This is a flex-based layout with borders, colors, and padding.
          </Text>
          <Text style={{ dim: true }}>
            Built with React + Yoga
          </Text>
        </Box>

        <Box
          style={{
            flexGrow: 1,
            border: "single",
            borderColor: "magenta",
            padding: 1,
            flexDirection: "column",
          }}
        >
          <Text style={{ bold: true, color: "magenta" }}>Right Panel</Text>
          <Text style={{ color: "white" }}>
            Flexbox layout powered by Yoga WASM engine.
          </Text>
          <Text style={{ italic: true, color: "cyan" }}>
            Supports bold, italic, dim, underline, and colors.
          </Text>
        </Box>
      </Box>

      <Box
        style={{
          justifyContent: "center",
          alignItems: "center",
          bg: "blue",
          padding: 0,
        }}
      >
        <Text style={{ color: "white", bold: true }}>
          Press 'q' to quit
        </Text>
      </Box>
    </Box>
  );
}

render(<App />);
