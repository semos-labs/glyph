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
import { setTerminalPalette } from "./paint/color.js";
import {
  InputContext,
  FocusContext,
  LayoutContext,
  AppContext,
} from "./hooks/context.js";
import type {
  InputHandler,
  FocusedInputHandler,
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

  const terminal = new Terminal(stdout, stdin);
  terminal.setup();

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
  const focusedInputHandlers = new Map<string, FocusedInputHandler>();

  const inputContextValue: InputContextValue = {
    subscribe(handler: InputHandler) {
      inputHandlers.add(handler);
      return () => inputHandlers.delete(handler);
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
    if (trapStack.length > 0) {
      const trap = trapStack[trapStack.length - 1]!;
      return focusOrder.filter((id) => trap.has(id));
    }
    return focusOrder;
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
      // Auto-focus first item if nothing focused
      if (focusedId === null) {
        setFocusedId(id);
      }
      return () => {
        focusRegistry.delete(id);
        const idx = focusOrder.indexOf(id);
        if (idx !== -1) focusOrder.splice(idx, 1);
        if (focusedId === id) {
          setFocusedId(focusOrder[0] ?? null);
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
    paintTree(container.children, currentFb, cursorInfo);

    // Diff & flush
    const output = diffFramebuffers(prevFb, currentFb, fullRedraw);
    if (output.length > 0) {
      terminal.write(output);
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

      // Tab navigation
      if (key.name === "tab" && !key.ctrl && !key.alt) {
        if (key.shift) {
          focusContextValue.focusPrev();
        } else {
          focusContextValue.focusNext();
        }
        continue;
      }

      // If a text input is focused, let it consume the event first.
      // If it returns true, skip useInput handlers.
      let consumed = false;
      if (focusedId) {
        const inputHandler = focusedInputHandlers.get(focusedId);
        if (inputHandler) {
          consumed = inputHandler(key);
        }
      }

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

  // Create fiber root
  const root = reconciler.createContainer(
    container,
    0, // ConcurrentRoot tag = 0 (LegacyRoot)
    null,
    false,
    null,
    "",
    (err: Error) => {
      if (debug) console.error("Recoverable error:", err);
    },
    null,
  );

  reconciler.updateContainer(wrappedElement, root, null, null);

  // ---- Handle ----
  const handle: AppHandle = {
    unmount() {
      reconciler.updateContainer(null, root, null, null);
      removeDataListener();
      removeResizeListener();
      terminal.cleanup();
    },
    exit(code?: number) {
      handle.unmount();
      process.exit(code ?? 0);
    },
  };

  return handle;
}
