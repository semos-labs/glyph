import {
  createHighlighter as createShikiHighlighter,
  type BundledLanguage,
  type BundledTheme,
} from "shiki";

/** A single token of highlighted code with optional styling. */
export interface HighlightToken {
  /** The text content of the token. */
  content: string;
  /** Foreground color — either a Glyph named color or a hex string. */
  color?: string;
  /** Whether the token should be rendered bold. */
  bold?: boolean;
  /** Whether the token should be rendered italic. */
  italic?: boolean;
  /** Whether the token should be rendered with underline. */
  underline?: boolean;
}

/**
 * A syntax highlighter instance that tokenizes code strings.
 *
 * Created via {@link createHighlighter}. Can be passed to the `<Markdown>`
 * component's `highlight` prop to share a single Shiki instance across
 * multiple renders.
 */
export interface Highlighter {
  /** Tokenize a code string into styled lines. */
  highlight(code: string, lang?: string): HighlightToken[][];
  /** List of currently loaded language grammar IDs. */
  readonly loadedLanguages: string[];
}

export interface CreateHighlighterOptions {
  /**
   * Shiki theme name. When omitted, uses a built-in terminal-native theme
   * that outputs ANSI named colors (inherits from the terminal palette).
   */
  theme?: BundledTheme;
  /** Languages to load. Defaults to a common set. */
  langs?: BundledLanguage[];
}

// ── Sentinel hex values that map 1:1 to ANSI named colors ──

const S = {
  default: "#a00000",
  red: "#a00001",
  green: "#a00002",
  yellow: "#a00003",
  blue: "#a00004",
  magenta: "#a00005",
  cyan: "#a00006",
  white: "#a00007",
  blackBright: "#a00008",
  redBright: "#a00009",
  greenBright: "#a0000a",
  yellowBright: "#a0000b",
  blueBright: "#a0000c",
  magentaBright: "#a0000d",
  cyanBright: "#a0000e",
} as const;

const SENTINEL_TO_NAMED: Record<string, string | undefined> = {
  [S.default]: undefined,
  [S.red]: "red",
  [S.green]: "green",
  [S.yellow]: "yellow",
  [S.blue]: "blue",
  [S.magenta]: "magenta",
  [S.cyan]: "cyan",
  [S.white]: "white",
  [S.blackBright]: "blackBright",
  [S.redBright]: "redBright",
  [S.greenBright]: "greenBright",
  [S.yellowBright]: "yellowBright",
  [S.blueBright]: "blueBright",
  [S.magentaBright]: "magentaBright",
  [S.cyanBright]: "cyanBright",
};

// ── Custom terminal-native Shiki theme ──

const GLYPH_THEME = {
  name: "glyph-terminal",
  type: "dark" as const,
  colors: {
    "editor.foreground": S.default,
    "editor.background": "#000000",
  },
  tokenColors: [
    // Comments
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: S.blackBright, fontStyle: "italic" },
    },
    // Strings
    {
      scope: ["string", "string.quoted", "string.template"],
      settings: { foreground: S.green },
    },
    // Template expression delimiters  ${}
    {
      scope: [
        "punctuation.definition.template-expression",
        "punctuation.section.embedded",
      ],
      settings: { foreground: S.cyan },
    },
    // Regex
    {
      scope: ["string.regexp"],
      settings: { foreground: S.redBright },
    },
    // Escape chars
    {
      scope: ["constant.character.escape"],
      settings: { foreground: S.yellowBright },
    },
    // Keywords & storage
    {
      scope: ["keyword", "keyword.control", "storage.type", "storage.modifier"],
      settings: { foreground: S.magenta, fontStyle: "bold" },
    },
    // Operators — keep default weight
    {
      scope: ["keyword.operator", "storage.type.function.arrow"],
      settings: { foreground: S.default },
    },
    // Numbers
    {
      scope: ["constant.numeric"],
      settings: { foreground: S.yellowBright },
    },
    // Language constants (true, false, null, nil, None …)
    {
      scope: ["constant.language"],
      settings: { foreground: S.cyanBright },
    },
    // Functions
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call entity.name.function",
      ],
      settings: { foreground: S.blue },
    },
    // Types & classes
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.type",
        "support.class",
        "entity.other.inherited-class",
      ],
      settings: { foreground: S.cyan },
    },
    // HTML/XML/JSX tags
    {
      scope: ["entity.name.tag", "punctuation.definition.tag"],
      settings: { foreground: S.red },
    },
    // HTML/JSX attributes
    {
      scope: ["entity.other.attribute-name"],
      settings: { foreground: S.yellow },
    },
    // CSS properties
    {
      scope: ["support.type.property-name"],
      settings: { foreground: S.cyan },
    },
    // CSS values
    {
      scope: ["support.constant.property-value", "support.constant.color"],
      settings: { foreground: S.yellowBright },
    },
    // Decorators / annotations
    {
      scope: [
        "meta.decorator",
        "punctuation.decorator",
        "entity.name.function.decorator",
      ],
      settings: { foreground: S.yellow },
    },
    // this / self / super
    {
      scope: ["variable.language"],
      settings: { foreground: S.magentaBright, fontStyle: "italic" },
    },
    // Parameters
    {
      scope: ["variable.parameter"],
      settings: { foreground: S.default, fontStyle: "italic" },
    },
    // JSON keys
    {
      scope: ["support.type.property-name.json"],
      settings: { foreground: S.cyan },
    },
    // Markdown headings
    {
      scope: ["markup.heading", "entity.name.section"],
      settings: { foreground: S.magentaBright, fontStyle: "bold" },
    },
    // Markdown bold / italic
    { scope: ["markup.bold"], settings: { fontStyle: "bold" } },
    { scope: ["markup.italic"], settings: { fontStyle: "italic" } },
    // Markdown inline code
    {
      scope: ["markup.inline.raw", "markup.fenced_code"],
      settings: { foreground: S.yellowBright },
    },
    // Diff
    { scope: ["markup.inserted"], settings: { foreground: S.green } },
    { scope: ["markup.deleted"], settings: { foreground: S.red } },
    { scope: ["markup.changed"], settings: { foreground: S.yellow } },
  ],
};

