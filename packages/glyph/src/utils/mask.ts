/**
 * Input mask utilities for Glyph Input component.
 * 
 * Mask pattern characters:
 * - `9` - Digit (0-9)
 * - `a` - Letter (a-z, A-Z)
 * - `*` - Alphanumeric (a-z, A-Z, 0-9)
 * - Any other character is treated as a literal (separator)
 * 
 * @example
 * ```tsx
 * import { createMask } from "@semos-labs/glyph";
 * 
 * // Phone: (123) 456-7890
 * const phoneMask = createMask("(999) 999-9999");
 * <Input onBeforeChange={phoneMask} />
 * 
 * // Date: 12/31/2024
 * const dateMask = createMask("99/99/9999");
 * <Input onBeforeChange={dateMask} />
 * 
 * // License plate: ABC-1234
 * const plateMask = createMask("aaa-9999");
 * <Input onBeforeChange={plateMask} />
 * ```
 */

export interface MaskOptions {
  /** The mask pattern */
  mask: string;
  /** Placeholder character for unfilled positions (default: "_") */
  placeholder?: string;
  /** Show placeholder in output (default: false) */
  showPlaceholder?: boolean;
}

type MaskChar = {
  type: "digit" | "letter" | "alphanumeric" | "literal";
  char: string;
};

function parseMask(mask: string): MaskChar[] {
  const result: MaskChar[] = [];
  for (const char of mask) {
    switch (char) {
      case "9":
        result.push({ type: "digit", char });
        break;
      case "a":
        result.push({ type: "letter", char });
        break;
      case "*":
        result.push({ type: "alphanumeric", char });
        break;
      default:
        result.push({ type: "literal", char });
        break;
    }
  }
  return result;
}

function isValidChar(char: string, type: MaskChar["type"]): boolean {
  switch (type) {
    case "digit":
      return /\d/.test(char);
    case "letter":
      return /[a-zA-Z]/.test(char);
    case "alphanumeric":
      return /[a-zA-Z0-9]/.test(char);
    case "literal":
      return true; // Literals are auto-inserted
  }
}

/**
 * Creates a mask handler for use with Input's onBeforeChange prop.
 * 
 * @param maskOrOptions - Mask pattern string or options object
 * @returns onBeforeChange handler function
 */
export function createMask(
  maskOrOptions: string | MaskOptions
): (newValue: string, oldValue: string) => string | false | void {
  const options: MaskOptions = typeof maskOrOptions === "string" 
    ? { mask: maskOrOptions } 
    : maskOrOptions;
  
  const { mask, placeholder = "_", showPlaceholder = false } = options;
  const maskChars = parseMask(mask);

  return (newValue: string, _oldValue: string): string | false | void => {
    // Extract only valid input characters (strip literals and placeholders)
    const inputChars: string[] = [];
    for (const char of newValue) {
      if (char !== placeholder && !/[\s\-\(\)\/\.\:]/.test(char) || /[a-zA-Z0-9]/.test(char)) {
        if (/[a-zA-Z0-9]/.test(char)) {
          inputChars.push(char);
        }
      }
    }

    // Build masked output
    let result = "";
    let inputIndex = 0;

    for (const maskChar of maskChars) {
      if (maskChar.type === "literal") {
        // Always include literals if we have more input to process
        // or if showPlaceholder is true
        if (inputIndex < inputChars.length || showPlaceholder) {
          result += maskChar.char;
        }
      } else {
        // Input position
        if (inputIndex < inputChars.length) {
          const char = inputChars[inputIndex]!;
          if (isValidChar(char, maskChar.type)) {
            result += char;
            inputIndex++;
          } else {
            // Skip invalid character
            inputIndex++;
            // Try again with next input char
            continue;
          }
        } else if (showPlaceholder) {
          result += placeholder;
        }
      }
    }

    return result;
  };
}

/**
 * Pre-built mask patterns for common use cases.
 */
export const masks = {
  /** US Phone: (123) 456-7890 */
  usPhone: createMask("(999) 999-9999"),
  
  /** International Phone: +1 234 567 8900 */
  intlPhone: createMask("+9 999 999 9999"),
  
  /** Date MM/DD/YYYY */
  dateUS: createMask("99/99/9999"),
  
  /** Date DD/MM/YYYY */
  dateEU: createMask("99/99/9999"),
  
  /** Date YYYY-MM-DD */
  dateISO: createMask("9999-99-99"),
  
  /** Time HH:MM */
  time: createMask("99:99"),
  
  /** Time HH:MM:SS */
  timeFull: createMask("99:99:99"),
  
  /** Credit Card: 1234 5678 9012 3456 */
  creditCard: createMask("9999 9999 9999 9999"),
  
  /** SSN: 123-45-6789 */
  ssn: createMask("999-99-9999"),
  
  /** ZIP Code: 12345 */
  zip: createMask("99999"),
  
  /** ZIP+4: 12345-6789 */
  zipPlus4: createMask("99999-9999"),
  
  /** IPv4: 192.168.001.001 */
  ipv4: createMask("999.999.999.999"),
  
  /** MAC Address: AA:BB:CC:DD:EE:FF */
  mac: createMask("**:**:**:**:**:**"),
};
