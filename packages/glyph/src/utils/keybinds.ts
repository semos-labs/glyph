/**
 * Static keybind registry for terminal applications.
 *
 * Create a typed registry of scoped keybinds that serves as the single
 * source of truth for keyboard shortcuts, command-palette entries, and
 * help-dialog content.
 *
 * @example
 * ```tsx
 * import { createKeybindRegistry } from "@semos-labs/glyph";
 *
 * const registry = createKeybindRegistry({
 *   global: [
 *     { key: "?", display: "?", description: "Show help", action: "openHelp", command: "help" },
 *     { key: "q", display: "q", description: "Quit", action: "quit", command: "quit" },
 *   ],
 *   list: [
 *     { key: "j", display: "j / ↓", description: "Next item", action: "next" },
 *     { key: "down", display: "j / ↓", description: "Next item", action: "next" },
 *     { key: "k", display: "k / ↑", description: "Previous item", action: "prev" },
 *     { key: "up", display: "k / ↑", description: "Previous item", action: "prev" },
 *   ],
 * });
 * ```
 * @module
 */

// ---- Types ----------------------------------------------------------------

/**
 * A single keybind definition within a scope.
 *
 * @example
 * ```tsx
 * const def: KeybindDef = {
 *   key: "shift+d",
 *   display: "D",
 *   description: "Delete item",
 *   action: "delete",
 *   command: "delete",
 * };
 * ```
 * @category Types
 */
export interface KeybindDef {
  /**
   * Key combo string used for matching (e.g. `"shift+d"`, `"ctrl+u"`, `":"`).
   * Leave empty (`""`) for command-only entries with no keyboard shortcut.
   */
  key: string;
  /** Human-readable display string shown in help dialogs (e.g. `"D"`, `"Ctrl+u"`). */
  display: string;
  /** Short description of what the keybind does. */
  description: string;
  /** Action identifier used to look up the handler in a handlers map. */
  action: string;
  /** Optional command name for the command palette. Omit to exclude from commands. */
  command?: string;
}

/**
 * A command entry extracted from the registry.
 *
 * @category Types
 */
export interface CommandDef {
  /** The command name (from {@link KeybindDef.command}). */
  name: string;
  /** Description of the command. */
  description: string;
  /** Action identifier to dispatch. */
  action: string;
}

/**
 * Options for {@link KeybindRegistry.getKeybindsForHelp}.
 *
 * @category Types
 */
export interface HelpOptions<S extends string> {
  /** Related sub-mode scopes to include after the primary scope. */
  related?: S[];
  /** Human-readable titles for scopes. Falls back to the scope key. */
  scopeTitles?: Partial<Record<S, string>>;
  /**
   * Which scope is the global scope (always appended last).
   * Default: `"global"` if it exists in the registry, otherwise omitted.
   */
  globalScope?: S;
}

/**
 * A typed keybind registry with helper methods.
 *
 * Created by {@link createKeybindRegistry}. Provides access to the raw
 * scope→keybind mapping and convenience methods for command lookup,
 * help generation, and more.
 *
 * @example
 * ```tsx
 * const commands = registry.getAllCommands();
 * const match = registry.findCommand("goto tomorrow");
 * const help = registry.getKeybindsForHelp("timeline");
 * ```
 * @category Types
 */
export interface KeybindRegistry<S extends string = string> {
  /** The raw scope→keybinds mapping. */
  readonly scopes: Readonly<Record<S, KeybindDef[]>>;

  /**
   * Get de-duplicated keybinds for a scope (unique by `display`).
   *
   * @param scope - Scope name.
   * @returns Keybinds with duplicate display values removed.
   */
  getKeybindsForScope(scope: S): KeybindDef[];

  /**
   * Collect every keybind that has a `command` field, sorted by name.
   *
   * @returns Sorted array of command definitions.
   */
  getAllCommands(): CommandDef[];

  /**
   * Find a command by user input text.
   *
   * Supports exact matches and parameterised commands (e.g. `"goto <date>"`
   * matches input `"goto tomorrow"` with `args = "tomorrow"`).
   *
   * @param input - Raw user input from the command bar.
   * @returns Matched command with optional args, or `null`.
   */
  findCommand(input: string): { name: string; action: string; args?: string } | null;

  /**
   * Build sections for a help dialog: context-specific, related sub-modes,
   * then global keybinds.
   *
   * @param context - The primary scope to display.
   * @param options - Optional related scopes and titles.
   * @returns Ordered sections for rendering.
   */
  getKeybindsForHelp(context: S, options?: HelpOptions<S>): { title: string; keybinds: KeybindDef[] }[];
}

