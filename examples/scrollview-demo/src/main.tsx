import React from "react";
import {
  render,
  Box,
  Text,
  ScrollView,
  Keybind,
  useApp,
} from "glyph";

function App() {
  const { exit } = useApp();

  const lines: string[] = [];
  for (let i = 1; i <= 50; i++) {
    lines.push(`Line ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`);
  }

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        border: "round",
        borderColor: "blue",
        padding: 1,
        gap: 1,
      }}
    >
      <Text style={{ bold: true, color: "blueBright" }}>
        ScrollView Demo
      </Text>
      <Text style={{ dim: true }}>
        j/k or Arrows | Ctrl+d/u half-page | G end | gg top | q quit
      </Text>

      <ScrollView
        style={{
          flexGrow: 1,
          border: "single",
          borderColor: "cyan",
        }}
      >
        {lines.map((line, i) => (
          <Box key={i}>
            <Text style={{ color: i % 2 === 0 ? "white" : "blackBright" }}>
              {line}
            </Text>
          </Box>
        ))}
      </ScrollView>

      <Box style={{ bg: "blue", justifyContent: "center" }}>
        <Text style={{ bold: true }}>
          Scroll through 50 lines of content
        </Text>
      </Box>

      <Keybind keypress="q" onPress={() => exit()} />
    </Box>
  );
}

render(<App />);
