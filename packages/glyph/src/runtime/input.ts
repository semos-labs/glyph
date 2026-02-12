import type { Key } from "../types/index.js";

// Map key codes to key names (for kitty protocol and xterm modifyOtherKeys)
function getKeyNameFromCode(code: number): string {
  // Special keys (kitty protocol uses these codes)
  switch (code) {
    // Standard ASCII
    case 9: return "tab";
    case 13: return "return";
    case 27: return "escape";
    case 32: return "space";
    case 127: return "backspace";
    
    // Kitty protocol special keys
    case 57358: return "capslock";
    case 57359: return "scrolllock";
    case 57360: return "numlock";
    case 57361: return "printscreen";
    case 57362: return "pause";
    case 57363: return "menu";
    
    // Function keys (kitty uses these codes)
    case 57364: return "f13";
    case 57365: return "f14";
    case 57366: return "f15";
    case 57367: return "f16";
    case 57368: return "f17";
    case 57369: return "f18";
    case 57370: return "f19";
    case 57371: return "f20";
    case 57372: return "f21";
    case 57373: return "f22";
    case 57374: return "f23";
    case 57375: return "f24";
    case 57376: return "f25";
    
    // Keypad keys
    case 57399: return "kp0";
    case 57400: return "kp1";
    case 57401: return "kp2";
    case 57402: return "kp3";
    case 57403: return "kp4";
    case 57404: return "kp5";
    case 57405: return "kp6";
    case 57406: return "kp7";
    case 57407: return "kp8";
    case 57408: return "kp9";
    case 57409: return "kpdecimal";
    case 57410: return "kpdivide";
    case 57411: return "kpmultiply";
    case 57412: return "kpminus";
    case 57413: return "kpplus";
    case 57414: return "kpenter";
    case 57415: return "kpequal";
    
    // Navigation (kitty protocol)
    case 57416: return "kpleft";
    case 57417: return "kpright";
    case 57418: return "kpup";
    case 57419: return "kpdown";
    case 57420: return "kppageup";
    case 57421: return "kppagedown";
    case 57422: return "kphome";
    case 57423: return "kpend";
    case 57424: return "kpinsert";
    case 57425: return "kpdelete";
    
    // Media keys
    case 57428: return "mediaplaypause";
    case 57429: return "mediastop";
    case 57430: return "mediaprev";
    case 57431: return "medianext";
    case 57432: return "mediarewind";
    case 57433: return "mediafastforward";
    case 57434: return "mediamute";
    case 57435: return "volumedown";
    case 57436: return "volumeup";
    
    default:
      // Printable ASCII
      if (code >= 32 && code <= 126) {
        return String.fromCharCode(code).toLowerCase();
      }
      return "unknown";
  }
}

// Map CSI ~ params to key names
function getTildeKeyName(param: string): string {
  // Handle param;modifier format
  const baseParam = param.split(";")[0];
  switch (baseParam) {
    case "1": return "home";
    case "2": return "insert";
    case "3": return "delete";
    case "4": return "end";
    case "5": return "pageup";
    case "6": return "pagedown";
    case "7": return "home";
    case "8": return "end";
    case "11": return "f1";
    case "12": return "f2";
    case "13": return "f3";
    case "14": return "f4";
    case "15": return "f5";
    case "17": return "f6";
    case "18": return "f7";
    case "19": return "f8";
    case "20": return "f9";
    case "21": return "f10";
    case "23": return "f11";
    case "24": return "f12";
    case "25": return "f13";
    case "26": return "f14";
    case "28": return "f15";
    case "29": return "f16";
    case "31": return "f17";
    case "32": return "f18";
    case "33": return "f19";
    case "34": return "f20";
    default: return "unknown";
  }
}

