import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import type { Style, Key, Color } from "../types/index.js";
import type { KeybindRegistry, CommandDef } from "../utils/keybinds.js";
import { Input } from "./Input.js";
import { Keybind } from "./Keybind.js";
import { FocusScope } from "./FocusScope.js";

// ---- Message Types --------------------------------------------------------

/**
 * Visual type for a status bar message.
 * @category Types
 */
export type MessageType = "info" | "success" | "warning" | "error" | "progress";

/**
 * A message displayed in the status bar.
 *
 * @example
 * ```tsx
 * const bar = useStatusBar();
 * bar.showMessage({ text: "Saved!", type: "success" });
 * bar.showMessage({ text: "Syncing…", type: "progress", durationMs: 0 });
 * ```
 * @category Types
 */
export interface StatusBarMessage {
  /** Message text. */
  text: string;
  /** Visual variant. Default `"info"`. */
  type?: MessageType;
  /**
   * Auto-dismiss duration in ms.
   * Overrides the component-level `messageDuration` for this message.
   * Set `0` to persist until manually cleared.
   */
  durationMs?: number;
}

// ---- Context --------------------------------------------------------------

/**
 * Value exposed by the StatusBar context.
 * @category Types
 */
export interface StatusBarContextValue {
  /**
   * Display a message in the status bar.
   * Pass a string for a simple info message or a {@link StatusBarMessage} for full control.
   */
  showMessage(message: StatusBarMessage | string): void;
  /** Immediately clear the current message. */
  clearMessage(): void;
}

const StatusBarContext = createContext<StatusBarContextValue | null>(null);

// ---- Hook -----------------------------------------------------------------

/**
 * Access the status bar message API from anywhere inside a {@link StatusBar}.
 *
 * @returns An object with `showMessage` and `clearMessage` methods.
 *
 * @example
 * ```tsx
 * const bar = useStatusBar();
 *
 * bar.showMessage("Quick info");
 * bar.showMessage({ text: "Saved!", type: "success" });
 * bar.showMessage({ text: "Loading…", type: "progress", durationMs: 0 });
 * bar.clearMessage();
 * ```
 * @category Hooks
 */
export function useStatusBar(): StatusBarContextValue {
  const ctx = useContext(StatusBarContext);
  if (!ctx) throw new Error("useStatusBar must be used within a <StatusBar>");
  return ctx;
}

// ---- Props ----------------------------------------------------------------

/**
 * Props for the {@link StatusBar} component.
 */
export interface StatusBarProps {
  // ── Command mode ──────────────────────────────────────────────

  /**
   * Keybind registry — enables command mode.
   * When provided, pressing `commandKey` opens a command palette with
   * filterable commands extracted from the registry.
   */
  commands?: KeybindRegistry<any>;
  /**
   * Called when a command is executed from the palette.
   *
   * @param action - The `action` identifier of the selected command.
   * @param args - Optional argument string for parameterised commands.
   */
  onCommand?: (action: string, args?: string) => void;
  /** Key that activates command mode. Default `":"`. */
  commandKey?: string;
  /** Placeholder text for the command input. Default `"Type a command…"`. */
  commandPlaceholder?: string;

  // ── Search mode ───────────────────────────────────────────────

  /**
   * Called as the user types in search mode.
   * Providing this callback enables search mode (activated by `searchKey`).
   */
  onSearch?: (query: string) => void;
  /** Called when Enter is pressed in search mode. */
  onSearchSubmit?: (query: string) => void;
  /** Called when search mode is dismissed (Escape). */
  onSearchDismiss?: () => void;
  /** Called when Up/Down is pressed in search mode. */
  onSearchNavigate?: (direction: "up" | "down") => void;
  /** Key that activates search mode. Default `"/"`. */
  searchKey?: string;
  /** Placeholder text for the search input. Default `"Search…"`. */
  searchPlaceholder?: string;

  // ── Content ───────────────────────────────────────────────────