// ---- Factory --------------------------------------------------------------

/**
 * Create a static keybind registry from a scope→keybinds mapping.
 *
 * The returned registry object exposes the raw data together with
 * helper methods for command lookup, help generation, and scope queries.
 *
 * @param scopes - A record mapping scope names to arrays of keybind definitions.
 * @returns A frozen {@link KeybindRegistry} instance.
 *
 * @example
 * ```tsx
 * import { createKeybindRegistry } from "@semos-labs/glyph";
 *
 * const registry = createKeybindRegistry({
 *   global: [
 *     { key: "?", display: "?", description: "Show help", action: "openHelp", command: "help" },
 *     { key: ":", display: ":", description: "Open command bar", action: "openCommand" },
 *     { key: "q", display: "q", description: "Quit", action: "quit", command: "quit" },
 *   ],
 *   list: [
 *     { key: "j", display: "j / ↓", description: "Next item", action: "next" },
 *     { key: "down", display: "j / ↓", description: "Next item", action: "next" },
 *     { key: "k", display: "k / ↑", description: "Previous item", action: "prev" },
 *     { key: "up", display: "k / ↑", description: "Previous item", action: "prev" },
 *     { key: "return", display: "Enter", description: "Open item", action: "open" },
 *   ],
 * });
 * ```
 * @category Utilities
 */
export function createKeybindRegistry<S extends string>(
  scopes: Record<S, KeybindDef[]>,
): KeybindRegistry<S> {
  // Cache expensive computations
  let cachedCommands: CommandDef[] | null = null;

  function getKeybindsForScope(scope: S): KeybindDef[] {
    const keybinds = scopes[scope] || [];
    const seen = new Set<string>();
    return keybinds.filter((kb) => {
      if (!kb.key || seen.has(kb.display)) return false;
      seen.add(kb.display);
      return true;
    });
  }

  function getAllCommands(): CommandDef[] {
    if (cachedCommands) return cachedCommands;

    const commands: CommandDef[] = [];
    const seen = new Set<string>();

    for (const scope of Object.keys(scopes) as S[]) {
      for (const kb of scopes[scope]) {
        if (kb.command && !seen.has(kb.command)) {
          seen.add(kb.command);
          commands.push({
            name: kb.command,
            description: kb.description,
            action: kb.action,
          });
        }
      }
    }

    commands.sort((a, b) => a.name.localeCompare(b.name));
    cachedCommands = commands;
    return commands;
  }

  function findCommand(input: string): { name: string; action: string; args?: string } | null {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return null;

    const commands = getAllCommands();

    // Exact match
    const exact = commands.find((c) => c.name === trimmed);
    if (exact) {
      return { name: exact.name, action: exact.action };
    }

    // Parameterised commands (e.g. "goto tomorrow" → { name: "goto", action: "gotoDate", args: "tomorrow" })
    const parts = trimmed.split(/\s+/);
    const cmdName = parts[0]!;
    const args = parts.slice(1).join(" ");

    const parameterised = commands.find(
      (c) => c.name.startsWith(cmdName + " <") || c.name === cmdName,
    );
    if (parameterised) {
      return { name: parameterised.name, action: parameterised.action, args: args || undefined };
    }

    return null;
  }

  function getKeybindsForHelp(
    context: S,
    options?: HelpOptions<S>,
  ): { title: string; keybinds: KeybindDef[] }[] {
    const { related = [], scopeTitles = {}, globalScope } = options ?? {};
    const sections: { title: string; keybinds: KeybindDef[] }[] = [];

    const titleOf = (scope: S): string =>
      (scopeTitles as Record<string, string | undefined>)[scope as string] ?? (scope as string);

    // Primary context
    const contextKeybinds = getKeybindsForScope(context);
    if (contextKeybinds.length > 0) {
      sections.push({ title: titleOf(context), keybinds: contextKeybinds });
    }

    // Related sub-mode scopes
    for (const sub of related) {
      const subKeybinds = getKeybindsForScope(sub);
      if (subKeybinds.length > 0) {
        sections.push({ title: titleOf(sub), keybinds: subKeybinds });
      }
    }

    // Global scope (appended last)
    const gScope = globalScope ?? ("global" as S);
    if (gScope !== context && gScope in scopes) {
      const globalKeybinds = getKeybindsForScope(gScope);
      if (globalKeybinds.length > 0) {
        sections.push({ title: titleOf(gScope), keybinds: globalKeybinds });
      }
    }

    return sections;
  }

  return {
    scopes,
    getKeybindsForScope,
    getAllCommands,
    findCommand,
    getKeybindsForHelp,
  };
}
