import { createContext } from "react";
import type { Key, LayoutRect } from "../types/index.js";
import type { GlyphNode } from "../reconciler/nodes.js";

// ---- Input Context ----
export type InputHandler = (key: Key) => void;
/** Returns true if the key was consumed and should not propagate further */
export type FocusedInputHandler = (key: Key) => boolean;
/** Priority handler - returns true if consumed, preventing all other handlers */
export type PriorityInputHandler = (key: Key) => boolean;

export interface InputContextValue {
  subscribe(handler: InputHandler): () => void;
  /** Register a high-priority handler that runs BEFORE focused input handlers */
  subscribePriority(handler: PriorityInputHandler): () => void;
  registerInputHandler(focusId: string, handler: FocusedInputHandler): () => void;
}

export const InputContext = createContext<InputContextValue | null>(null);

// ---- Focus Context ----
export interface RegisteredElement {
  id: string;
  node: GlyphNode;
}

export interface FocusContextValue {
  focusedId: string | null;
  register(id: string, node: GlyphNode): () => void;
  requestFocus(id: string): void;
  focusNext(): void;
  focusPrev(): void;
  /** Mark an element as skippable during Tab navigation (e.g., disabled elements) */
  setSkippable(id: string, skippable: boolean): void;
  trapIds: Set<string> | null;
  pushTrap(ids: Set<string>): () => void;
  onFocusChange(handler: (focusedId: string | null) => void): () => void;
  /** Get all registered focusable elements (for custom navigation UIs) */
  getRegisteredElements(): RegisteredElement[];
  /** Get focusable elements in the current trap scope (or all if no trap) */
  getActiveElements(): RegisteredElement[];
}

export const FocusContext = createContext<FocusContextValue | null>(null);

// ---- Layout Context ----
export interface LayoutContextValue {
  getLayout(node: GlyphNode): LayoutRect;
  subscribe(node: GlyphNode, handler: (rect: LayoutRect) => void): () => void;
}

export const LayoutContext = createContext<LayoutContextValue | null>(null);

// ---- App Context ----
export interface AppContextValue {
  registerNode(node: GlyphNode): void;
  unregisterNode(node: GlyphNode): void;
  scheduleRender(): void;
  exit(code?: number): void;
  columns: number;
  rows: number;
}

export const AppContext = createContext<AppContextValue | null>(null);