  /**
   * Default content shown on the left side when idle and no message is active.
   * Typically contextual info like "next event" or "selected file".
   */
  status?: ReactNode;
  /**
   * Content rendered on the right side of the bar.
   * Supports any single-line content (clock, auth indicator, key hints, etc.).
   */
  right?: ReactNode;

  // ── Configuration ─────────────────────────────────────────────

  /** Style applied to the status bar row. */
  style?: Style;
  /** Default auto-dismiss duration for messages in ms. Default `3000`. */
  messageDuration?: number;
  /**
   * Application content.
   * Rendered above the status bar in a column layout.
   * Descendants can call {@link useStatusBar} to post messages.
   */
  children?: ReactNode;
}

// ---- Internal: message colors & prefixes ----------------------------------

const MESSAGE_COLORS: Record<MessageType, Color> = {
  info: "white",
  success: "green",
  warning: "yellow",
  error: "red",
  progress: "cyan",
};

const MESSAGE_PREFIXES: Record<MessageType, string> = {
  info: "",
  success: "✓ ",
  warning: "⚠ ",
  error: "✗ ",
  progress: "⋯ ",
};

// ---- Internal: CommandPalette ---------------------------------------------

interface CommandPaletteProps {
  commands: CommandDef[];
  selectedIndex: number;
  input: string;
}

const PALETTE_WIDTH = 50;
const PALETTE_MAX_HEIGHT = 12;

function CommandPalette({ commands, selectedIndex, input }: CommandPaletteProps): React.JSX.Element | null {
  const filteredCommands = useMemo(() => {
    if (!input.trim()) return commands;
    const query = input.toLowerCase().trim().split(/\s+/)[0] ?? "";
    return commands.filter((cmd) => {
      const cmdName = cmd.name.split(" ")[0] ?? "";
      return cmdName.toLowerCase().includes(query) || cmd.description.toLowerCase().includes(query);
    });
  }, [commands, input]);

  if (filteredCommands.length === 0) {
    return React.createElement(
      "box" as any,
      {
        style: {
          position: "absolute" as const,
          bottom: 1,
          left: 0,
          width: PALETTE_WIDTH,
          paddingX: 1,
          bg: "blackBright" as Color,
          zIndex: 99990,
        } satisfies Style,
      },
      React.createElement(
        "text" as any,
        { style: { dim: true } },
        "No matching commands",
      ),
    );
  }

  const visibleHeight = Math.min(PALETTE_MAX_HEIGHT, filteredCommands.length + 1);

  return React.createElement(
    "box" as any,
    {
      style: {
        position: "absolute" as const,
        bottom: 1,
        left: 0,
        width: PALETTE_WIDTH,
        height: visibleHeight,
        flexDirection: "column" as const,
        bg: "blackBright" as Color,
        zIndex: 99990,
      } satisfies Style,
    },
    // Header
    React.createElement(
      "box" as any,
      { style: { paddingX: 1, flexDirection: "row" as const, justifyContent: "space-between" as const } satisfies Style },
      React.createElement("text" as any, { style: { dim: true } }, `Commands (${filteredCommands.length})`),
      React.createElement("text" as any, { style: { dim: true } }, "↑↓ Tab:fill"),
    ),
    // Command list
    React.createElement(
      "box" as any,
      { style: { height: Math.min(PALETTE_MAX_HEIGHT - 1, filteredCommands.length) } satisfies Style },
      ...filteredCommands.map((cmd, index) => {
        const isSelected = index === selectedIndex;
        return React.createElement(
          "box" as any,
          {
            key: cmd.name,
            style: {
              flexDirection: "row" as const,
              paddingX: 1,
              bg: isSelected ? ("white" as Color) : undefined,
            } satisfies Style,
          },
          React.createElement(
            "text" as any,
            {
              style: {
                color: isSelected ? ("black" as Color) : ("cyan" as Color),
                bold: isSelected,
                width: 14,
              },
            },
            cmd.name,
          ),
          React.createElement(
            "text" as any,
            {
              style: {
                color: isSelected ? ("black" as Color) : undefined,
                dim: !isSelected,
              },
              wrap: "truncate",
            },
            cmd.description,
          ),
        );
      }),
    ),
  );
}

