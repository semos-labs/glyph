import React from "react";
import { render, Box, Text, Keybind, useApp, ScrollView } from "@semos-labs/glyph";

// ANSI escape codes for styling
const ESC = "\x1b";
const RESET = `${ESC}[0m`;
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const ITALIC = `${ESC}[3m`;
const UNDERLINE = `${ESC}[4m`;

// Foreground colors
const RED = `${ESC}[31m`;
const GREEN = `${ESC}[32m`;
const YELLOW = `${ESC}[33m`;
const BLUE = `${ESC}[34m`;
const CYAN = `${ESC}[36m`;
const BRIGHT_RED = `${ESC}[91m`;
const BRIGHT_GREEN = `${ESC}[92m`;

// 256 colors
const fg256 = (n: number) => `${ESC}[38;5;${n}m`;

// True color (24-bit)
const fgRGB = (r: number, g: number, b: number) => `${ESC}[38;2;${r};${g};${b}m`;

function App() {
  const { exit } = useApp();

  const gitStatus = `${GREEN}✓${RESET} On branch ${CYAN}main${RESET}
${DIM}Your branch is up to date with 'origin/main'.${RESET}

${YELLOW}Changes not staged for commit:${RESET}
  ${RED}modified:${RESET}   src/components/Text.tsx
  ${RED}modified:${RESET}   src/paint/painter.ts

${GREEN}Changes to be committed:${RESET}
  ${GREEN}new file:${RESET}   src/paint/ansi.ts`;

  const table = `${DIM}┌─────────────────────┬────────────┬─────────────┐${RESET}
${DIM}│${RESET}${BOLD}${BLUE} Status              ${RESET}${DIM}│${RESET}${BOLD}${BLUE} Count      ${RESET}${DIM}│${RESET}${BOLD}${BLUE} Trend       ${RESET}${DIM}│${RESET}
${DIM}├─────────────────────┼────────────┼─────────────┤${RESET}
${DIM}│${RESET} ${BRIGHT_GREEN}Passing${RESET}             ${DIM}│${RESET} 142        ${DIM}│${RESET} ${GREEN}↑ +12${RESET}       ${DIM}│${RESET}
${DIM}│${RESET} ${BRIGHT_RED}Failing${RESET}             ${DIM}│${RESET} 3          ${DIM}│${RESET} ${RED}↓ -2${RESET}        ${DIM}│${RESET}
${DIM}│${RESET} ${YELLOW}Pending${RESET}             ${DIM}│${RESET} 7          ${DIM}│${RESET} ${DIM}—${RESET}           ${DIM}│${RESET}
${DIM}└─────────────────────┴────────────┴─────────────┘${RESET}`;

  const rainbow = Array.from({ length: 36 }, (_, i) => 
    `${fg256(196 + Math.floor(i / 6))}█`
  ).join("") + RESET;

  const trueColorGradient = Array.from({ length: 40 }, (_, i) => {
    const r = Math.floor(255 - (i * 6));
    const g = Math.floor(i * 6);
    const b = 128;
    return `${fgRGB(r, g, b)}▓`;
  }).join("") + RESET;

  const styledMessage = `${BOLD}${BLUE}Info:${RESET} The ${ITALIC}Text${RESET} component renders ${UNDERLINE}ANSI codes${RESET} automatically!`;

  return (
    <Box style={{ flexDirection: "column", height: "100%" }}>
      <Box style={{ padding: 1, borderColor: "cyan", border: "round" }}>
        <Text style={{ bold: true, color: "cyan" }}>ANSI Escape Code Demo</Text>
      </Box>

      <ScrollView style={{ flexGrow: 1, padding: 1 }}>
        <Box style={{ flexDirection: "column", gap: 1 }}>
          <Text style={{ bold: true, dim: true }}>Git Status:</Text>
          <Box style={{ paddingLeft: 2 }}>
            <Text>{gitStatus}</Text>
          </Box>

          <Text style={{ bold: true, dim: true }}>Table with Colors:</Text>
          <Box style={{ paddingLeft: 2 }}>
            <Text>{table}</Text>
          </Box>

          <Text style={{ bold: true, dim: true }}>256-Color Palette:</Text>
          <Box style={{ paddingLeft: 2 }}>
            <Text>{rainbow}</Text>
          </Box>

          <Text style={{ bold: true, dim: true }}>True Color Gradient:</Text>
          <Box style={{ paddingLeft: 2 }}>
            <Text>{trueColorGradient}</Text>
          </Box>

          <Text style={{ bold: true, dim: true }}>Mixed Styles:</Text>
          <Box style={{ paddingLeft: 2 }}>
            <Text>{styledMessage}</Text>
          </Box>
        </Box>
      </ScrollView>

      <Box style={{ padding: 1, bg: "blackBright" }}>
        <Text style={{ dim: true }}>↑↓ scroll • q quit</Text>
      </Box>

      <Keybind keypress="q" onPress={() => exit()} />
    </Box>
  );
}

render(<App />);
