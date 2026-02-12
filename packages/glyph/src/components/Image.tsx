/**
 * Image component for terminal UIs
 * 
 * Supports inline rendering via terminal protocols (Kitty, iTerm2)
 * and OS-level preview (Quick Look on macOS, xdg-open on Linux)
 */

import React, { useContext, useEffect, useRef, useState, useCallback } from "react";
import type { Style, Key } from "../types/index.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import { FocusContext, InputContext, LayoutContext, ImageOverlayContext, ScrollViewContext } from "../hooks/context.js";
import type { LayoutRect } from "../types/index.js";
import { loadImage, getImageName, isRemoteUrl, detectImageFormat, convertToPng } from "../runtime/imageLoader.js";
import { getImageDimensions } from "../runtime/imageProtocol.js";
import { supportsInlineImages } from "../runtime/terminalCapabilities.js";
import { openImagePreview } from "../runtime/osPreview.js";

export type ImageState = "placeholder" | "loading" | "loaded" | "error" | "preview";

export interface ImageProps {
  /** Image source - local path or remote URL */
  src: string;
  /** Fixed width in cells (optional, uses flexbox if not set) */
  width?: number;
  /** Fixed height in cells (optional, uses flexbox if not set) */
  height?: number;
  /** Container style (flexbox) */
  style?: Style;
  /** Style when focused */
  focusedStyle?: Style;
  /** Style for the placeholder */
  placeholderStyle?: Style;
  /** Whether the component is focusable (default: true) */
  focusable?: boolean;
  /** Allow inline rendering in terminal (default: true) */
  inline?: boolean;
  /** Custom placeholder text (default: image name) */
  placeholder?: string;
  /** Called when image state changes */
  onStateChange?: (state: ImageState) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Auto-load on mount (default: false - user presses space) */
  autoLoad?: boolean;
  /** 
   * Auto-size the box to fit the image dimensions (default: false).
   * When true, the box resizes to match the image's aspect ratio.
   * Use maxWidth/maxHeight to constrain the size.
   */
  autoSize?: boolean;
  /** Maximum width in cells when autoSize is true */
  maxWidth?: number;
  /** Maximum height in cells when autoSize is true */
  maxHeight?: number;
}

