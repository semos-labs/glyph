import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { Style } from "../types/index.js";
import { FocusContext } from "../hooks/context.js";
import { useInput } from "../hooks/useInput.js";
import { FocusScope } from "./FocusScope.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AlertOptions {
  /** Text for the OK button (default: "OK") */
  okText?: string;
  /** Style for the dialog box */
  style?: Style;
}

export interface ConfirmOptions extends AlertOptions {
  /** Text for the Cancel button (default: "Cancel") */
  cancelText?: string;
}

export interface DialogContextValue {
  /** Show an alert dialog. Returns a promise that resolves when dismissed. */
  alert: (content: ReactNode, options?: AlertOptions) => Promise<void>;
  /** Show a confirm dialog. Returns a promise that resolves to true (OK) or false (Cancel). */
  confirm: (content: ReactNode, options?: ConfirmOptions) => Promise<boolean>;
}

interface DialogState {
  id: number;
  type: "alert" | "confirm";
  content: ReactNode;
  okText: string;
  cancelText: string;
  style?: Style;
  resolve: (value: boolean) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const DialogContext = createContext<DialogContextValue | null>(null);

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook to show alert and confirm dialogs.
 * Must be used within a DialogHost.
 * 
 * @example
 * ```tsx
 * const { alert, confirm } = useDialog();
 * 
 * // Alert
 * await alert("Something happened!");
 * 
 * // Confirm
 * const ok = await confirm("Delete this item?", {
 *   okText: "Delete",
 *   cancelText: "Keep"
 * });
 * ```
 */
export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialog must be used within a DialogHost");
  }
  return ctx;
}

// ─── Dialog Host ─────────────────────────────────────────────────────────────

export interface DialogHostProps {
  children?: ReactNode;
}

/**
 * Host component for dialogs. Place this at the root of your app.
 * Provides the useDialog hook to children.
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <DialogHost>
 *       <MyApp />
 *     </DialogHost>
 *   );
 * }
 * ```
 */
export function DialogHost({ children }: DialogHostProps): React.JSX.Element {
  const [dialogs, setDialogs] = useState<DialogState[]>([]);
  const idCounter = useRef(0);

  const alert = useCallback((content: ReactNode, options?: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      const id = ++idCounter.current;
      setDialogs((prev) => [
        ...prev,
        {
          id,
          type: "alert",
          content,
          okText: options?.okText ?? "OK",
          cancelText: "",
          style: options?.style,
          resolve: () => resolve(),
        },
      ]);
    });
  }, []);

  const confirm = useCallback((content: ReactNode, options?: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      const id = ++idCounter.current;
      setDialogs((prev) => [
        ...prev,
        {
          id,
          type: "confirm",
          content,
          okText: options?.okText ?? "OK",
          cancelText: options?.cancelText ?? "Cancel",
          style: options?.style,
          resolve,
        },
      ]);
    });
  }, []);

  const dismissDialog = useCallback((id: number, result: boolean) => {
    setDialogs((prev) => {
      const dialog = prev.find((d) => d.id === id);
      if (dialog) {
        dialog.resolve(result);
      }
      return prev.filter((d) => d.id !== id);
    });
  }, []);

  const contextValue: DialogContextValue = { alert, confirm };

  // Only show the topmost dialog
  const activeDialog = dialogs[dialogs.length - 1];

  return React.createElement(
    DialogContext.Provider,
    { value: contextValue },
    children,
    activeDialog && React.createElement(DialogOverlay, {
      key: activeDialog.id,
      dialog: activeDialog,
      onDismiss: dismissDialog,
    }),
  );
}

// ─── Dialog Overlay ──────────────────────────────────────────────────────────

interface DialogOverlayProps {
  dialog: DialogState;
  onDismiss: (id: number, result: boolean) => void;
}