// ── Defaults ──

const DEFAULT_LANGS: BundledLanguage[] = [
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "python",
  "rust",
  "go",
  "bash",
  "shell",
  "json",
  "jsonc",
  "yaml",
  "toml",
  "html",
  "css",
  "sql",
  "c",
  "cpp",
  "java",
  "ruby",
  "swift",
  "kotlin",
  "markdown",
  "diff",
  "dockerfile",
];

// ── Factory ──

/**
 * Create a syntax highlighter backed by Shiki (TextMate grammars).
 *
 * By default uses a terminal-native theme whose colors adapt to your
 * terminal palette. Pass a `theme` name to use a Shiki built-in theme
 * with fixed hex colors instead.
 *
 * The `<Markdown>` component handles this automatically — you only need
 * `createHighlighter` when sharing a single instance across multiple
 * components or when you need manual control.
 *
 * @param options - Optional theme and language configuration.
 * @returns A {@link Highlighter} instance ready to tokenize code.
 *
 * @example
 * ```ts
 * const hl = await createHighlighter();
 * const tokens = hl.highlight("const x = 1;", "typescript");
 * ```
 *
 * @example
 * ```ts
 * // Share across multiple Markdown components
 * const hl = await createHighlighter({ langs: ["tsx", "python"] });
 * <Markdown highlight={hl}>{doc1}</Markdown>
 * <Markdown highlight={hl}>{doc2}</Markdown>
 * ```
 * @category Markdown
 */
export async function createHighlighter(
  options?: CreateHighlighterOptions,
): Promise<Highlighter> {
  const useTerminalTheme = !options?.theme;
  const themeName = useTerminalTheme ? "glyph-terminal" : options!.theme!;

  const shiki = await createShikiHighlighter({
    themes: useTerminalTheme ? [GLYPH_THEME as any] : [themeName],
    langs: options?.langs ?? DEFAULT_LANGS,
  });

  const loaded = new Set(shiki.getLoadedLanguages());

  return {
    get loadedLanguages() {
      return [...loaded];
    },

    highlight(code: string, lang?: string): HighlightToken[][] {
      if (!lang || !loaded.has(lang)) {
        return code.split("\n").map((line) => [{ content: line }]);
      }

      try {
        const { tokens } = shiki.codeToTokens(code, {
          lang: lang as BundledLanguage,
          theme: themeName,
        });

        return tokens.map((line) =>
          line.map((token) => {
            const color = useTerminalTheme
              ? SENTINEL_TO_NAMED[token.color?.toLowerCase() ?? ""]
              : token.color;

            return {
              content: token.content,
              color: color ?? undefined,
              bold: !!(token.fontStyle && token.fontStyle & 2),
              italic: !!(token.fontStyle && token.fontStyle & 1),
              underline: !!(token.fontStyle && token.fontStyle & 4),
            };
          }),
        );
      } catch {
        return code.split("\n").map((line) => [{ content: line }]);
      }
    },
  };
}
