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
  /** 
   * Register a focusable element. 
   * @param autoFocus - If false, element won't receive auto-focus when nothing is focused (default: true)
   */
  register(id: string, node: GlyphNode, autoFocus?: boolean): () => void;
  requestFocus(id: string): void;
  /** Clear focus from all elements */
  blur(): void;
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
  /** Force a full redraw of the entire screen (clear + repaint). */
  forceRedraw(): void;
  exit(code?: number): void;
  columns: number;
  rows: number;
  /** Subscribe to terminal resize events. Returns an unsubscribe function. */
  onResize(handler: () => void): () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

// ---- ScrollView Context ----
/** Provides boundary information for elements inside a ScrollView */
export interface ScrollViewBounds {
  /** Absolute Y position of visible area top (screen coordinates) */
  visibleTop: number;
  /** Absolute Y position of visible area bottom (screen coordinates) */
  visibleBottom: number;
  /** Height of the visible viewport */
  viewportHeight: number;
  /** Current scroll offset */
  scrollOffset: number;
}

/**
 * Options for {@link ScrollViewContextValue.scrollTo} and
 * {@link FocusableHandle.scrollIntoView}.
 *
 * @example
 * ```tsx
 * ref.current?.scrollIntoView({ block: "center" });
 * ```
 * @category Types
 */
export interface ScrollIntoViewOptions {
  /**
   * Where to align the element relative to the viewport.
   * - `"nearest"` — minimal scroll to make visible (default)
   * - `"start"` — align element top with viewport top
   * - `"center"` — center element in viewport
   * - `"end"` — align element bottom with viewport bottom
   */
  block?: "start" | "center" | "end" | "nearest";
}

export interface ScrollViewContextValue {
  /** Get the current visible bounds of the ScrollView */
  getBounds(): ScrollViewBounds;
  /** Scroll to make the given node visible within this ScrollView */
  scrollTo(node: GlyphNode, options?: ScrollIntoViewOptions): void;
}

export const ScrollViewContext = createContext<ScrollViewContextValue | null>(null);

// ---- Image Overlay Context ----
/** Pending image to be rendered after framebuffer paint */
export interface PendingImage {
  id: number;
  data: Buffer;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageOverlayContextValue {
  /** Register an image to be rendered after paint */
  registerImage(image: PendingImage): void;
  /** Unregister an image (when component unmounts or image is cleared) */
  unregisterImage(id: number): void;
}

export const ImageOverlayContext = createContext<ImageOverlayContextValue | null>(null);
