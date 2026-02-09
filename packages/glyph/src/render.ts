import React from "react";
import type { ReactElement } from "react";
import { reconciler } from "./reconciler/reconciler.js";
import type { GlyphContainer } from "./reconciler/nodes.js";
import type { GlyphNode } from "./reconciler/nodes.js";
import { Terminal } from "./runtime/terminal.js";
import { parseKeySequence } from "./runtime/input.js";
import { Framebuffer } from "./paint/framebuffer.js";
import { paintTree } from "./paint/painter.js";
import { diffFramebuffers } from "./paint/diff.js";
import { computeLayout } from "./layout/yogaLayout.js";
import { setTerminalPalette, getContrastCursorColor } from "./paint/color.js";
import {
  InputContext,
  FocusContext,
  LayoutContext,
  AppContext,
} from "./hooks/context.js";
import type {
  InputHandler,
  FocusedInputHandler,
  PriorityInputHandler,
  InputContextValue,
  FocusContextValue,
  LayoutContextValue,
  AppContextValue,
} from "./hooks/context.js";
import type { RenderOptions, AppHandle, LayoutRect } from "./types/index.js";

export function render(
  element: ReactElement,
  opts: RenderOptions = {},
): AppHandle {
  const stdout = opts.stdout ?? process.stdout;
  const stdin = opts.stdin ?? process.stdin;
  const debug = opts.debug ?? false;
  const useNativeCursor = opts.useNativeCursor ?? true;

  const terminal = new Terminal(stdout, stdin);
  terminal.setup();

  // Track whether native cursor is currently visible
  let nativeCursorVisible = false;

  // Query terminal for actual ANSI palette colors (async, repaint when done)
  terminal.queryPalette().then((palette) => {
    setTerminalPalette(palette);
    fullRedraw = true;
    scheduleRender();
  });

  const prevFb = new Framebuffer(terminal.columns, terminal.rows);
  const currentFb = new Framebuffer(terminal.columns, terminal.rows);
  let fullRedraw = true;

  // ---- Input system ----
  const inputHandlers = new Set<InputHandler>();
  const priorityHandlers = new Set<PriorityInputHandler>(); // Run before focused handlers
  const focusedInputHandlers = new Map<string, FocusedInputHandler>();

  const inputContextValue: InputContextValue = {
    subscribe(handler: InputHandler) {
      inputHandlers.add(handler);
      return () => inputHandlers.delete(handler);
    },
    subscribePriority(handler: PriorityInputHandler) {
      priorityHandlers.add(handler);
      return () => priorityHandlers.delete(handler);
    },
    registerInputHandler(focusId: string, handler: FocusedInputHandler) {
      focusedInputHandlers.set(focusId, handler);
      return () => focusedInputHandlers.delete(focusId);
    },
  };

  // ---- Focus system ----
  let focusedId: string | null = null;
  const focusRegistry = new Map<string, GlyphNode>();
  const focusOrder: string[] = [];
  const skippableIds = new Set<string>(); // Disabled/skippable elements during Tab
  let trapStack: Array<Set<string>> = [];
  const focusChangeHandlers = new Set<(id: string | null) => void>();

  function setFocusedId(id: string | null): void {
    if (focusedId !== id) {
      focusedId = id;
      scheduleRender();
      for (const handler of focusChangeHandlers) {
        handler(focusedId);
      }
    }
  }

  function getActiveFocusableIds(): string[] {
    let ids = [...focusOrder]; // Copy to avoid mutating original
    
    // Filter by trap if active
    if (trapStack.length > 0) {
      const trap = trapStack[trapStack.length - 1]!;
      ids = ids.filter((id) => trap.has(id));
    }
    
    // Filter out skippable (disabled) elements
    ids = ids.filter((id) => !skippableIds.has(id));
    
    // Sort by visual position (top-to-bottom, left-to-right) - like web DOM order
    ids.sort((a, b) => {
      const nodeA = focusRegistry.get(a);
      const nodeB = focusRegistry.get(b);
      if (!nodeA || !nodeB) return 0;
      
      const layoutA = nodeA.layout;
      const layoutB = nodeB.layout;
      
      // Compare Y first (row), then X (column)
      if (layoutA.y !== layoutB.y) {
        return layoutA.y - layoutB.y;
      }
      return layoutA.x - layoutB.x;
    });
    
    return ids;
  }

  const focusContextValue: FocusContextValue = {
    get focusedId() {
      return focusedId;
    },
    register(id: string, node: GlyphNode) {
      focusRegistry.set(id, node);
      if (!focusOrder.includes(id)) {
        focusOrder.push(id);
      }
      // Auto-register in active trap
      if (trapStack.length > 0) {
        trapStack[trapStack.length - 1]!.add(id);
      }
      // Auto-focus first item if nothing focused (by visual order)
      if (focusedId === null) {
        const activeIds = getActiveFocusableIds();
        if (activeIds.length > 0) {
          setFocusedId(activeIds[0]!);
        }
      }
      return () => {
        focusRegistry.delete(id);
        const idx = focusOrder.indexOf(id);
        if (idx !== -1) focusOrder.splice(idx, 1);
        if (focusedId === id) {
          // Focus first by visual order
          const activeIds = getActiveFocusableIds();
          setFocusedId(activeIds[0] ?? null);
        }
      };
    },
    requestFocus(id: string) {
      setFocusedId(id);
    },
    focusNext() {
      const ids = getActiveFocusableIds();
      if (ids.length === 0) return;
      const currentIdx = focusedId ? ids.indexOf(focusedId) : -1;
      const nextIdx = (currentIdx + 1) % ids.length;
      setFocusedId(ids[nextIdx]!);
    },
    focusPrev() {
      const ids = getActiveFocusableIds();
      if (ids.length === 0) return;
      const currentIdx = focusedId ? ids.indexOf(focusedId) : 0;
      const prevIdx = (currentIdx - 1 + ids.length) % ids.length;
      setFocusedId(ids[prevIdx]!);
    },
    setSkippable(id: string, skippable: boolean) {
      if (skippable) {
        skippableIds.add(id);
        // If this element is currently focused and now skippable, move focus
        if (focusedId === id) {
          const ids = getActiveFocusableIds();
          if (ids.length > 0) {
            setFocusedId(ids[0]!);
          }
        }
      } else {
        skippableIds.delete(id);
      }
    },
    trapIds: null,
    pushTrap(ids: Set<string>) {
      trapStack.push(ids);
      return () => {
        const idx = trapStack.indexOf(ids);
        if (idx !== -1) trapStack.splice(idx, 1);
      };
    },
    onFocusChange(handler: (id: string | null) => void) {
      focusChangeHandlers.add(handler);
      return () => {
        focusChangeHandlers.delete(handler);
      };
    },
    getRegisteredElements() {
      // Return all non-skippable registered elements
      const result: { id: string; node: GlyphNode }[] = [];
      for (const id of focusOrder) {
        if (skippableIds.has(id)) continue;
        const node = focusRegistry.get(id);
        if (node) {
          result.push({ id, node });
        }
      }
      return result;
    },
    getActiveElements() {
      // Return elements in the current trap scope (or all if no trap)
      const activeIds = getActiveFocusableIds();
      const result: { id: string; node: GlyphNode }[] = [];
      for (const id of activeIds) {
        if (skippableIds.has(id)) continue;
        const node = focusRegistry.get(id);
        if (node) {
          result.push({ id, node });
        }
      }
      return result;
    },
  };

  // ---- Layout system ----
  const layoutSubscriptions = new Map<GlyphNode, Set<(rect: LayoutRect) => void>>();

  const layoutContextValue: LayoutContextValue = {
    getLayout(node: GlyphNode) {
      return node.layout;
    },
    subscribe(node: GlyphNode, handler: (rect: LayoutRect) => void) {
      if (!layoutSubscriptions.has(node)) {
        layoutSubscriptions.set(node, new Set());
      }
      layoutSubscriptions.get(node)!.add(handler);
      return () => {
        const subs = layoutSubscriptions.get(node);
        if (subs) {
          subs.delete(handler);
          if (subs.size === 0) layoutSubscriptions.delete(node);
        }
      };
    },
  };

  // ---- App context ----
  const appContextValue: AppContextValue = {
    registerNode() {},
    unregisterNode() {},
    scheduleRender,
    exit(code?: number) {
      handle.exit(code);
    },
    get columns() {
      return terminal.columns;
    },
    get rows() {
      return terminal.rows;
    },
  };

  // ---- Container ----
  const container: GlyphContainer = {
    type: "root",
    children: [],
    onCommit() {
      scheduleRender();
    },
  };

  // ---- Render scheduling ----
  let renderScheduled = false;

  function scheduleRender(): void {
    if (renderScheduled) return;
    renderScheduled = true;
    queueMicrotask(() => {
      renderScheduled = false;
      performRender();
    });
  }

  function performRender(): void {
    const cols = terminal.columns;
    const rows = terminal.rows;

    if (currentFb.width !== cols || currentFb.height !== rows) {
      currentFb.resize(cols, rows);
      prevFb.resize(cols, rows);
      fullRedraw = true;
    }

    // Compute layout
    computeLayout(container.children, cols, rows);

    // Notify layout subscribers
    notifyLayoutSubscribers(container.children);

    // Find cursor info for focused input
    let cursorInfo: { nodeId: string; position: number } | undefined;
    if (focusedId) {
      const focusedNode = focusRegistry.get(focusedId);
      if (focusedNode?.type === "input") {
        cursorInfo = {
          nodeId: focusedId,
          position: focusedNode.props.cursorPosition ?? (focusedNode.props.value?.length ?? 0),
        };
      }
    }

    // Paint
    const paintResult = paintTree(container.children, currentFb, {
      cursorInfo,
      useNativeCursor,
    });

    // Diff & flush
    const output = diffFramebuffers(prevFb, currentFb, fullRedraw);
    if (output.length > 0) {
      terminal.write(output);
    }

    // Handle native cursor positioning
    if (useNativeCursor) {
      if (paintResult.cursorPosition) {
        // Set cursor color to contrast with input background
        const cursorColor = getContrastCursorColor(paintResult.cursorPosition.bg);
        terminal.setCursorColor(cursorColor);
        // Position and show native cursor
        terminal.moveCursor(paintResult.cursorPosition.x, paintResult.cursorPosition.y);
        if (!nativeCursorVisible) {
          terminal.showCursor();
          nativeCursorVisible = true;
        }
      } else {
        // No focused input - hide native cursor
        if (nativeCursorVisible) {
          terminal.hideCursor();
          nativeCursorVisible = false;
        }
      }
    }

    // Swap buffers
    for (let i = 0; i < currentFb.cells.length; i++) {
      prevFb.cells[i] = { ...currentFb.cells[i]! };
    }
    fullRedraw = false;
  }

  function notifyLayoutSubscribers(nodes: GlyphNode[]): void {
    for (const node of nodes) {
      const subs = layoutSubscriptions.get(node);
      if (subs) {
        for (const handler of subs) {
          handler(node.layout);
        }
      }
      notifyLayoutSubscribers(node.children);
    }
  }

  // ---- Input handling ----
  const removeDataListener = terminal.onData((data: string) => {
    const keys = parseKeySequence(data);
    for (const key of keys) {
      // Global: ctrl+c exits
      if (key.ctrl && key.name === "c") {
        handle.exit();
        return;
      }

      // Global: ctrl+z suspends (background the process)
      // 1. SIGSTOP not SIGTSTP — Node.js ignores SIGTSTP by default.
      // 2. pid 0 = entire process group, so the shell sees the foreground
      //    job as stopped (handles bun→tsx→node chains correctly).
      if (key.ctrl && key.name === "z") {
        terminal.suspend();
        process.kill(0, "SIGSTOP");
        return;
      }

      // Tab navigation
      if (key.name === "tab" && !key.ctrl && !key.alt) {
        if (key.shift) {
          focusContextValue.focusPrev();
        } else {
          focusContextValue.focusNext();
        }
        continue;
      }

      // 1. Priority handlers run first (e.g., global keybinds like Ctrl+Enter)
      let consumed = false;
      for (const handler of priorityHandlers) {
        if (handler(key)) {
          consumed = true;
          break;
        }
      }

      // 2. If not consumed, let focused input handler try
      if (!consumed && focusedId) {
        const inputHandler = focusedInputHandlers.get(focusedId);
        if (inputHandler) {
          consumed = inputHandler(key);
        }
      }

      // 3. If still not consumed, run global handlers
      if (!consumed) {
        for (const handler of inputHandlers) {
          handler(key);
        }
      }
    }
  });

  // ---- Resize handling ----
  const removeResizeListener = terminal.onResize(() => {
    fullRedraw = true;
    scheduleRender();
  });

  // ---- SIGCONT: resume after Ctrl+Z suspend ----
  const handleSigcont = () => {
    terminal.resume();
    fullRedraw = true;
    scheduleRender();
  };
  process.on("SIGCONT", handleSigcont);

  // ---- Create React tree ----
  const wrappedElement = React.createElement(
    AppContext.Provider,
    { value: appContextValue },
    React.createElement(
      InputContext.Provider,
      { value: inputContextValue },
      React.createElement(
        FocusContext.Provider,
        { value: focusContextValue },
        React.createElement(
          LayoutContext.Provider,
          { value: layoutContextValue },
          element,
        ),
      ),
    ),
  );

  // Error handlers for React 19 reconciler
  const onUncaughtError = (error: Error) => {
    if (debug) console.error("Uncaught error:", error);
  };
  const onCaughtError = (error: Error) => {
    // Error caught by ErrorBoundary - this is expected
    if (debug) console.error("Error caught by boundary:", error);
  };
  const onRecoverableError = (error: Error) => {
    if (debug) console.error("Recoverable error:", error);
  };

  // Create fiber root
  // Cast to any - react-reconciler types don't match React 19 runtime API
  const root = (reconciler.createContainer as any)(
    container,
    0, // LegacyRoot tag
    null, // hydrationCallbacks
    false, // isStrictMode
    null, // concurrentUpdatesByDefaultOverride
    "", // identifierPrefix
    onUncaughtError,
    onCaughtError,
    onRecoverableError,
    null, // transitionCallbacks
  );

  reconciler.updateContainer(wrappedElement, root, null, null);

  // ---- Handle ----
  const handle: AppHandle = {
    unmount() {
      reconciler.updateContainer(null, root, null, null);
      removeDataListener();
      removeResizeListener();
      process.off("SIGCONT", handleSigcont);
      terminal.cleanup();
    },
    exit(code?: number) {
      handle.unmount();
      process.exit(code ?? 0);
    },
  };

  return handle;
}
