import type { Key } from "../types/index.js";

// Map key codes to key names (for kitty protocol and xterm modifyOtherKeys)
function getKeyNameFromCode(code: number): string {
  switch (code) {
    case 13: return "return";
    case 9: return "tab";
    case 27: return "escape";
    case 127: return "backspace";
    case 8: return "backspace";
    case 32: return " ";
    default:
      // Printable ASCII
      if (code >= 32 && code <= 126) {
        return String.fromCharCode(code).toLowerCase();
      }
      return "unknown";
  }
}

export function parseKeySequence(data: string): Key[] {
  const keys: Key[] = [];
  let i = 0;

  while (i < data.length) {
    const ch = data[i]!;
    const code = data.charCodeAt(i);

    // ESC sequences
    if (ch === "\x1b") {
      // CSI sequences: ESC [
      if (data[i + 1] === "[") {
        const seq = parseCsiSequence(data, i);
        if (seq) {
          keys.push(seq.key);
          i = seq.end;
          continue;
        }
      }

      // Alt + char: ESC followed by a printable char
      if (i + 1 < data.length && data.charCodeAt(i + 1) >= 32) {
        keys.push({
          name: data[i + 1]!,
          sequence: data.substring(i, i + 2),
          alt: true,
        });
        i += 2;
        continue;
      }

      // Standalone ESC
      keys.push({ name: "escape", sequence: "\x1b" });
      i++;
      continue;
    }

    // Ctrl combos (0x01-0x1a except known special)
    if (code >= 1 && code <= 26) {
      const letter = String.fromCharCode(code + 96); // a-z
      if (code === 13) {
        keys.push({ name: "return", sequence: "\r" });
      } else if (code === 9) {
        keys.push({ name: "tab", sequence: "\t" });
      } else if (code === 8) {
        keys.push({ name: "backspace", sequence: "\b" });
      } else {
        keys.push({ name: letter, sequence: ch, ctrl: true });
      }
      i++;
      continue;
    }

    // Backspace / DEL
    if (code === 127) {
      keys.push({ name: "backspace", sequence: ch });
      i++;
      continue;
    }

    // Printable characters
    keys.push({ name: ch, sequence: ch });
    i++;
  }

  return keys;
}

interface CsiResult {
  key: Key;
  end: number;
}

function parseCsiSequence(data: string, start: number): CsiResult | null {
  // start points to ESC, start+1 is [
  let i = start + 2;
  let params = "";

  while (i < data.length) {
    const code = data.charCodeAt(i);
    // Parameter bytes: 0x30-0x3F
    if (code >= 0x30 && code <= 0x3f) {
      params += data[i];
      i++;
    } else {
      break;
    }
  }

  if (i >= data.length) return null;

  const final = data[i]!;
  const sequence = data.substring(start, i + 1);
  i++;

  let key: Key;

  switch (final) {
    case "A":
      key = { name: "up", sequence };
      break;
    case "B":
      key = { name: "down", sequence };
      break;
    case "C":
      key = { name: "right", sequence };
      break;
    case "D":
      key = { name: "left", sequence };
      break;
    case "H":
      key = { name: "home", sequence };
      break;
    case "F":
      key = { name: "end", sequence };
      break;
    case "Z":
      key = { name: "tab", sequence, shift: true };
      break;
    case "~": {
      // Check for xterm modifyOtherKeys format: CSI 27;mod;code ~
      if (params.startsWith("27;")) {
        const modParts = params.split(";");
        const mod = parseInt(modParts[1] ?? "1", 10) - 1;
        const keyCode = parseInt(modParts[2] ?? "0", 10);
        key = { name: getKeyNameFromCode(keyCode), sequence };
        if (mod & 1) key.shift = true;
        if (mod & 2) key.alt = true;
        if (mod & 4) key.ctrl = true;
        break;
      }
      switch (params) {
        case "2":
          key = { name: "insert", sequence };
          break;
        case "3":
          key = { name: "delete", sequence };
          break;
        case "5":
          key = { name: "pageup", sequence };
          break;
        case "6":
          key = { name: "pagedown", sequence };
          break;
        default:
          key = { name: "unknown", sequence };
      }
      break;
    }
    // Kitty keyboard protocol: CSI code;mod u
    case "u": {
      const parts = params.split(";");
      const keyCode = parseInt(parts[0] ?? "0", 10);
      const mod = parseInt(parts[1] ?? "1", 10) - 1;
      key = { name: getKeyNameFromCode(keyCode), sequence };
      if (mod & 1) key.shift = true;
      if (mod & 2) key.alt = true;
      if (mod & 4) key.ctrl = true;
      break;
    }
    default:
      key = { name: "unknown", sequence };
  }

  // Parse modifiers from params (e.g., 1;2A = shift+up)
  if (params.includes(";")) {
    const parts = params.split(";");
    const mod = parseInt(parts[1] ?? "1", 10) - 1;
    if (mod & 1) key.shift = true;
    if (mod & 2) key.alt = true;
    if (mod & 4) key.ctrl = true;
  }

  return { key, end: i };
}