// ---- Internal: filter commands helper -------------------------------------

function getFilteredCommands(commands: CommandDef[], input: string): CommandDef[] {
  if (!input.trim()) return commands;
  const query = input.toLowerCase().trim().split(/\s+/)[0] ?? "";
  return commands.filter((cmd) => {
    const cmdName = cmd.name.split(" ")[0] ?? "";
    return cmdName.toLowerCase().includes(query) || cmd.description.toLowerCase().includes(query);
  });
}

function getSelectedCommand(
  commands: CommandDef[],
  input: string,
  selectedIndex: number,
): CommandDef | null {
  const filtered = getFilteredCommands(commands, input);
  return filtered[selectedIndex] ?? null;
}

// ---- StatusBar component --------------------------------------------------

type StatusBarMode = "idle" | "command" | "search";

/**
 * Unified status bar with optional command palette, search, and message system.
 *
 * Wraps application content in a column layout with the bar pinned at the
 * bottom. Descendants can call {@link useStatusBar} to post messages that
 * appear in the bar.
 *
 * **Command mode** (optional) — activated by pressing `commandKey` (default
 * `":"`). Shows a filterable command palette built from the provided
 * {@link KeybindRegistry}. Requires `commands` and `onCommand` props.
 *
 * **Search mode** (optional) — activated by pressing `searchKey` (default
 * `"/"`). Calls `onSearch` as the user types. Requires `onSearch` prop.
 *
 * **Messages** — call `useStatusBar().showMessage()` from anywhere in the
 * tree to display temporary status messages (success, error, progress, etc.).
 *
 * @example
 * ```tsx
 * import { StatusBar, useStatusBar, createKeybindRegistry } from "@semos-labs/glyph";
 *
 * const registry = createKeybindRegistry({
 *   global: [
 *     { key: "q", display: "q", description: "Quit", action: "quit", command: "quit" },
 *     { key: "?", display: "?", description: "Help", action: "help", command: "help" },
 *   ],
 * });
 *
 * function App() {
 *   return (
 *     <StatusBar
 *       commands={registry}
 *       onCommand={(action) => dispatch(action)}
 *       onSearch={(q) => search(q)}
 *       right={<Text bold>12:30</Text>}
 *       status={<Text dim>Ready</Text>}
 *     >
 *       <Box style={{ flexGrow: 1 }}>
 *         <MainContent />
 *       </Box>
 *     </StatusBar>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Post messages from anywhere in the tree
 * function SaveButton() {
 *   const bar = useStatusBar();
 *
 *   const save = async () => {
 *     bar.showMessage({ text: "Saving…", type: "progress", durationMs: 0 });
 *     await doSave();
 *     bar.showMessage({ text: "Saved!", type: "success" });
 *   };
 *
 *   return <Button label="Save" onPress={save} />;
 * }
 * ```
 * @category Components
 */
