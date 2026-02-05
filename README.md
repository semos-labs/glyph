# Glyph

A React renderer for terminal UIs with flexbox layout, powered by Yoga.

## Installation

```bash
# npm
npm install glyph react

# yarn
yarn add glyph react

# pnpm
pnpm add glyph react

# bun
bun add glyph react
```

## Quick Start

```tsx
import React from "react";
import { render, Box, Text, useInput } from "glyph";

function App() {
  useInput((key) => {
    if (key.name === "q") process.exit(0);
  });

  return (
    <Box style={{ border: "round", borderColor: "cyan", padding: 1 }}>
      <Text style={{ bold: true, color: "green" }}>Hello, Glyph!</Text>
    </Box>
  );
}

render(<App />);
```

Run with `tsx`:

```bash
npx tsx app.tsx
```

## API

### Components

#### `<Box>`

Flexbox container with borders and backgrounds.

```tsx
<Box style={{ flexDirection: "row", gap: 1, border: "single", bg: "blue" }}>
  {children}
</Box>
```

#### `<Text>`

Text content with styling.

```tsx
<Text style={{ color: "green", bold: true }}>Hello</Text>
```

#### `<Input>`

Text input field with cursor support.

```tsx
<Input
  value={text}
  onChange={setText}
  placeholder="Type here..."
  style={{ border: "single", borderColor: "cyan" }}
/>
```

#### `<FocusScope>`

Focus trapping for modals/overlays.

```tsx
<FocusScope trap>
  <Input value={v} onChange={setV} />
</FocusScope>
```

### Hooks

- **`useInput(handler)`** - Listen for keyboard input
- **`useFocus(nodeRef)`** - Get focus state `{ focused, focus() }`
- **`useLayout(nodeRef)`** - Get layout rect `{ x, y, width, height, innerX, innerY, innerWidth, innerHeight }`

### `render(element, options?)`

Mount a React element to the terminal.

```ts
const app = render(<App />, {
  stdout: process.stdout,
  stdin: process.stdin,
  debug: false,
});

// Later:
app.unmount();
app.exit();
```

### Style Properties

| Category | Properties |
|----------|-----------|
| Layout | `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, `padding`, `paddingX/Y`, `paddingTop/Right/Bottom/Left`, `gap` |
| Flex | `flexDirection`, `flexWrap`, `justifyContent`, `alignItems`, `flexGrow`, `flexShrink` |
| Position | `position` (`relative`/`absolute`), `top`, `right`, `bottom`, `left`, `inset`, `zIndex` |
| Paint | `bg`, `border` (`none`/`single`/`double`/`round`/`ascii`), `borderColor`, `clip` |
| Text | `color`, `bold`, `dim`, `italic`, `underline`, `wrap` (`wrap`/`truncate`/`ellipsis`/`none`), `textAlign` |

Colors: Named (e.g. `"red"`, `"cyanBright"`), hex (`"#ff0000"`), RGB (`{ r: 255, g: 0, b: 0 }`), or 256-palette numbers.

## Running Examples

```bash
# Clone and install
git clone <repo-url>
cd glyph
pnpm install

# Build the library
pnpm build

# Run basic-layout example
pnpm --filter basic-layout dev

# Run modal-input example
pnpm --filter modal-input dev
```

## Limitations (v1)

- No mouse support
- No scrollviews or virtualization
- macOS/Linux terminals only (no Windows support)
- No custom widgets beyond Box, Text, Input
- Text measurement is character-based (no sub-character rendering)

## License

MIT
