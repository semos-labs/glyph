/**
 * @module Link
 * Focusable hyperlink component for terminal UIs.
 *
 * Opens a URL in the user's default browser when activated with Space or Enter.
 */

import React, { useContext, useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import type { ReactNode } from "react";
import type { Style, Key, LinkHandle } from "../types/index.js";
import { FocusContext, InputContext, ScrollViewContext } from "../hooks/context.js";
import type { ScrollIntoViewOptions } from "../hooks/context.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import { spawn } from "node:child_process";
import { platform } from "node:os";
import { Text } from "./Text.js";

/**
 * Open a URL in the user's default browser.
 *
 * Uses `open` on macOS, `xdg-open` on Linux, and `start` on Windows.
 */
function openUrl(url: string): void {
  const os = platform();
  let command: string;
  let args: string[];

  if (os === "darwin") {
    command = "open";
    args = [url];
  } else if (os === "linux") {
    command = "xdg-open";
    args = [url];
  } else if (os === "win32") {
    command = "cmd";
    args = ["/c", "start", '""', url];
  } else {
    return;
  }

  const proc = spawn(command, args, {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
  });
  proc.unref();
}

/**
 * Props for the {@link Link} component.
 */
export interface LinkProps {
  /** The URL to open when the link is activated. */
  href: string;
  /** Base style for the link container. */
  style?: Style;
  /** Style applied when the link is focused (merged with `style`). */
  focusedStyle?: Style;
  /** Custom content. When absent, the `href` is displayed as text. */
  children?: ReactNode;
  /** Whether the link is focusable (default: `true`). */
  focusable?: boolean;
  /** When `true`, the link is skipped in the focus order and ignores input. */
  disabled?: boolean;
  /** Called after the URL has been opened. */
  onOpen?: () => void;
}

/**
 * Focusable hyperlink for terminal UIs.
 *
 * Renders link text (or custom children) and opens the URL in the default
 * browser when the user presses Space or Enter. Focusable by default and
 * can be disabled.
 *
 * @example
 * ```tsx
 * <Link href="https://example.com">Visit Example</Link>
 * ```
 *
 * @example
 * ```tsx
 * // Minimal — displays the URL as text
 * <Link href="https://github.com" />
 * ```
 *
 * @example
 * ```tsx
 * // Styled link
 * <Link
 *   href="https://docs.example.com"
 *   style={{ color: "blue", underline: true }}
 *   focusedStyle={{ color: "cyan", bold: true }}
 * >
 *   Documentation
 * </Link>
 * ```
 * @category Navigation
 */
export const Link = forwardRef<LinkHandle, LinkProps>(
  function Link({ href, style, focusedStyle, children, focusable = true, disabled = false, onOpen }, ref) {
    const focusCtx = useContext(FocusContext);
    const inputCtx = useContext(InputContext);
    const scrollCtx = useContext(ScrollViewContext);
    const nodeRef = useRef<GlyphNode | null>(null);
    const focusIdRef = useRef<string | null>(null);

    const [nodeReady, setNodeReady] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      focus() {
        if (focusCtx && focusIdRef.current) {
          focusCtx.requestFocus(focusIdRef.current);
        }
      },
      blur() {
        if (focusCtx) {
          focusCtx.blur();
        }
      },
      get isFocused() {
        return isFocused;
      },
      scrollIntoView(opts?: ScrollIntoViewOptions) {
        if (scrollCtx && nodeRef.current) scrollCtx.scrollTo(nodeRef.current, opts);
      },
    }), [focusCtx, isFocused, scrollCtx]);

    // Register with focus system
    useEffect(() => {
      if (!focusCtx || !focusIdRef.current || !nodeRef.current || !focusable) return;
      return focusCtx.register(focusIdRef.current, nodeRef.current, false);
    }, [focusCtx, focusable, nodeReady]);

    // Handle disabled state
    useEffect(() => {
      if (!focusCtx || !focusIdRef.current) return;
      focusCtx.setSkippable(focusIdRef.current, !!disabled);
      if (disabled && focusCtx.focusedId === focusIdRef.current) {
        focusCtx.blur();
      }
    }, [focusCtx, disabled]);

    // Subscribe to focus changes
    useEffect(() => {
      if (!focusCtx || !focusIdRef.current) return;
      const fid = focusIdRef.current;
      setIsFocused(focusCtx.focusedId === fid);
      return focusCtx.onFocusChange((newId) => {
        setIsFocused(newId === fid);
      });
    }, [focusCtx, nodeReady]);

    // Handle Space / Enter to open the link
    useEffect(() => {
      if (!inputCtx || !focusIdRef.current || !focusable || disabled) return;
      const fid = focusIdRef.current;

      const handler = (key: Key): boolean => {
        if (focusCtx?.focusedId !== fid) return false;
        if (key.name === "return" || key.name === "space") {
          openUrl(href);
          onOpen?.();
          return true;
        }
        return false;
      };

      return inputCtx.registerInputHandler(fid, handler);
    }, [inputCtx, focusCtx, focusable, disabled, nodeReady, href, onOpen]);

    const mergedStyle: Style = {
      ...style,
      ...(isFocused && focusedStyle ? focusedStyle : {}),
    };

    const content = children ?? React.createElement("text" as any, { key: "label" }, href);

    return <Text
      ref={
        (node: any) => {
          if (node) {
            nodeRef.current = node;
            focusIdRef.current = node.focusId;
            setNodeReady(true);
          } else {
            nodeRef.current = null;
            focusIdRef.current = null;
            setNodeReady(false);
          }
        }
      }
      style={mergedStyle}
      focusable
    >{content}</Text>
  }
);
