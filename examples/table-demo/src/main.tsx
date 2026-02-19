import React, { useState } from "react";
import { render, Box, Text, ScrollView, Table, TableRow, TableCell, useInput, useLayout } from "@semos-labs/glyph";

function App() {
  const [scrollOffset, setScrollOffset] = useState(0);

  useInput((key) => {
    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      process.exit(0);
    }

    const halfPage = 10;
    const fullPage = 20;

    if (key.name === "up") setScrollOffset((o) => Math.max(0, o - 1));
    else if (key.name === "down") setScrollOffset((o) => o + 1);
    else if (key.name === "pageup") setScrollOffset((o) => Math.max(0, o - fullPage));
    else if (key.name === "pagedown") setScrollOffset((o) => o + fullPage);
    else if (key.ctrl) {
      if (key.name === "d") setScrollOffset((o) => o + halfPage);
      else if (key.name === "u") setScrollOffset((o) => Math.max(0, o - halfPage));
      else if (key.name === "f") setScrollOffset((o) => o + fullPage);
      else if (key.name === "b") setScrollOffset((o) => Math.max(0, o - fullPage));
    }
  });

  return (
    <ScrollView scrollOffset={scrollOffset} onScroll={setScrollOffset} style={{ flexGrow: 1 }}>
    <Box style={{ flexDirection: "column", padding: 1, gap: 2 }}>
      <Text style={{ bold: true, color: "yellowBright" }}>
        ✨ Table Component Demo
      </Text>

      {/* ── Single border (default) ── */}
      <Box style={{ flexDirection: "column", gap: 1 }}>
        <Text style={{ color: "cyan", bold: true }}>Single border:</Text>
        <Table borderColor="cyan">
          <TableRow>
            <TableCell style={{ bold: true }}>Name</TableCell>
            <TableCell style={{ bold: true }}>Role</TableCell>
            <TableCell style={{ bold: true }}>Status</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Alice</TableCell>
            <TableCell>Engineer</TableCell>
            <TableCell style={{ color: "green" }}>Active</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Bob</TableCell>
            <TableCell>Designer</TableCell>
            <TableCell style={{ color: "green" }}>Active</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Charlie</TableCell>
            <TableCell>PM</TableCell>
            <TableCell style={{ color: "red" }}>Away</TableCell>
          </TableRow>
        </Table>
      </Box>

      {/* ── Double border ── */}
      <Box style={{ flexDirection: "column", gap: 1 }}>
        <Text style={{ color: "magenta", bold: true }}>Double border:</Text>
        <Table border="double" borderColor="magenta">
          <TableRow>
            <TableCell style={{ bold: true }}>Language</TableCell>
            <TableCell style={{ bold: true }}>Year</TableCell>
            <TableCell style={{ bold: true }}>Typing</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>TypeScript</TableCell>
            <TableCell>2012</TableCell>
            <TableCell>Static</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Rust</TableCell>
            <TableCell>2015</TableCell>
            <TableCell>Static</TableCell>
          </TableRow>
        </Table>
      </Box>

      {/* ── Round border ── */}
      <Box style={{ flexDirection: "column", gap: 1 }}>
        <Text style={{ color: "green", bold: true }}>Round border:</Text>
        <Table border="round" borderColor="green">
          <TableRow>
            <TableCell style={{ bold: true }}>Metric</TableCell>
            <TableCell style={{ bold: true }}>Value</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>CPU</TableCell>
            <TableCell>42%</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Memory</TableCell>
            <TableCell>1.2 GB</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Disk</TableCell>
            <TableCell>67%</TableCell>
          </TableRow>
        </Table>
      </Box>

      {/* ── Column wrap ── */}
      <Box style={{ flexDirection: "column", gap: 1 }}>
        <Text style={{ color: "yellow", bold: true }}>Column wrap (hugs content):</Text>
        <Table wrap borderColor="yellow">
          <TableRow>
            <TableCell style={{ bold: true }}>ID</TableCell>
            <TableCell style={{ bold: true }}>Name</TableCell>
            <TableCell style={{ bold: true }}>Status</TableCell>
            <TableCell style={{ bold: true }}>Description</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>1</TableCell>
            <TableCell>Alice</TableCell>
            <TableCell style={{ color: "green" }}>OK</TableCell>
            <TableCell>Frontend engineer</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>42</TableCell>
            <TableCell>Bob</TableCell>
            <TableCell style={{ color: "red" }}>ERR</TableCell>
            <TableCell>Backend lead</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>7</TableCell>
            <TableCell>Charlie</TableCell>
            <TableCell style={{ color: "green" }}>OK</TableCell>
            <TableCell>PM</TableCell>
          </TableRow>
        </Table>
      </Box>

      {/* ── Clean variant ── */}
      <Box style={{ flexDirection: "column", gap: 1 }}>
        <Text style={{ color: "white", bold: true }}>Clean (header separator only):</Text>
        <Table variant="clean" borderColor="white">
          <TableRow>
            <TableCell style={{ bold: true }}>Name</TableCell>
            <TableCell style={{ bold: true }}>Role</TableCell>
            <TableCell style={{ bold: true }}>Status</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Alice</TableCell>
            <TableCell>Engineer</TableCell>
            <TableCell style={{ color: "green" }}>Active</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Bob</TableCell>
            <TableCell>Designer</TableCell>
            <TableCell style={{ color: "green" }}>Active</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Charlie</TableCell>
            <TableCell>PM</TableCell>
            <TableCell style={{ color: "red" }}>Away</TableCell>
          </TableRow>
        </Table>
      </Box>

      {/* ── Clean-vertical variant ── */}
      <Box style={{ flexDirection: "column", gap: 1 }}>
        <Text style={{ color: "blueBright", bold: true }}>Clean-vertical (header + column dividers):</Text>
        <Table variant="clean-vertical" wrap borderColor="blueBright">
          <TableRow>
            <TableCell style={{ bold: true }}>PID</TableCell>
            <TableCell style={{ bold: true }}>Command</TableCell>
            <TableCell style={{ bold: true }}>CPU</TableCell>
            <TableCell style={{ bold: true }}>Memory</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>1234</TableCell>
            <TableCell>node</TableCell>
            <TableCell>12.3%</TableCell>
            <TableCell>256 MB</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>5678</TableCell>
            <TableCell>bun</TableCell>
            <TableCell>3.1%</TableCell>
            <TableCell>128 MB</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>9012</TableCell>
            <TableCell>postgres</TableCell>
            <TableCell>0.5%</TableCell>
            <TableCell>512 MB</TableCell>
          </TableRow>
        </Table>
      </Box>

      <Text style={{ dim: true }}>Press 'q' to quit • ↑/↓ to scroll</Text>
    </Box>
    </ScrollView>
  );
}

render(<App />);