export function StatusBar({
  // Command mode
  commands,
  onCommand,
  commandKey = ":",
  commandPlaceholder = "Type a command…",
  // Search mode
  onSearch,
  onSearchSubmit,
  onSearchDismiss,
  onSearchNavigate,
  searchKey = "/",
  searchPlaceholder = "Search…",
  // Content
  status,
  right,
  // Config
  style,
  messageDuration = 3000,
  children,
}: StatusBarProps): React.JSX.Element {
  // ── State ───────────────────────────────────────────────────

  const [mode, setMode] = useState<StatusBarMode>("idle");
  const [commandInput, setCommandInput] = useState("");
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [message, setMessage] = useState<{ text: string; type: MessageType } | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // All commands from registry
  const allCommands = useMemo(() => commands?.getAllCommands() ?? [], [commands]);

  // Filtered commands for palette
  const filteredCommands = useMemo(
    () => getFilteredCommands(allCommands, commandInput),
    [allCommands, commandInput],
  );

  // Reset selected index when filter changes
  useEffect(() => {
    if (commandSelectedIndex >= filteredCommands.length) {
      setCommandSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, commandSelectedIndex]);

  // Reset selection when command input changes
  const prevInputRef = useRef(commandInput);
  useEffect(() => {
    if (prevInputRef.current !== commandInput) {
      setCommandSelectedIndex(0);
      prevInputRef.current = commandInput;
    }
  }, [commandInput]);

  // ── Context value ───────────────────────────────────────────

  const showMessage = useCallback(
    (msg: StatusBarMessage | string) => {
      const normalized: StatusBarMessage = typeof msg === "string" ? { text: msg } : msg;
      const type = normalized.type ?? "info";

      // Clear existing timer
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
        messageTimerRef.current = null;
      }

      setMessage({ text: normalized.text, type });

      // Auto-dismiss
      const duration = normalized.durationMs ?? messageDuration;
      if (duration > 0) {
        messageTimerRef.current = setTimeout(() => {
          setMessage(null);
          messageTimerRef.current = null;
        }, duration);
      }
    },
    [messageDuration],
  );

  const clearMessage = useCallback(() => {
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
      messageTimerRef.current = null;
    }
    setMessage(null);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  const ctxRef = useRef<StatusBarContextValue>({ showMessage, clearMessage });
  ctxRef.current.showMessage = showMessage;
  ctxRef.current.clearMessage = clearMessage;

  // ── Mode transitions ────────────────────────────────────────

  const openCommand = useCallback(() => {
    setMode("command");
    setCommandInput("");
    setCommandSelectedIndex(0);
  }, []);

  const openSearch = useCallback(() => {
    setMode("search");
    setSearchInput("");
  }, []);

  const closeMode = useCallback(() => {
    setMode("idle");
  }, []);

  // ── Command input key handling ──────────────────────────────

  const handleCommandKeyPress = useCallback(
    (key: Key): boolean | void => {
      if (key.name === "return") {
        const cmd = getSelectedCommand(allCommands, commandInput, commandSelectedIndex);
        if (cmd) {
          // Parse args from input
          const parts = commandInput.trim().split(/\s+/);
          const args = parts.slice(1).join(" ") || undefined;
          onCommand?.(cmd.action, args);
        }
        closeMode();
        return true;
      }
      if (key.name === "escape") {
        closeMode();
        return true;
      }
      if (key.name === "tab") {
        const cmd = getSelectedCommand(allCommands, commandInput, commandSelectedIndex);
        if (cmd) {
          const name = cmd.name.replace(/ <.*>$/, "");
          setCommandInput(name + " ");
        }
        return true;
      }
      if (key.name === "up" || (key.ctrl && key.name === "p")) {
        setCommandSelectedIndex((i) => Math.max(0, i - 1));
        return true;
      }
      if (key.name === "down" || (key.ctrl && key.name === "n")) {
        setCommandSelectedIndex((i) => Math.min(filteredCommands.length - 1, i + 1));
        return true;
      }
      return false;
    },
    [allCommands, commandInput, commandSelectedIndex, onCommand, closeMode, filteredCommands.length],
  );

  // ── Search input key handling ───────────────────────────────

  const handleSearchKeyPress = useCallback(
    (key: Key): boolean | void => {
      if (key.name === "return") {
        onSearchSubmit?.(searchInput);
        closeMode();
        return true;
      }
      if (key.name === "escape") {
        onSearchDismiss?.();
        closeMode();
        return true;
      }
      if (key.name === "up" || (key.ctrl && key.name === "p")) {
        onSearchNavigate?.("up");
        return true;
      }
      if (key.name === "down" || (key.ctrl && key.name === "n")) {
        onSearchNavigate?.("down");
        return true;
      }
      return false;
    },
    [searchInput, onSearchSubmit, onSearchDismiss, onSearchNavigate, closeMode],
  );

  // ── Search onChange ─────────────────────────────────────────

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      onSearch?.(value);
    },
    [onSearch],
  );

  // ── Render helpers ──────────────────────────────────────────

  const isCommandMode = mode === "command";
  const isSearchMode = mode === "search";

  // Left side content
  let leftContent: React.ReactElement;

  if (isCommandMode) {
    leftContent = React.createElement(
      FocusScope,
      { trap: true },
      React.createElement(
        "box" as any,
        { style: { flexDirection: "row", flexGrow: 1, alignItems: "center" } satisfies Style },
        React.createElement("text" as any, { style: { color: "cyan" as Color, bold: true } }, ":"),
        React.createElement(Input, {
          key: "statusbar-command-input",
          value: commandInput,
          placeholder: commandPlaceholder,
          onChange: setCommandInput,
          onKeyPress: handleCommandKeyPress,
          autoFocus: true,
          style: { flexGrow: 1 } satisfies Style,
        }),
      ),
    );
  } else if (isSearchMode) {
    leftContent = React.createElement(
      FocusScope,
      { trap: true },
      React.createElement(
        "box" as any,
        { style: { flexDirection: "row", flexGrow: 1, alignItems: "center" } satisfies Style },
        React.createElement("text" as any, { style: { color: "cyan" as Color, bold: true } }, "/"),
        React.createElement(Input, {
          key: "statusbar-search-input",
          value: searchInput,
          placeholder: searchPlaceholder,
          onChange: handleSearchChange,
          onKeyPress: handleSearchKeyPress,
          autoFocus: true,
          style: { flexGrow: 1 } satisfies Style,
        }),
      ),
    );
  } else if (message) {
    // Show message
    const color = MESSAGE_COLORS[message.type];
    const prefix = MESSAGE_PREFIXES[message.type];
    leftContent = React.createElement(
      "box" as any,
      { style: { flexDirection: "row", flexGrow: 1 } satisfies Style },
      React.createElement(
        "text" as any,
        { style: { color, bold: message.type === "error" } },
        `${prefix}${message.text}`,
      ),
    );
  } else {
    // Default status
    leftContent = React.createElement(
      "box" as any,
      { style: { flexGrow: 1, flexShrink: 1 } satisfies Style },
      status ?? null,
    );
  }

  // Bar style
  const barStyle: Style = {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingX: 1,
    ...style,
  };

  // ── Compose ─────────────────────────────────────────────────

  // Command palette portal
  const commandPalettePortal = isCommandMode
    ? React.createElement(
        "box" as any,
        {
          style: {
            position: "absolute" as const,
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 99989,
          } satisfies Style,
        },
        React.createElement(CommandPalette, {
          commands: allCommands,
          selectedIndex: commandSelectedIndex,
          input: commandInput,
        }),
      )
    : null;

  // Activation keybinds (only in idle mode)
  const activationKeybinds: React.ReactElement[] = [];

  if (commands && mode === "idle") {
    activationKeybinds.push(
      React.createElement(Keybind, {
        key: "statusbar-cmd-activate",
        keypress: commandKey,
        onPress: openCommand,
      }),
    );
  }
  if (onSearch && mode === "idle") {
    activationKeybinds.push(
      React.createElement(Keybind, {
        key: "statusbar-search-activate",
        keypress: searchKey,
        onPress: openSearch,
      }),
    );
  }

  // Status bar row
  const barRow = React.createElement(
    "box" as any,
    { style: barStyle },
    // Left side
    React.createElement(
      "box" as any,
      { style: { flexGrow: 1, flexShrink: 1 } satisfies Style },
      leftContent,
    ),
    // Right side
    right
      ? React.createElement(
          "box" as any,
          { style: { flexDirection: "row", gap: 1 } satisfies Style },
          right,
        )
      : null,
  );

  return React.createElement(
    StatusBarContext.Provider,
    { value: ctxRef.current },
    // Column wrapper
    React.createElement(
      "box" as any,
      { style: { flexDirection: "column", width: "100%", height: "100%", flexGrow: 1 } satisfies Style },
      // Children (app content)
      children
        ? React.createElement(
            "box" as any,
            { style: { flexGrow: 1, flexShrink: 1, clip: true } satisfies Style },
            children,
          )
        : null,
      // Command palette overlay
      commandPalettePortal,
      // The bar itself
      barRow,
    ),
    // Activation keybinds (outside the layout box, they render nothing)
    ...activationKeybinds,
  );
}
