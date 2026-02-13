import React from "react";
import {
  render,
  Box,
  Text,
  ScrollView,
  Keybind,
  useApp,
} from "@semos-labs/glyph";

// Generate items with varying heights
const items = Array.from({ length: 1000 }, (_, i) => {
  const isComplex = i % 10 === 0;
  const isImportant = i % 5 === 0;
  
  return {
    id: i + 1,
    title: isComplex 
      ? `★ Item ${i + 1} - Complex Item`
      : `Item ${i + 1}`,
    description: isComplex 
      ? "This is a longer description that spans\nmultiple lines to test variable height\nvirtualization support."
      : undefined,
    tags: isComplex ? ["featured", "multiline"] : isImportant ? ["important"] : [],
    isComplex,
    isImportant,
  };
});

// Complex multi-line item component
function ComplexItem({ item }: { item: typeof items[0] }) {
  return (
    <Box style={{ 
      flexDirection: "column", 
      borderBottom: "single", 
      borderColor: "cyan",
      paddingBottom: 1,
    }}>
      <Text>
        <Text style={{ color: "blackBright" }}>{String(item.id).padStart(5, " ")} │</Text>
        {" "}
        <Text style={{ bold: true, color: "cyan" }}>{item.title}</Text>
      </Text>
      {item.description && (
        <Text style={{ dim: true, paddingLeft: 8 }}>{item.description}</Text>
      )}
      {item.tags.length > 0 && (
        <Box style={{ paddingLeft: 8, flexDirection: "row", gap: 1 }}>
          {item.tags.map(tag => (
            <Text key={tag} style={{ color: "black", bg: "yellow" }}> {tag} </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

// Simple single-line item
function SimpleItem({ item }: { item: typeof items[0] }) {
  return (
    <Text>
      <Text style={{ color: "blackBright" }}>{String(item.id).padStart(5, " ")} │</Text>
      {" "}
      {item.isImportant ? (
        <Text style={{ color: "yellow" }}>{item.title}</Text>
      ) : (
        <Text>{item.title}</Text>
      )}
    </Text>
  );
}

function App() {
  const { exit } = useApp();

  return (
    <Box style={{ flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <Box style={{ border: "round", borderColor: "magenta" }}>
        <Text style={{ bold: true, color: "magenta" }}>
          Virtualized ScrollView - {items.length} items with variable heights
        </Text>
      </Box>

      <Text style={{ dim: true }}>
        Every 10th item is a complex multi-line component. Heights are auto-measured!
      </Text>

      {/* Virtualized content with complex children */}
      <ScrollView 
        virtualize 
        estimatedItemHeight={2}
        style={{ flexGrow: 1, border: "single", borderColor: "blackBright" }}
      >
        {items.map((item) => (
          item.isComplex 
            ? <ComplexItem key={item.id} item={item} />
            : <SimpleItem key={item.id} item={item} />
        ))}
      </ScrollView>

      {/* Footer */}
      <Box style={{ bg: "blackBright" }}>
        <Text style={{ dim: true }}>
          Ctrl+D/U half page • Ctrl+F/B full page • PgUp/PgDn •{" "}
          <Text style={{ color: "red" }}>q</Text> quit
        </Text>
      </Box>

      <Keybind keypress="q" onPress={() => exit()} />
    </Box>
  );
}

render(<App />);
