// Entry point for Glyph - React renderer for terminal UIs
export { render } from "./render.js";

// Components
export { Box } from "./components/Box.js";
export type { BoxProps } from "./components/Box.js";
export { Text } from "./components/Text.js";
export type { TextProps } from "./components/Text.js";
export { Input } from "./components/Input.js";
export type { InputProps, InputType } from "./components/Input.js";
export { FocusScope } from "./components/FocusScope.js";
export type { FocusScopeProps } from "./components/FocusScope.js";
export { Spacer } from "./components/Spacer.js";
export type { SpacerProps } from "./components/Spacer.js";
export { Keybind } from "./components/Keybind.js";
export type { KeybindProps } from "./components/Keybind.js";
export { Portal } from "./components/Portal.js";
export type { PortalProps } from "./components/Portal.js";
export { Button } from "./components/Button.js";
export type { ButtonProps } from "./components/Button.js";
export { ScrollView } from "./components/ScrollView.js";
export type { ScrollViewProps, VisibleRange } from "./components/ScrollView.js";
export { List } from "./components/List.js";
export type { ListProps, ListItemInfo } from "./components/List.js";
export { Menu } from "./components/Menu.js";
export type { MenuProps, MenuItem } from "./components/Menu.js";
export { Progress } from "./components/Progress.js";
export type { ProgressProps } from "./components/Progress.js";
export { Spinner } from "./components/Spinner.js";
export type { SpinnerProps } from "./components/Spinner.js";
export { ToastHost, useToast } from "./components/Toast.js";
export type { ToastHostProps, Toast, ToastVariant, ToastPosition } from "./components/Toast.js";
export { Select } from "./components/Select.js";
export type { SelectProps, SelectItem } from "./components/Select.js";
export { Checkbox } from "./components/Checkbox.js";
export type { CheckboxProps } from "./components/Checkbox.js";
export { Radio } from "./components/Radio.js";
export type { RadioProps, RadioItem } from "./components/Radio.js";
export { DialogHost, useDialog } from "./components/Dialog.js";
export type { DialogHostProps, AlertOptions, ConfirmOptions, DialogContextValue } from "./components/Dialog.js";
export { JumpNav } from "./components/JumpNav.js";
export type { JumpNavProps } from "./components/JumpNav.js";
export { Image } from "./components/Image.js";
export type { ImageProps, ImageState } from "./components/Image.js";

// Hooks
export { useInput } from "./hooks/useInput.js";
export { useFocus } from "./hooks/useFocus.js";
export { useFocusable } from "./hooks/useFocusable.js";
export type { UseFocusableOptions, UseFocusableResult } from "./hooks/useFocusable.js";
export { useLayout } from "./hooks/useLayout.js";
export { useApp } from "./hooks/useApp.js";
export { useFocusRegistry } from "./hooks/useFocusRegistry.js";
export type { FocusableElement, FocusRegistryValue } from "./hooks/useFocusRegistry.js";

// Utilities
export { createMask, masks } from "./utils/mask.js";
export type { MaskOptions } from "./utils/mask.js";
export { parseAnsi, stripAnsi } from "./paint/ansi.js";
export type { AnsiStyle, StyledSegment } from "./paint/ansi.js";
export { detectTerminalCapabilities, supportsInlineImages } from "./runtime/terminalCapabilities.js";
export type { TerminalCapabilities } from "./runtime/terminalCapabilities.js";

// Types
export type {
  Style,
  LayoutRect,
  Key,
  RenderOptions,
  AppHandle,
  Color,
  NamedColor,
  HexColor,
  RGBColor,
  DimensionValue,
  BorderStyle,
  WrapMode,
  TextAlign,
  // Imperative handle types for refs
  FocusableHandle,
  ButtonHandle,
  InputHandle,
  SelectHandle,
  CheckboxHandle,
  RadioHandle,
  ListHandle,
  ImageHandle,
  TextHandle,
} from "./types/index.js";
