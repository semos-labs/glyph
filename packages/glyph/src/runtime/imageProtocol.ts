/**
 * Terminal image protocol implementations
 * 
 * Supports:
 * - Kitty Graphics Protocol (Kitty, Ghostty, WezTerm)
 * - iTerm2 Inline Images Protocol (iTerm2, WezTerm)
 */

import { detectTerminalCapabilities } from "./terminalCapabilities.js";

const ESC = "\x1b";

export interface ImageRenderOptions {
  /** Image data as Buffer */
  data: Buffer;
  /** Target width in terminal cells */
  width: number;
  /** Target height in terminal cells */
  height: number;
  /** X position (0-indexed) */
  x: number;
  /** Y position (0-indexed) */
  y: number;
  /** Unique ID for the image (for Kitty protocol) */
  id?: number;
}

/**
 * Check if we're running inside tmux
 */
function inTmux(): boolean {
  return !!process.env.TMUX;
}

/**
 * Wrap an escape sequence for tmux passthrough
 * 
 * Tmux DCS passthrough format:
 * \x1bPtmux;<inner-with-ESC-doubled>\x1b\\
 * 
 * All \x1b characters inside the inner sequence become \x1b\x1b
 */
function tmuxWrap(seq: string): string {
  if (!inTmux()) return seq;
  
  // Double all ESC characters in the inner sequence
  const doubled = seq.replace(/\x1b/g, "\x1b\x1b");
  return `${ESC}Ptmux;${doubled}${ESC}\\`;
}

/**
 * Generate escape sequence to render an image at the specified position
 * Returns null if terminal doesn't support inline images
 */
export function renderImageEscapeSequence(opts: ImageRenderOptions): string | null {
  const caps = detectTerminalCapabilities();

  if (caps.supportsKittyGraphics) {
    return renderKittyGraphics(opts);
  }

  if (caps.supportsIterm2Images) {
    return renderIterm2Image(opts);
  }

  return null;
}

/**
 * Generate escape sequence to clear an image (Kitty protocol)
 */
export function clearImageEscapeSequence(id?: number): string | null {
  const caps = detectTerminalCapabilities();

  if (caps.supportsKittyGraphics) {
    let seq: string;
    // Delete all images or specific image by ID
    if (id !== undefined) {
      seq = `${ESC}_Ga=d,d=i,i=${id}${ESC}\\`;
    } else {
      // Delete all images
      seq = `${ESC}_Ga=d,d=a${ESC}\\`;
    }
    return tmuxWrap(seq);
  }

  return null;
}

/**
 * Kitty Graphics Protocol
 * https://sw.kovidgoyal.net/kitty/graphics-protocol/
 */
function renderKittyGraphics(opts: ImageRenderOptions): string {
  const { data, width, height, x, y, id } = opts;
  const base64 = data.toString("base64");

  // Move cursor to position first
  const moveCursor = `${ESC}[${y + 1};${x + 1}H`;

  // Try to get image dimensions
  const dims = getImageDimensions(data);
  
  // Build command matching chafa's format:
  // a=T - action: transmit and display
  // f=100 - format: PNG
  // s=<pixels> - source width in pixels
  // v=<pixels> - source height in pixels  
  // c=<cols> - width in cells
  // r=<rows> - height in cells
  // m=0/1 - more chunks (0=last, 1=more coming)
  // q=2 - quiet mode (suppress OK response)
  
  let cmd = `a=T,f=100`;
  // Assign image ID so we can delete it later
  if (id !== undefined) {
    cmd += `,i=${id}`;
  }
  if (dims) {
    cmd += `,s=${dims.width},v=${dims.height}`;
  }
  cmd += `,c=${width},r=${height}`;
  
  // Kitty protocol uses chunked transmission for large images
  // Each chunk is max 4096 bytes of base64
  const chunkSize = 4096;
  const result: string[] = [moveCursor];
  
  for (let i = 0; i < base64.length; i += chunkSize) {
    const chunk = base64.slice(i, i + chunkSize);
    const isLast = i + chunkSize >= base64.length;
    const more = isLast ? "m=0" : "m=1";

    let escSeq: string;
    if (i === 0) {
      // First chunk includes the full command
      escSeq = `${ESC}_G${cmd},${more},q=2;${chunk}${ESC}\\`;
    } else {
      // Subsequent chunks are continuation
      escSeq = `${ESC}_G${more};${chunk}${ESC}\\`;
    }
    
    result.push(tmuxWrap(escSeq));
  }
  // Note: cursor hide/show is handled centrally by the render loop
  // (render.ts) after all images are rendered.  Don't add ?25l/?25h
  // here — it would desync the nativeCursorVisible tracker.

  return result.join("");
}

