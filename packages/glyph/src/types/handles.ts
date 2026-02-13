/**
 * DOM-like imperative handles for focusable components.
 * Use these with React refs to programmatically control components.
 *
 * @example
 * ```tsx
 * const inputRef = useRef<InputHandle>(null);
 *
 * // Programmatic focus
 * inputRef.current?.focus();
 *
 * // Read current value
 * console.log(inputRef.current?.value);
 *
 * <Input ref={inputRef} onChange={setValue} />
 * ```
 */

/** Base handle shared by all focusable elements */
export interface FocusableHandle {
  /** Programmatically focus this element */
  focus(): void;
  /** Programmatically blur (unfocus) this element */
  blur(): void;
  /** Whether this element is currently focused */
  readonly isFocused: boolean;
}

/** Handle for Button */
export interface ButtonHandle extends FocusableHandle {}

/** Handle for Input — exposes current value */
export interface InputHandle extends FocusableHandle {
  /** Current text value */
  readonly value: string;
}

/** Handle for Select — exposes current selected value */
export interface SelectHandle extends FocusableHandle {
  /** Currently selected value (undefined if nothing selected) */
  readonly value: string | undefined;
  /** Whether the dropdown is currently open */
  readonly isOpen: boolean;
}

/** Handle for Checkbox — exposes checked state */
export interface CheckboxHandle extends FocusableHandle {
  /** Whether the checkbox is currently checked */
  readonly checked: boolean;
}

/** Handle for Radio — exposes selected value */
export interface RadioHandle<T = string> extends FocusableHandle {
  /** Currently selected value */
  readonly value: T | undefined;
}

/** Handle for List — exposes selected index */
export interface ListHandle extends FocusableHandle {
  /** Currently selected index */
  readonly selectedIndex: number;
}

/** Handle for Image */
export interface ImageHandle extends FocusableHandle {}

/** Handle for Text (when focusable) */
export interface TextHandle extends FocusableHandle {}
