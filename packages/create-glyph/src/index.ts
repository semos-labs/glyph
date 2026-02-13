import fs from "node:fs";
import path from "node:path";

// ── Colors (no deps, just ANSI) ──────────────────────────────────────────────

const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`;
const green = (s: string) => `\x1b[32m${s}\x1b[39m`;
const red = (s: string) => `\x1b[31m${s}\x1b[39m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[39m`;

// ── Package manager detection ────────────────────────────────────────────────

type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

function detectPackageManager(): PackageManager {
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("bun")) return "bun";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";

  // Fallback: check argv0 / execPath
  const execPath = process.argv0 || process.execPath || "";
  if (execPath.includes("bun")) return "bun";
  if (execPath.includes("pnpm")) return "pnpm";
  if (execPath.includes("yarn")) return "yarn";

  return "npm";
}

function getInstallCommand(pm: PackageManager): string {
  switch (pm) {
    case "bun":
      return "bun install";
    case "pnpm":
      return "pnpm install";
    case "yarn":
      return "yarn";
    case "npm":
      return "npm install";
  }
}

function getRunCommand(pm: PackageManager): string {
  switch (pm) {
    case "bun":
      return "bun dev";
    case "pnpm":
      return "pnpm dev";
    case "yarn":
      return "yarn dev";
    case "npm":
      return "npm run dev";
  }
}

// ── Template files ───────────────────────────────────────────────────────────

function templatePackageJson(name: string): string {
  return JSON.stringify(
    {
      name,
      version: "0.0.1",
      private: true,
      type: "module",
      scripts: {
        dev: "tsx src/main.tsx",
        build: "tsup src/main.tsx --format esm --target node18",
      },
      dependencies: {
        "@semos/glyph": "latest",
        react: "^19.0.0",
      },
      devDependencies: {
        "@types/node": "^20",
        "@types/react": "^19",
        tsx: "^4",
        tsup: "^8",
        typescript: "^5.5",
      },
    },
    null,
    2,
  );
}

function templateTsconfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        lib: ["ESNext"],
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        sourceMap: true,
        noEmit: true,
      },
      include: ["src"],
    },
    null,
    2,
  );
}

function templateMainTsx(name: string): string {
  const displayName = name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return `import React, { useState, useCallback } from "react";
import {
  render,
  Box,
  Text,
  Input,
  Button,
  Checkbox,
  Keybind,
  Progress,
  Spacer,
  useApp,
} from "@semos/glyph";

// ── Types ───────────────────────────────────────────────────────

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

let nextId = 1;

// ── App ─────────────────────────────────────────────────────────

function App() {
  const { exit } = useApp();

  const [todos, setTodos] = useState<Todo[]>([
    { id: nextId++, text: "Learn Glyph basics", done: true },
    { id: nextId++, text: "Build something cool", done: false },
    { id: nextId++, text: "Ship it", done: false },
  ]);
  const [newTodo, setNewTodo] = useState("");

  const doneCount = todos.filter((t) => t.done).length;
  const progress = todos.length > 0 ? doneCount / todos.length : 0;

  const handleAdd = useCallback(() => {
    const text = newTodo.trim();
    if (!text) return;
    setTodos((prev) => [...prev, { id: nextId++, text, done: false }]);
    setNewTodo("");
  }, [newTodo]);

  const handleToggle = useCallback((id: number) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }, []);

  const handleDelete = useCallback((id: number) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: 1,
        gap: 1,
      }}
    >
      {/* Quit shortcut */}
      <Keybind keypress="q" onPress={() => exit()} />

      {/* Header */}
      <Box style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ bold: true, color: "cyanBright" }}>✦ ${displayName}</Text>
        <Spacer />
        <Text style={{ dim: true }}>
          {doneCount}/{todos.length} done
        </Text>
      </Box>

      {/* Progress bar */}
      <Progress value={progress} />

      {/* Add todo */}
      <Box style={{ flexDirection: "row", gap: 1 }}>
        <Box style={{ flexGrow: 1 }}>
          <Input
            value={newTodo}
            onChange={setNewTodo}
            placeholder="What needs to be done?"
            onSubmit={handleAdd}
            style={{ bg: "blackBright", paddingX: 1 }}
            focusedStyle={{ bg: "white", color: "black", paddingX: 1 }}
          />
        </Box>
        <Button
          label=" add "
          onPress={handleAdd}
          style={{ bg: "blackBright", paddingX: 1 }}
          focusedStyle={{ bg: "cyan", color: "black", paddingX: 1 }}
        />
      </Box>

      {/* Todo list */}
      <Box style={{ flexDirection: "column" }}>
        {todos.length === 0 && (
          <Text style={{ dim: true, italic: true }}>No todos yet. Add one above!</Text>
        )}
        {todos.map((todo) => (
          <Box key={todo.id} style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
            <Checkbox
              checked={todo.done}
              onChange={() => handleToggle(todo.id)}
              label={todo.text}
              style={todo.done ? { dim: true } : {}}
              focusedStyle={{ color: "cyanBright" }}
            />
            <Spacer />
            <Button
              label=" × "
              onPress={() => handleDelete(todo.id)}
              style={{ dim: true }}
              focusedStyle={{ color: "red" }}
            />
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Spacer />
      <Text style={{ dim: true }}>
        tab navigate · space toggle · enter submit · q quit
      </Text>
    </Box>
  );
}

render(<App />);
`;
}

function templateGitignore(): string {
  return `node_modules/
dist/
*.tsbuildinfo
.DS_Store
`;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function printUsage() {
  console.log();
  console.log(`  ${bold("create-glyph")} ${dim("— scaffold a new Glyph terminal UI app")}`);
  console.log();
  console.log(`  ${bold("Usage:")}`);
  console.log(`    ${cyan("bun create @semos/glyph")} ${dim("<project-name>")}`);
  console.log(`    ${cyan("npm create @semos/glyph")} ${dim("<project-name>")}`);
  console.log(`    ${cyan("pnpm create @semos/glyph")} ${dim("<project-name>")}`);
  console.log(`    ${cyan("yarn create @semos/glyph")} ${dim("<project-name>")}`);
  console.log();
  console.log(`  ${bold("Options:")}`);
  console.log(`    ${cyan("-h, --help")}     Show this help message`);
  console.log();
}

function main() {
  const args = process.argv.slice(2);

  // Handle help
  if (args.includes("-h") || args.includes("--help") || args.length === 0) {
    printUsage();
    if (args.length === 0) {
      console.log(
        `  ${red("✗")} Missing project name. Pass it as an argument.\n`,
      );
    }
    process.exit(args.includes("-h") || args.includes("--help") ? 0 : 1);
  }

  // Project name is the first non-flag argument
  const projectName = args.find((a) => !a.startsWith("-"));
  if (!projectName) {
    console.log(`\n  ${red("✗")} Missing project name.\n`);
    printUsage();
    process.exit(1);
  }

  // Validate name
  if (!/^[a-zA-Z0-9_@][a-zA-Z0-9._\-/]*$/.test(projectName)) {
    console.log(
      `\n  ${red("✗")} Invalid project name: ${bold(projectName)}\n`,
    );
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), projectName);
  const dirName = path.basename(targetDir);
  const pm = detectPackageManager();

  console.log();
  console.log(`  ${cyan("◆")} ${bold("Creating")} ${green(dirName)}${dim("...")}`);

  // Check if directory already exists and has stuff in it
  if (fs.existsSync(targetDir)) {
    const entries = fs.readdirSync(targetDir);
    if (entries.length > 0) {
      console.log(
        `\n  ${red("✗")} Directory ${bold(dirName)} already exists and is not empty.\n`,
      );
      process.exit(1);
    }
  }

  // Create directory structure
  fs.mkdirSync(path.join(targetDir, "src"), { recursive: true });

  // Write files
  const files: [string, string][] = [
    ["package.json", templatePackageJson(dirName)],
    ["tsconfig.json", templateTsconfig()],
    ["src/main.tsx", templateMainTsx(dirName)],
    [".gitignore", templateGitignore()],
  ];

  for (const [filePath, content] of files) {
    const fullPath = path.join(targetDir, filePath);
    fs.writeFileSync(fullPath, content, "utf-8");
    console.log(`  ${dim("├")} ${green("+")} ${filePath}`);
  }

  console.log();
  console.log(`  ${green("✓")} Project created!`);
  console.log();
  console.log(`  ${bold("Next steps:")}`);
  console.log();
  console.log(`    ${cyan("cd")} ${dirName}`);
  console.log(`    ${cyan(getInstallCommand(pm))}`);
  console.log(`    ${cyan(getRunCommand(pm))}`);
  console.log();
  console.log(`  ${dim("Happy hacking! ✦")}`);
  console.log();
}

main();