export function Image({
  src,
  width,
  height,
  style,
  focusedStyle,
  placeholderStyle,
  focusable = true,
  inline = true,
  placeholder,
  onStateChange,
  onError,
  autoLoad = false,
  autoSize = false,
  maxWidth,
  maxHeight,
}: ImageProps): React.JSX.Element {
  const focusCtx = useContext(FocusContext);
  const inputCtx = useContext(InputContext);
  const layoutCtx = useContext(LayoutContext);
  const imageOverlayCtx = useContext(ImageOverlayContext);
  const scrollViewCtx = useContext(ScrollViewContext);

  const nodeRef = useRef<GlyphNode | null>(null);
  const focusIdRef = useRef<string | null>(null);
  const imageIdRef = useRef<number>(Math.floor(Math.random() * 1000000));
  const lastScrollOffsetRef = useRef<number | null>(null); // null = not initialized yet

  // Component state
  const [nodeReady, setNodeReady] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [state, setState] = useState<ImageState>("placeholder");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutRect | null>(null);
  // Computed dimensions when autoSize is true
  const [computedDims, setComputedDims] = useState<{ width: number; height: number } | null>(null);
  // Track if image is visible (not scrolled out of view)
  const [isVisible, setIsVisible] = useState(true);

  // Loaded image data and computed dimensions
  const loadedImageRef = useRef<{ data: Buffer; localPath: string; cellWidth: number; cellHeight: number } | null>(null);

  const imageName = placeholder || getImageName(src);
  const isRemote = isRemoteUrl(src);

  // Update state and notify
  const updateState = useCallback((newState: ImageState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Register with focus system
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current || !nodeRef.current || !focusable) return;
    return focusCtx.register(focusIdRef.current, nodeRef.current);
  }, [focusCtx, focusable, nodeReady]);

  // Subscribe to focus changes
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current) return;
    const fid = focusIdRef.current;
    setIsFocused(focusCtx.focusedId === fid);
    return focusCtx.onFocusChange((newId) => {
      setIsFocused(newId === fid);
    });
  }, [focusCtx, nodeReady]);

  // Subscribe to layout changes
  useEffect(() => {
    if (!layoutCtx || !nodeRef.current) return;
    setLayout(layoutCtx.getLayout(nodeRef.current));
    return layoutCtx.subscribe(nodeRef.current, setLayout);
  }, [layoutCtx, nodeReady]);

  // Track scroll position and hide image when user scrolls
  // Only check when scrollViewCtx's scroll offset changes (via context identity change)
  useEffect(() => {
    if (!scrollViewCtx) return;
    
    const bounds = scrollViewCtx.getBounds();
    const currentOffset = bounds.scrollOffset;
    
    // Initialize on first mount
    if (lastScrollOffsetRef.current === null) {
      lastScrollOffsetRef.current = currentOffset;
      return;
    }
    
    // If scroll offset actually changed, hide the image
    if (currentOffset !== lastScrollOffsetRef.current) {
      lastScrollOffsetRef.current = currentOffset;
      setIsVisible(false);
      setComputedDims(null);
    }
  }, [scrollViewCtx]); // Only run when context changes (which happens on scroll)

  // Register/update image with overlay system when loaded and layout changes
  useEffect(() => {
    if (!imageOverlayCtx || state !== "loaded" || !loadedImageRef.current || !layout) return;
    
    // Don't register if hidden due to scroll
    if (!isVisible) {
      return;
    }

    const { data, cellWidth, cellHeight } = loadedImageRef.current;
    const imageId = imageIdRef.current;

    imageOverlayCtx.registerImage({
      id: imageId,
      data,
      x: layout.innerX,
      y: layout.innerY,
      width: cellWidth,
      height: cellHeight,
    });

    return () => {
      imageOverlayCtx.unregisterImage(imageId);
    };
  }, [imageOverlayCtx, state, layout, isVisible]);

  // Load and display image
  const loadAndDisplay = useCallback(async () => {
    if (state === "loading") return;

    updateState("loading");
    setErrorMsg(null);

    try {
      const image = await loadImage(src);
      
      // Decide how to display the image
      const canInline = inline && supportsInlineImages();

      if (canInline && layout) {
        // Check image format - Kitty protocol requires PNG
        const format = detectImageFormat(image.data);
        
        let imageData = image.data;
        if (format !== "png") {
          const pngData = convertToPng(image.data);
          if (!pngData) {
            // Fall back to OS preview if conversion fails
            updateState("preview");
            await openImagePreview(image.localPath);
            updateState("placeholder");
            return;
          }
          imageData = pngData;
        }
        
        // Get image pixel dimensions for autoSize calculation
        const imageDims = getImageDimensions(imageData);
        
        let targetWidth: number;
        let targetHeight: number;
        
        if (autoSize && imageDims) {
          // Calculate cell dimensions that fit the image while preserving aspect ratio
          // Terminal cells are roughly 2x taller than wide
          const cellAspectRatio = 2.0;
          
          // Convert image pixels to approximate cell dimensions
          // Assume ~8 pixels per cell width, ~16 pixels per cell height (common terminal sizes)
          const pixelsPerCellWidth = 8;
          const pixelsPerCellHeight = 16;
          
          let cellWidth = Math.ceil(imageDims.width / pixelsPerCellWidth);
          let cellHeight = Math.ceil(imageDims.height / pixelsPerCellHeight);
          
          // Apply max constraints if specified
          const effectiveMaxWidth = maxWidth ?? 80;
          const effectiveMaxHeight = maxHeight ?? 24;
          
          if (cellWidth > effectiveMaxWidth || cellHeight > effectiveMaxHeight) {
            // Scale down to fit within constraints
            const scaleX = effectiveMaxWidth / cellWidth;
            const scaleY = effectiveMaxHeight / cellHeight;
            const scale = Math.min(scaleX, scaleY);
            cellWidth = Math.max(1, Math.round(cellWidth * scale));
            cellHeight = Math.max(1, Math.round(cellHeight * scale));
          }
          
          targetWidth = cellWidth;
          targetHeight = cellHeight;
          
          // Update computed dimensions for the box
          setComputedDims({ width: cellWidth, height: cellHeight });
        } else {
          // Use fixed dimensions or layout dimensions
          targetWidth = width ?? layout.innerWidth;
          targetHeight = height ?? layout.innerHeight;
        }

        if (targetWidth <= 0 || targetHeight <= 0) {
          throw new Error("Image area too small");
        }

        // Apply hard limit: images should not exceed 30x6 cells
        const MAX_IMAGE_WIDTH = 30;
        const MAX_IMAGE_HEIGHT = 6;
        if (targetWidth > MAX_IMAGE_WIDTH || targetHeight > MAX_IMAGE_HEIGHT) {
          const scaleX = MAX_IMAGE_WIDTH / targetWidth;
          const scaleY = MAX_IMAGE_HEIGHT / targetHeight;
          const scale = Math.min(scaleX, scaleY);
          targetWidth = Math.max(1, Math.round(targetWidth * scale));
          targetHeight = Math.max(1, Math.round(targetHeight * scale));
        }

        // Store loaded image with target box dimensions
        // Kitty protocol preserves aspect ratio when given source dims (s,v) and target cells (c,r)
        loadedImageRef.current = {
          data: imageData,
          localPath: image.localPath,
          cellWidth: targetWidth,
          cellHeight: targetHeight,
        };

        updateState("loaded");
      } else {
        // Use OS preview
        updateState("preview");
        await openImagePreview(image.localPath);
        updateState("placeholder"); // Return to placeholder after preview closes
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setErrorMsg(error.message);
      updateState("error");
      onError?.(error);
    }
  }, [src, state, inline, layout, width, height, autoSize, maxWidth, maxHeight, updateState, onError]);

  // Handle key press (space to load/preview)
  useEffect(() => {
    if (!inputCtx || !focusIdRef.current || !focusable) return;
    const fid = focusIdRef.current;

    const handler = (key: Key): boolean => {
      if (focusCtx?.focusedId !== fid) return false;

      // Space or Enter to load/preview
      if (key.name === "space" || key.name === "return") {
        loadAndDisplay();
        return true;
      }

      // 'r' to reload
      if (key.name === "r" && loadedImageRef.current) {
        loadAndDisplay();
        return true;
      }

      // Escape to clear inline image and return to placeholder
      if (key.name === "escape" && state === "loaded") {
        loadedImageRef.current = null;
        setComputedDims(null); // Reset box size
        updateState("placeholder");
        return true;
      }

      return false;
    };

    return inputCtx.registerInputHandler(fid, handler);
  }, [inputCtx, focusCtx, focusable, nodeReady, loadAndDisplay, state, updateState]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && state === "placeholder" && layout && layout.innerWidth > 0) {
      loadAndDisplay();
    }
  }, [autoLoad, state, layout, loadAndDisplay]);

  // Cleanup on unmount
  useEffect(() => {
    const imageId = imageIdRef.current;
    return () => {
      imageOverlayCtx?.unregisterImage(imageId);
    };
  }, [imageOverlayCtx]);

  // Build display content
  let displayContent: React.ReactNode;
  let statusIcon: string;

  switch (state) {
    case "placeholder":
      statusIcon = isRemote ? "🌐" : "🖼️";
      displayContent = `${statusIcon} ${imageName}`;
      break;
    case "loading":
      statusIcon = "⏳";
      displayContent = `${statusIcon} Loading...`;
      break;
    case "loaded":
      // When loaded inline, show empty space (image is rendered via overlay)
      displayContent = null;
      break;
    case "preview":
      statusIcon = "👁️";
      displayContent = `${statusIcon} Previewing...`;
      break;
    case "error":
      statusIcon = "❌";
      displayContent = `${statusIcon} ${errorMsg || "Error"}`;
      break;
  }

  // Merge styles
  // When autoSize is true and we have computed dimensions, use those
  const effectiveWidth = autoSize && computedDims ? computedDims.width : width;
  const effectiveHeight = autoSize && computedDims ? computedDims.height : height;
  
  const baseStyle: Style = {
    border: "round" as const,
    borderColor: "blackBright" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    ...style,
    ...(effectiveWidth !== undefined ? { width: effectiveWidth } : {}),
    ...(effectiveHeight !== undefined ? { height: effectiveHeight } : {}),
  };

  const mergedStyle: Style = {
    ...baseStyle,
    // Default focus style: highlight border
    ...(isFocused ? { borderColor: "cyan" as const } : {}),
    // User's focusedStyle overrides defaults
    ...(isFocused && focusedStyle ? focusedStyle : {}),
  };

  const placeholderMergedStyle: Style = {
    color: "blackBright" as const,
    ...placeholderStyle,
    ...(isFocused ? { color: "cyan" as const } : {}),
  };

  return React.createElement(
    "box" as any,
    {
      style: mergedStyle,
      focusable,
      ref: (node: any) => {
        if (node) {
          nodeRef.current = node;
          focusIdRef.current = node.focusId;
          setNodeReady(true);
        } else {
          nodeRef.current = null;
          focusIdRef.current = null;
          setNodeReady(false);
        }
      },
    },
    displayContent !== null
      ? React.createElement(
          "text" as any,
          { style: placeholderMergedStyle },
          displayContent
        )
      : null
  );
}