function DialogOverlay({ dialog, onDismiss }: DialogOverlayProps): React.JSX.Element {
  const focusCtx = useContext(FocusContext);
  
  // Refs to get the actual focusIds from the rendered nodes
  const okButtonRef = useRef<any>(null);
  const cancelButtonRef = useRef<any>(null);
  const okFocusIdRef = useRef<string | null>(null);
  const cancelFocusIdRef = useRef<string | null>(null);

  // Track which button is focused
  const [focusedButton, setFocusedButton] = useState<"ok" | "cancel">("ok");
  
  // Force re-registration when refs are populated
  const [refsReady, setRefsReady] = useState(0);

  // Register buttons with focus system
  useEffect(() => {
    if (!focusCtx || refsReady === 0) return;
    
    const cleanups: (() => void)[] = [];
    
    if (okButtonRef.current && okFocusIdRef.current) {
      cleanups.push(focusCtx.register(okFocusIdRef.current, okButtonRef.current));
    }
    if (cancelButtonRef.current && cancelFocusIdRef.current) {
      cleanups.push(focusCtx.register(cancelFocusIdRef.current, cancelButtonRef.current));
    }
    
    // Focus OK button initially
    if (okFocusIdRef.current) {
      focusCtx.requestFocus(okFocusIdRef.current);
    }
    
    return () => cleanups.forEach(fn => fn());
  }, [focusCtx, refsReady]);

  // Listen to focus changes to track which button is selected
  useEffect(() => {
    if (!focusCtx) return;
    
    return focusCtx.onFocusChange((id) => {
      if (id === okFocusIdRef.current) {
        setFocusedButton("ok");
      } else if (id === cancelFocusIdRef.current) {
        setFocusedButton("cancel");
      }
    });
  }, [focusCtx]);

  // Keyboard handling
  useInput((key) => {
    // Enter or Space to select
    if (key.name === "return" || key.name === "space") {
      if (dialog.type === "alert") {
        onDismiss(dialog.id, true);
      } else {
        // For confirm: OK = true, Cancel = false
        onDismiss(dialog.id, focusedButton === "ok");
      }
      return;
    }

    // Escape to cancel/dismiss
    if (key.name === "escape") {
      onDismiss(dialog.id, false);
      return;
    }

    // Arrow keys to switch buttons (Tab is handled by focus system)
    if (dialog.type === "confirm" && focusCtx) {
      if (key.name === "left" || key.name === "right") {
        if (focusedButton === "ok" && cancelFocusIdRef.current) {
          focusCtx.requestFocus(cancelFocusIdRef.current);
        } else if (okFocusIdRef.current) {
          focusCtx.requestFocus(okFocusIdRef.current);
        }
      }
    }
  }, [dialog, focusedButton, focusCtx, onDismiss]);

  // Calculate dialog dimensions
  const contentIsString = typeof dialog.content === "string";
  const contentLength = contentIsString ? (dialog.content as string).length : 0;
  const minWidth = Math.max(20, contentIsString ? Math.min(contentLength + 6, 50) : 30);

  // Dialog box style (no absolute positioning - centering wrapper handles it)
  const boxStyle: Style = {
    minWidth,
    maxWidth: 50,
    bg: "black",
    border: "round",
    borderColor: "white",
    padding: 1,
    flexDirection: "column",
    gap: 1,
    ...dialog.style,
  };

  // Button styles
  const getButtonStyle = (isSelected: boolean): Style => ({
    paddingX: 2,
    bg: isSelected ? "white" : "blackBright",
    color: isSelected ? "black" : "white",
    bold: isSelected,
  });

  return React.createElement(
    FocusScope,
    { trap: true },
    // Backdrop
    React.createElement("box" as any, {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
      },
    }),
    // Centering wrapper
    React.createElement(
      "box" as any,
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        },
      },
      // Dialog box
      React.createElement(
        "box" as any,
        { style: boxStyle },
        // Content
        React.createElement(
          "box" as any,
          { style: { flexDirection: "column" } },
          typeof dialog.content === "string"
            ? React.createElement("text" as any, null, dialog.content)
            : dialog.content,
        ),
        // Buttons row
        React.createElement(
          "box" as any,
          {
            style: {
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 1,
            },
          },
          // Cancel button (confirm only)
          dialog.type === "confirm" &&
            React.createElement(
              "box" as any,
              {
                style: getButtonStyle(focusedButton === "cancel"),
                focusable: true,
                ref: (node: any) => {
                  if (node && node.focusId && !cancelFocusIdRef.current) {
                    cancelButtonRef.current = node;
                    cancelFocusIdRef.current = node.focusId;
                    setRefsReady(r => r + 1);
                  }
                },
              },
              React.createElement("text" as any, null, dialog.cancelText),
            ),
          // OK button
          React.createElement(
            "box" as any,
            {
              style: getButtonStyle(focusedButton === "ok"),
              focusable: true,
              ref: (node: any) => {
                if (node && node.focusId && !okFocusIdRef.current) {
                  okButtonRef.current = node;
                  okFocusIdRef.current = node.focusId;
                  setRefsReady(r => r + 1);
                }
              },
            },
            React.createElement("text" as any, null, dialog.okText),
          ),
        ),
      ),
    ),
  );
}
