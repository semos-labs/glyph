import React, { useState } from "react";
import {
  render,
  Box,
  Text,
  Image,
  Keybind,
  useApp,
  detectTerminalCapabilities,
  supportsInlineImages,
} from "@semos-labs/glyph";

// Debug: print terminal detection info
const caps = detectTerminalCapabilities(true);

function App() {
  const { exit } = useApp();
  const canInline = supportsInlineImages();

  return (
    <Box style={{ flexDirection: "column", padding: 1, gap: 1, height: "100%" }}>
      {/* Header */}
      <Box style={{ border: "round", borderColor: "cyan", padding: 1 }}>
        <Text style={{ bold: true, color: "cyan" }}>Image Component Demo</Text>
      </Box>

      {/* Terminal info */}
      <Box style={{ paddingLeft: 1 }}>
        <Text style={{ dim: true }}>
          Terminal: {caps.name} | Inline images: {canInline ? "✓ supported" : "✗ not supported"}
        </Text>
      </Box>

      {/* Images grid */}
      <Box style={{ flexDirection: "row", gap: 2, flexGrow: 1 }}>
        {/* Local image placeholder */}
        <Box style={{ flexDirection: "column", gap: 1, width: 30 }}>
          <Text style={{ bold: true }}>Local Image</Text>
          <Image
            src="./test_image.jpeg"
            style={{ height: 8 }}
            focusedStyle={{ borderColor: "cyan" }}
          />
          <Text style={{ dim: true, fontSize: 0.8 }}>
            Press SPACE to preview
          </Text>
        </Box>

        {/* Remote image placeholder */}
        <Box style={{ flexDirection: "column", gap: 1, width: 30 }}>
          <Text style={{ bold: true }}>Remote Image</Text>
          <Image
            src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=150&fit=crop"
            style={{ height: 8 }}
            focusedStyle={{ borderColor: "cyan" }}
          />
          <Text style={{ dim: true, fontSize: 0.8 }}>
            Downloads & caches
          </Text>
        </Box>

        {/* Auto-load image */}
        <Box style={{ flexDirection: "column", gap: 1, width: 30 }}>
          <Text style={{ bold: true }}>Auto-load</Text>
          <Image
            src="https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=150&h=100&fit=crop"
            style={{ height: 8 }}
            focusedStyle={{ borderColor: "cyan" }}
            autoLoad={canInline}
            inline={true}
          />
          <Text style={{ dim: true, fontSize: 0.8 }}>
            Loads automatically
          </Text>
        </Box>

        {/* OS Preview only (no inline) */}
        <Box style={{ flexDirection: "column", gap: 1, width: 30 }}>
          <Text style={{ bold: true }}>OS Preview</Text>
          <Image
            src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=200&h=150&fit=crop"
            style={{ height: 8 }}
            focusedStyle={{ borderColor: "magenta" }}
            inline={false}
          />
          <Text style={{ dim: true, fontSize: 0.8 }}>
            Quick Look / xdg-open
          </Text>
        </Box>
      </Box>

      {/* Help */}
      <Box style={{ bg: "blackBright", padding: 1 }}>
        <Text style={{ color: "white" }}>
          TAB navigate • SPACE load/preview • ESC clear • q quit
        </Text>
      </Box>

      <Keybind keypress="q" onPress={() => exit()} />
    </Box>
  );
}

render(<App />);