/**
 * iTerm2 Inline Images Protocol
 * https://iterm2.com/documentation-images.html
 */
function renderIterm2Image(opts: ImageRenderOptions): string {
  const { data, width, height, x, y } = opts;
  const base64 = data.toString("base64");

  // Move cursor to position first
  const moveCursor = `${ESC}[${y + 1};${x + 1}H`;

  // iTerm2 uses OSC 1337 for inline images
  // Params:
  // width=<n> - width in cells
  // height=<n> - height in cells
  // preserveAspectRatio=1 - maintain aspect ratio
  // inline=1 - display inline

  const params = [
    `width=${width}`,
    `height=${height}`,
    "preserveAspectRatio=1",
    "inline=1",
  ].join(";");

  // OSC 1337 ; File=<params> : <base64> BEL
  // May need tmux wrapping too
  const imgSeq = `${ESC}]1337;File=${params}:${base64}\x07`;
  return moveCursor + (inTmux() ? tmuxWrap(imgSeq) : imgSeq);
}

/**
 * Get the aspect ratio of a PNG/JPEG image from its header
 * Returns { width, height } in pixels or null if can't parse
 */
export function getImageDimensions(data: Buffer): { width: number; height: number } | null {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    // IHDR chunk starts at byte 8, width at 16, height at 20 (big-endian)
    if (data.length >= 24) {
      const width = data.readUInt32BE(16);
      const height = data.readUInt32BE(20);
      return { width, height };
    }
  }

  // JPEG signature: FF D8 FF
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    // Parse JPEG segments to find SOF (Start of Frame)
    let offset = 2;
    while (offset < data.length - 8) {
      if (data[offset] !== 0xff) {
        offset++;
        continue;
      }

      const marker = data[offset + 1];
      
      // SOF markers: 0xC0-0xC3, 0xC5-0xC7, 0xC9-0xCB, 0xCD-0xCF
      if (marker !== undefined && (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      )) {
        // Height at offset+5, width at offset+7 (big-endian, 2 bytes each)
        const height = data.readUInt16BE(offset + 5);
        const width = data.readUInt16BE(offset + 7);
        return { width, height };
      }

      // Skip to next segment
      const segmentLength = data.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }
  }

  // GIF signature: GIF87a or GIF89a
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
    if (data.length >= 10) {
      const width = data.readUInt16LE(6);
      const height = data.readUInt16LE(8);
      return { width, height };
    }
  }

  return null;
}

/**
 * Calculate terminal cell dimensions for an image while preserving aspect ratio
 */
export function calculateCellDimensions(
  imageWidth: number,
  imageHeight: number,
  maxCellWidth: number,
  maxCellHeight: number,
  cellAspectRatio = 2.0, // Terminal cells are typically ~2x taller than wide
): { width: number; height: number } {
  // Convert max cell dimensions to "pixel-equivalent" units
  const maxPixelWidth = maxCellWidth;
  const maxPixelHeight = maxCellHeight * cellAspectRatio;

  // Calculate scale to fit
  const scaleX = maxPixelWidth / imageWidth;
  const scaleY = maxPixelHeight / imageHeight;
  const scale = Math.min(scaleX, scaleY);

  // Calculate final dimensions
  const finalPixelWidth = imageWidth * scale;
  const finalPixelHeight = imageHeight * scale;

  // Convert back to cell dimensions
  const cellWidth = Math.max(1, Math.round(finalPixelWidth));
  const cellHeight = Math.max(1, Math.round(finalPixelHeight / cellAspectRatio));

  return { width: cellWidth, height: cellHeight };
}