// Parse modifier bits (shared between protocols)
function applyModifiers(key: Key, mod: number): void {
  // mod is 1-indexed in the protocol, so subtract 1
  const m = mod - 1;
  if (m & 1) key.shift = true;
  if (m & 2) key.alt = true;
  if (m & 4) key.ctrl = true;
  if (m & 8) key.meta = true; // Super/Cmd key
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

      // SS3 sequences: ESC O (function keys on some terminals)
      if (data[i + 1] === "O") {
        const seq = parseSs3Sequence(data, i);
        if (seq) {
          keys.push(seq.key);
          i = seq.end;
          continue;
        }
      }

      // Alt + char: ESC followed by a printable char
      if (i + 1 < data.length && data.charCodeAt(i + 1) >= 32) {
        const nextChar = data[i + 1]!;
        keys.push({
          name: nextChar === " " ? "space" : nextChar.toLowerCase(),
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

    // Printable characters (space gets special name)
    keys.push({ name: ch === " " ? "space" : ch, sequence: ch });
    i++;
  }

  return keys;
}

interface SeqResult {
  key: Key;
  end: number;
}

// Parse SS3 sequences (ESC O ...)
function parseSs3Sequence(data: string, start: number): SeqResult | null {
  // start points to ESC, start+1 is O
  if (start + 2 >= data.length) return null;
  
  const final = data[start + 2]!;
  const sequence = data.substring(start, start + 3);
  
  let key: Key;
  
  switch (final) {
    // Arrow keys (some terminals)
    case "A": key = { name: "up", sequence }; break;
    case "B": key = { name: "down", sequence }; break;
    case "C": key = { name: "right", sequence }; break;
    case "D": key = { name: "left", sequence }; break;
    
    // Home/End (some terminals)
    case "H": key = { name: "home", sequence }; break;
    case "F": key = { name: "end", sequence }; break;
    
    // Function keys F1-F4
    case "P": key = { name: "f1", sequence }; break;
    case "Q": key = { name: "f2", sequence }; break;
    case "R": key = { name: "f3", sequence }; break;
    case "S": key = { name: "f4", sequence }; break;
    
    // Keypad (application mode)
    case "j": key = { name: "kpmultiply", sequence }; break;
    case "k": key = { name: "kpplus", sequence }; break;
    case "l": key = { name: "kpcomma", sequence }; break;
    case "m": key = { name: "kpminus", sequence }; break;
    case "n": key = { name: "kpdecimal", sequence }; break;
    case "o": key = { name: "kpdivide", sequence }; break;
    case "p": key = { name: "kp0", sequence }; break;
    case "q": key = { name: "kp1", sequence }; break;
    case "r": key = { name: "kp2", sequence }; break;
    case "s": key = { name: "kp3", sequence }; break;
    case "t": key = { name: "kp4", sequence }; break;
    case "u": key = { name: "kp5", sequence }; break;
    case "v": key = { name: "kp6", sequence }; break;
    case "w": key = { name: "kp7", sequence }; break;
    case "x": key = { name: "kp8", sequence }; break;
    case "y": key = { name: "kp9", sequence }; break;
    case "M": key = { name: "kpenter", sequence }; break;
    
    default:
      return null;
  }
  
  return { key, end: start + 3 };
}

function parseCsiSequence(data: string, start: number): SeqResult | null {
  // start points to ESC, start+1 is [
  let i = start + 2;
  let params = "";

  while (i < data.length) {
    const code = data.charCodeAt(i);
    // Parameter bytes: 0x30-0x3F (digits, semicolon, etc.)
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
    // Arrow keys
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
      
    // Home/End
    case "H":
      key = { name: "home", sequence };
      break;
    case "F":
      key = { name: "end", sequence };
      break;
      
    // Shift+Tab
    case "Z":
      key = { name: "tab", sequence, shift: true };
      break;
      
    // Function keys (some terminals)
    case "P":
      key = { name: "f1", sequence };
      break;
    case "Q":
      key = { name: "f2", sequence };
      break;
    case "R":
      key = { name: "f3", sequence };
      break;
    case "S":
      key = { name: "f4", sequence };
      break;
      
    // ~ terminated sequences (VT-style)
    case "~": {
      // Check for xterm modifyOtherKeys format: CSI 27;mod;code ~
      if (params.startsWith("27;")) {
        const modParts = params.split(";");
        const mod = parseInt(modParts[1] ?? "1", 10);
        const keyCode = parseInt(modParts[2] ?? "0", 10);
        key = { name: getKeyNameFromCode(keyCode), sequence };
        applyModifiers(key, mod);
        break;
      }
      
      // Standard ~ sequences with optional modifiers
      key = { name: getTildeKeyName(params), sequence };
      
      // Apply modifiers if present (e.g., 3;5~ for Ctrl+Delete)
      if (params.includes(";")) {
        const parts = params.split(";");
        const mod = parseInt(parts[1] ?? "1", 10);
        applyModifiers(key, mod);
      }
      break;
    }
    
    // Kitty keyboard protocol: CSI code;mod u
    case "u": {
      const parts = params.split(";");
      const keyCode = parseInt(parts[0] ?? "0", 10);
      const mod = parseInt(parts[1] ?? "1", 10);
      key = { name: getKeyNameFromCode(keyCode), sequence };
      applyModifiers(key, mod);
      break;
    }
    
    // Focus events (if terminal reports them)
    case "I":
      key = { name: "focus", sequence };
      break;
    case "O":
      key = { name: "blur", sequence };
      break;
      
    default:
      key = { name: "unknown", sequence };
  }

  // Apply modifiers from params for letter-terminated sequences (e.g., 1;2A = shift+up)
  // But skip if we already applied them (like in ~ and u handlers)
  if (params.includes(";") && !["~", "u"].includes(final)) {
    const parts = params.split(";");
    const mod = parseInt(parts[parts.length - 1] ?? "1", 10);
    // Only apply if it looks like a modifier (small number)
    if (mod >= 1 && mod <= 16) {
      applyModifiers(key, mod);
    }
  }

  return { key, end: i };
}
