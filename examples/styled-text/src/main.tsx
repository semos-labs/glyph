import React, { useState } from "react";
import { render, Box, Text, Keybind, useApp, ScrollView } from "@semos-labs/glyph";

/**
 * Demonstrates nested Text component composability.
 * 
 * Instead of using raw ANSI escape codes, you can compose
 * Text components to create rich styled text with proper
 * style inheritance.
 */

// Helper components for common patterns
function Bold({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={{ bold: true, color: color as any }}>{children}</Text>;
}

function Dim({ children }: { children: React.ReactNode }) {
  return <Text style={{ dim: true }}>{children}</Text>;
}

function Italic({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={{ italic: true, color: color as any }}>{children}</Text>;
}

function Underline({ children }: { children: React.ReactNode }) {
  return <Text style={{ underline: true }}>{children}</Text>;
}

function Link({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: "cyan", underline: true }}>{children}</Text>;
}

function Success({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: "green" }}>{children}</Text>;
}

function Warning({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: "yellow" }}>{children}</Text>;
}

function Error({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: "red" }}>{children}</Text>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <Text style={{ bg: "blackBright", color: "yellow" }}> {children} </Text>;
}

function App() {
  const { exit } = useApp();
  const [activeSection, setActiveSection] = useState(0);
  const sections = ["Basics", "Rich Text", "Code Example", "Real World", "Deep Nesting"];

  return (
    <Box style={{ flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <Box style={{ borderColor: "magenta", border: "round" }}>
        <Text style={{ bold: true, color: "magenta" }}>
          ✨ Nested Text Composability Demo
        </Text>
      </Box>

      {/* Navigation */}
      <Box>
        {sections.map((section, i) => (
          <Text
            key={section}
            style={{ 
              color: activeSection === i ? "cyan" : "white",
              bold: activeSection === i,
              bg: activeSection === i ? "blue" : undefined,
            }}
          >
            {activeSection === i ? " ▸ " : "   "}{section}{" "}
          </Text>
        ))}
      </Box>

      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ flexDirection: "column" }}>
          
          {/* Section 0: Basic Nesting */}
          {activeSection === 0 && (
            <Box style={{ flexDirection: "column" }}>
              <Text style={{ bold: true, color: "cyan", underline: true }}>
                Basic Style Nesting
              </Text>
              <Text>
                Hello <Bold>world</Bold>! This is <Italic>italic</Italic> and{" "}
                <Underline>underlined</Underline> text.
              </Text>
              <Text>
                Mix styles: <Bold><Italic>bold italic</Italic></Bold>,{" "}
                <Text style={{ color: "red", bold: true }}>
                  bold red with <Text style={{ underline: true }}>underline</Text>
                </Text>
              </Text>
              <Text />
              <Text style={{ dim: true }}>Nest Text components to compose styles.</Text>
            </Box>
          )}

          {/* Section 1: Rich Text */}
          {activeSection === 1 && (
            <Box style={{ flexDirection: "column" }}>
              <Text style={{ bold: true, color: "cyan", underline: true }}>
                Rich Text Components
              </Text>
              <Text>
                <Success>✓ Build passed</Success> - All 84 tests passing
              </Text>
              <Text>
                <Warning>⚠ Warning:</Warning> Node version is outdated
              </Text>
              <Text>
                <Error>✗ Error:</Error> Missing required field <Code>name</Code>
              </Text>
              <Text>
                Visit <Link>https://glyph.dev</Link> for documentation
              </Text>
              <Text />
              <Text style={{ dim: true }}>Create helper components like Success, Warning, Error.</Text>
            </Box>
          )}

          {/* Section 2: Code-like formatting */}
          {activeSection === 2 && (
            <Box style={{ flexDirection: "column" }}>
              <Text style={{ bold: true, color: "cyan", underline: true }}>
                Code Documentation Style
              </Text>
              <Text>
                The <Code>Text</Code> component supports{" "}
                <Bold color="yellow">nested children</Bold> with style inheritance.
              </Text>
              <Text>
                Use <Code>style</Code> prop for{" "}
                <Text style={{ color: "green" }}>color</Text>,{" "}
                <Text style={{ bold: true }}>bold</Text>,{" "}
                <Text style={{ italic: true }}>italic</Text>,{" "}
                <Text style={{ underline: true }}>underline</Text>, and{" "}
                <Text style={{ dim: true }}>dim</Text>.
              </Text>
              <Text>
                <Dim>// Styles cascade from parent to child</Dim>
              </Text>
            </Box>
          )}

          {/* Section 3: Real World Example */}
          {activeSection === 3 && (
            <Box style={{ flexDirection: "column" }}>
              <Text style={{ bold: true, color: "cyan", underline: true }}>
                Real World: Git Status
              </Text>
              <Text>
                <Success>✓</Success> On branch <Text style={{ color: "cyan" }}>main</Text>
              </Text>
              <Text style={{ dim: true }}>
                Your branch is up to date with 'origin/main'.
              </Text>
              <Text />
              <Text style={{ color: "yellow" }}>Changes not staged for commit:</Text>
              <Text>
                {"  "}<Error>modified:</Error>{"   "}src/components/Text.tsx
              </Text>
              <Text>
                {"  "}<Error>modified:</Error>{"   "}src/paint/painter.ts
              </Text>
              <Text />
              <Text style={{ color: "green" }}>Changes to be committed:</Text>
              <Text>
                {"  "}<Success>new file:</Success>{"   "}src/reconciler/nodes.ts
              </Text>
            </Box>
          )}

          {/* Section 4: Deep nesting */}
          {activeSection === 4 && (
            <Box style={{ flexDirection: "column" }}>
              <Text style={{ bold: true, color: "cyan", underline: true }}>
                Deeply Nested Styles
              </Text>
              <Text style={{ color: "white" }}>
                L1 (white) → <Text style={{ color: "blue" }}>
                  L2 (blue) → <Text style={{ bold: true }}>
                    L3 (+bold) → <Text style={{ color: "yellow" }}>
                      L4 (yellow) → <Text style={{ italic: true, underline: true }}>
                        L5 (+italic+underline)
                      </Text>
                    </Text>
                  </Text>
                </Text>
              </Text>
              <Text />
              <Text style={{ dim: true }}>Child styles merge with and override parent styles.</Text>
            </Box>
          )}

        </Box>
      </ScrollView>

      {/* Footer */}
      <Box style={{ bg: "blackBright" }}>
        <Text style={{ dim: true }}>
          ←→ navigate • <Text style={{ color: "red" }}>q</Text> quit
        </Text>
      </Box>

      <Keybind keypress="q" onPress={() => exit()} />
      <Keybind keypress="left" onPress={() => setActiveSection(s => Math.max(0, s - 1))} />
      <Keybind keypress="right" onPress={() => setActiveSection(s => Math.min(sections.length - 1, s + 1))} />
    </Box>
  );
}

render(<App />);
