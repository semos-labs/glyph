import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  render,
  Box,
  Text,
  Input,
  ScrollView,
  Keybind,
  FocusScope,
  useApp,
  useStatusBar,
  StatusBar,
  ScopedKeybinds,
  createKeybindRegistry,
} from "@semos-labs/glyph";

// ── Data ────────────────────────────────────────────────────────────

interface Note {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  archived: boolean;
}

const INITIAL_NOTES: Note[] = [
  { id: 1, title: "Welcome to Glyph", body: "A React renderer for beautiful terminal UIs.", pinned: true, archived: false },
  { id: 2, title: "StatusBar component", body: "Unified status bar with command palette, search, and messages.", pinned: false, archived: false },
  { id: 3, title: "Keybind Registry", body: "Single source of truth for keyboard shortcuts and commands.", pinned: false, archived: false },
  { id: 4, title: "ScopedKeybinds", body: "Declarative, context-aware keybind binding from a registry.", pinned: false, archived: false },
  { id: 5, title: "Meeting notes", body: "Discuss project timeline and milestones for Q3.", pinned: false, archived: false },
  { id: 6, title: "Grocery list", body: "Eggs, milk, bread, coffee, avocados, sriracha.", pinned: false, archived: false },
  { id: 7, title: "Book recommendations", body: "Designing Data-Intensive Applications, SICP, Crafting Interpreters.", pinned: true, archived: false },
  { id: 8, title: "Old draft", body: "This note is archived and hidden by default.", pinned: false, archived: true },
];

// ── Keybind Registry ────────────────────────────────────────────────
//
// Static, typed registry — single source of truth for shortcuts,
// command palette entries, and help dialog content.

type Scope = "global" | "list" | "detail";

const registry = createKeybindRegistry<Scope>({
  global: [
    { key: "?", display: "?", description: "Show keybind help", action: "showHelp", command: "help" },
    { key: ":", display: ":", description: "Open command bar", action: "openCommand" },
    { key: "/", display: "/", description: "Search notes", action: "openSearch" },
    { key: "ctrl+c", display: "Ctrl+c", description: "Quit", action: "quit", command: "quit" },
    // Command-only (no hotkey — reachable via command palette only)
    { key: "", display: "", description: "Show archived notes", action: "showArchived", command: "archived" },
    { key: "", display: "", description: "Unarchive all notes", action: "unarchiveAll", command: "unarchive-all" },
    { key: "", display: "", description: "Show version info", action: "version", command: "version" },
  ],
  list: [
    { key: "j", display: "j / ↓", description: "Next note", action: "next" },
    { key: "down", display: "j / ↓", description: "Next note", action: "next" },
    { key: "k", display: "k / ↑", description: "Previous note", action: "prev" },
    { key: "up", display: "k / ↑", description: "Previous note", action: "prev" },
    { key: "g", display: "g", description: "First note", action: "first" },
    { key: "shift+g", display: "G", description: "Last note", action: "last" },
    { key: "return", display: "Enter", description: "Open note", action: "open" },
    { key: "p", display: "p", description: "Toggle pin", action: "togglePin", command: "pin" },
    { key: "shift+d", display: "D", description: "Archive note", action: "archive", command: "archive" },
    { key: "s", display: "s", description: "Star note", action: "star", command: "star" },
  ],
  detail: [
    { key: "escape", display: "Esc", description: "Back to list", action: "back" },
    { key: "h", display: "h / ←", description: "Back to list", action: "back" },
    { key: "left", display: "h / ←", description: "Back to list", action: "back" },
    { key: "p", display: "p", description: "Toggle pin", action: "togglePin" },
    { key: "shift+d", display: "D", description: "Archive note", action: "archive" },
  ],
});

// ── Clock widget (custom right-side content) ────────────────────────

function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const str = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return <Text style={{ bold: true }}>{str}</Text>;
}

// ── Help overlay ────────────────────────────────────────────────────
//
// Reads keybinds from the registry to dynamically generate help content.

function HelpOverlay({ context, onClose }: { context: Scope; onClose: () => void }) {
  const allSections = registry.getKeybindsForHelp(context, {
    scopeTitles: { global: "Global", list: "Note List", detail: "Note Detail" },
  });

  const [filter, setFilter] = useState("");

  // Filter sections/keybinds by query
  const sections = useMemo(() => {
    if (!filter.trim()) return allSections;
    const q = filter.toLowerCase();
    return allSections
      .map((section: { title: string; keybinds: { display: string; description: string }[] }) => ({
        ...section,
        keybinds: section.keybinds.filter(
          (kb: { display: string; description: string }) =>
            kb.display.toLowerCase().includes(q) ||
            kb.description.toLowerCase().includes(q),
        ),
      }))
      .filter((section: { keybinds: unknown[] }) => section.keybinds.length > 0);
  }, [allSections, filter]);

  const handleKeyPress = useCallback(
    (key: { name?: string }): boolean | void => {
      if (key.name === "escape") {
        if (filter) {
          setFilter("");
        } else {
          onClose();
        }
        return true;
      }
    },
    [filter, onClose],
  );

  return (
    <Box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 100,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <FocusScope trap>
        <Box
          style={{
            width: 48,
            height: "80%",
            bg: "blackBright",
            padding: 1,
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <Box style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 1 }}>
            <Text style={{ bold: true, color: "cyanBright" }}>Keyboard Shortcuts</Text>
            <Text style={{ dim: true }}>Esc to close</Text>
          </Box>

          {/* Search input */}
          <Box style={{ flexDirection: "row", paddingBottom: 1 }}>
            <Text style={{ color: "cyan" }}>/</Text>
            <Input
              value={filter}
              onChange={setFilter}
              onKeyPress={handleKeyPress}
              placeholder="Filter shortcuts…"
              autoFocus
              style={{ flexGrow: 1 }}
            />
          </Box>

          {/* Keybind list */}
          <ScrollView style={{ flexGrow: 1 }}>
            {sections.length === 0 ? (
              <Text style={{ dim: true }}>No matching shortcuts</Text>
            ) : (
              sections.map((section: { title: string; keybinds: { display: string; description: string }[] }, i: number) => (
                <Box key={i} style={{ flexDirection: "column", paddingBottom: 1 }}>
                  <Text style={{ bold: true, dim: true }}>{section.title}</Text>
                  {section.keybinds.map((kb: { display: string; description: string }, j: number) => (
                    <Box key={j} style={{ flexDirection: "row", gap: 1 }}>
                      <Text style={{ color: "cyan", width: 12 }}>{kb.display}</Text>
                      <Text>{kb.description}</Text>
                    </Box>
                  ))}
                </Box>
              ))
            )}
          </ScrollView>
        </Box>
      </FocusScope>
    </Box>
  );
}

// ── Root ─────────────────────────────────────────────────────────────
//
// Renders <StatusBar> at the top level. Command handling is forwarded
// to the inner <NoteApp> component via a ref so commands can trigger
// status bar messages through useStatusBar().

function Root() {
  const { exit } = useApp();
  const commandRef = useRef<(action: string, args?: string) => void>(() => { });
  const [notes, setNotes] = useState<Note[]>(INITIAL_NOTES);
  const [selectedId, setSelectedId] = useState<number>(INITIAL_NOTES[0]!.id);
  const [view, setView] = useState<"list" | "detail">("list");
  const [showArchived, setShowArchived] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Derived: visible notes (filtered, sorted)
  const visibleNotes = useMemo(() => {
    let list = showArchived ? notes : notes.filter((n: Note) => !n.archived);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n: Note) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a: Note, b: Note) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));
  }, [notes, showArchived, searchQuery]);

  // Derive index from selected ID — selection follows the note through re-sorts
  const selectedIndex = useMemo(() => {
    const idx = visibleNotes.findIndex((n: Note) => n.id === selectedId);
    return idx >= 0 ? idx : 0;
  }, [visibleNotes, selectedId]);

  const selectedNote = visibleNotes[selectedIndex] ?? null;

  // When the selected note disappears from the list (archived/filtered out),
  // fall back to the first visible note
  useEffect(() => {
    if (visibleNotes.length > 0 && !visibleNotes.some((n: Note) => n.id === selectedId)) {
      setSelectedId(visibleNotes[0]!.id);
    }
  }, [visibleNotes, selectedId]);

  // Navigate by index — resolves the note at that position and selects by ID
  const selectByIndex = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(visibleNotes.length - 1, idx));
      const note = visibleNotes[clamped];
      if (note) setSelectedId(note.id);
    },
    [visibleNotes],
  );

  // ── Search callbacks ──────────────────────────────────────

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleSearchDismiss = useCallback(() => {
    setSearchQuery("");
  }, []);

  const handleSearchNavigate = useCallback(
    (direction: "up" | "down") => {
      const newIdx = direction === "down"
        ? Math.min(visibleNotes.length - 1, selectedIndex + 1)
        : Math.max(0, selectedIndex - 1);
      selectByIndex(newIdx);
    },
    [visibleNotes.length, selectedIndex, selectByIndex],
  );

  // ── Command handler (delegates to inner ref) ──────────────

  const handleCommand = useCallback(
    (action: string, args?: string) => {
      // Some commands can be handled directly at this level
      switch (action) {
        case "quit":
          exit();
          return;
        case "showArchived":
          setShowArchived(true);
          break;
        case "unarchiveAll":
          setNotes((prev: Note[]) => prev.map((n: Note) => ({ ...n, archived: false })));
          break;
      }
      // Forward everything to inner component (it has useStatusBar for messages)
      commandRef.current(action, args);
    },
    [exit],
  );

  // ── Status line (left side of bar when idle) ──────────────

  const statusContent = useMemo(() => {
    if (view === "detail" && selectedNote) {
      return (
        <Box style={{ flexDirection: "row", gap: 1 }}>
          <Text style={{ color: "cyan" }}>viewing</Text>
          <Text>{selectedNote.title}</Text>
        </Box>
      );
    }
    const parts: string[] = [];
    parts.push(`${visibleNotes.length} note${visibleNotes.length === 1 ? "" : "s"}`);
    if (showArchived) parts.push("(incl. archived)");
    if (searchQuery) parts.push(`matching "${searchQuery}"`);
    return <Text style={{ dim: true }}>{parts.join(" ")}</Text>;
  }, [view, selectedNote, visibleNotes.length, showArchived, searchQuery]);

  return (
    <StatusBar
      // Command palette from registry
      commands={registry}
      onCommand={handleCommand}
      commandPlaceholder="Type a command…"
      // Search mode
      onSearch={handleSearch}
      onSearchDismiss={handleSearchDismiss}
      onSearchNavigate={handleSearchNavigate}
      searchPlaceholder="Search notes…"
      // Left status content
      status={statusContent}
      // Right side: pluggable one-line content
      right={
        <>
          <Text style={{ dim: true }}>notes</Text>
          <Text style={{ dim: true }}>│</Text>
          <Clock />
        </>
      }
      style={{ paddingX: 1 }}
    >
      <NoteApp
        commandRef={commandRef}
        notes={visibleNotes}
        selectedIndex={selectedIndex}
        selectByIndex={selectByIndex}
        selectedNote={selectedNote}
        view={view}
        setView={setView}
        showHelp={showHelp}
        setShowHelp={setShowHelp}
        setNotes={setNotes}
        showArchived={showArchived}
        searchQuery={searchQuery}
      />
    </StatusBar>
  );
}

// ── Inner app (child of StatusBar — can use useStatusBar) ───────────

function NoteApp({
  commandRef,
  notes,
  selectedIndex,
  selectByIndex,
  selectedNote,
  view,
  setView,
  showHelp,
  setShowHelp,
  setNotes,
  showArchived,
  searchQuery,
}: {
  commandRef: React.MutableRefObject<(action: string, args?: string) => void>;
  notes: Note[];
  selectedIndex: number;
  selectByIndex: (idx: number) => void;
  selectedNote: Note | null;
  view: "list" | "detail";
  setView: React.Dispatch<React.SetStateAction<"list" | "detail">>;
  showHelp: boolean;
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>;
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  showArchived: boolean;
  searchQuery: string;
}) {
  const { exit } = useApp();
  const bar = useStatusBar();

  // ── Actions (these use bar.showMessage) ─────────────────

  const togglePin = useCallback(() => {
    if (!selectedNote) return;
    const wasPinned = selectedNote.pinned;
    setNotes((prev: Note[]) =>
      prev.map((n: Note) => (n.id === selectedNote.id ? { ...n, pinned: !n.pinned } : n)),
    );
    bar.showMessage({
      text: wasPinned ? `Unpinned "${selectedNote.title}"` : `Pinned "${selectedNote.title}"`,
      type: "success",
    });
  }, [selectedNote, setNotes, bar]);

  const archiveNote = useCallback(() => {
    if (!selectedNote) return;
    const wasArchived = selectedNote.archived;
    setNotes((prev: Note[]) =>
      prev.map((n: Note) => (n.id === selectedNote.id ? { ...n, archived: !n.archived } : n)),
    );
    bar.showMessage({
      text: wasArchived ? `Restored "${selectedNote.title}"` : `Archived "${selectedNote.title}"`,
      type: wasArchived ? "success" : "warning",
    });
    if (view === "detail") setView("list");
  }, [selectedNote, setNotes, bar, view, setView]);

  const starNote = useCallback(() => {
    if (!selectedNote) return;
    bar.showMessage({ text: `Starred "${selectedNote.title}"`, type: "success" });
  }, [selectedNote, bar]);

  // ── Command ref: handle commands that need status bar ────

  commandRef.current = (action: string, _args?: string) => {
    switch (action) {
      case "showHelp":
        setShowHelp((v: boolean) => !v);
        break;
      case "version":
        bar.showMessage({ text: "Glyph Notes v1.0.0 — StatusBar Demo", type: "info", durationMs: 5000 });
        break;
      case "showArchived":
        bar.showMessage({ text: "Showing archived notes", type: "info" });
        break;
      case "unarchiveAll":
        bar.showMessage({ text: "All notes unarchived", type: "success" });
        break;
      case "togglePin":
        togglePin();
        break;
      case "archive":
        archiveNote();
        break;
      case "star":
        starNote();
        break;
    }
  };

  // ── Keybind handlers ────────────────────────────────────

  const globalHandlers = useMemo(
    () => ({
      showHelp: () => setShowHelp((v: boolean) => !v),
      quit: () => exit(),
    }),
    [exit, setShowHelp],
  );

  const listHandlers = useMemo(
    () => ({
      next: () => selectByIndex(selectedIndex + 1),
      prev: () => selectByIndex(selectedIndex - 1),
      first: () => selectByIndex(0),
      last: () => selectByIndex(notes.length - 1),
      open: () => { if (selectedNote) setView("detail"); },
      togglePin,
      archive: archiveNote,
      star: starNote,
    }),
    [notes.length, selectedIndex, selectedNote, togglePin, archiveNote, starNote, selectByIndex, setView],
  );

  // ── Detail view ─────────────────────────────────────────

  if (view === "detail" && selectedNote) {
    return (
      <Box style={{ flexDirection: "column", flexGrow: 1 }}>
        <Box style={{ flexDirection: "column", flexGrow: 1, padding: 1, gap: 1 }}>
          {/* Header */}
          <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ bold: true, color: "cyanBright" }}>{selectedNote.title}</Text>
            <Box style={{ flexDirection: "row", gap: 1 }}>
              {selectedNote.pinned && <Text style={{ color: "yellow" }}>* pinned</Text>}
              {selectedNote.archived && <Text style={{ color: "red" }}>[archived]</Text>}
            </Box>
          </Box>

          <Text style={{ dim: true }}>{"─".repeat(50)}</Text>
          <Box style={{ flexGrow: 1 }}><Text>{selectedNote.body}</Text></Box>
          <Text style={{ dim: true }}>Esc/h:back  p:pin  D:archive</Text>
        </Box>

        {/* Scoped keybinds from registry */}
        <ScopedKeybinds
          registry={registry}
          scope="detail"
          handlers={{
            back: () => setView("list"),
            togglePin,
            archive: archiveNote,
          }}
        />
        <ScopedKeybinds registry={registry} scope="global" handlers={globalHandlers} />

        {showHelp && <HelpOverlay context="detail" onClose={() => setShowHelp(false)} />}
      </Box>
    );
  }

  // ── List view ───────────────────────────────────────────

  return (
    <Box style={{ flexDirection: "column", flexGrow: 1 }}>
      {/* Title */}
      <Box
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingX: 1,
          paddingBottom: 1,
        }}
      >
        <Box style={{ flexDirection: "row", gap: 2 }}>
          <Text style={{ bold: true, color: "cyanBright" }}>Glyph Notes</Text>
          <Text style={{ dim: true }}>
            {notes.length} note{notes.length === 1 ? "" : "s"}
            {showArchived ? " (incl. archived)" : ""}
            {searchQuery ? ` matching "${searchQuery}"` : ""}
          </Text>
        </Box>
        <Text style={{ dim: true }}>/:search  ::cmd  ?:help</Text>
      </Box>

      {/* Note list */}
      <Box style={{ flexGrow: 1, flexShrink: 1 }}>
        <ScrollView
          scrollOffset={Math.max(0, selectedIndex - 5)}
        >
          {notes.length === 0 ? (
            <Box style={{ paddingX: 1 }}>
              <Text style={{ dim: true }}>No notes found.</Text>
            </Box>
          ) : (
            notes.map((note, index) => (
              <Box
                key={note.id}
                style={{
                  flexDirection: "row",
                  paddingX: 1,
                  maxHeight: 1,
                  height: 1,
                  bg: index === selectedIndex ? "white" : undefined,
                }}
              >
                <Text style={{ color: index === selectedIndex ? "black" : "yellow", width: 2 }}>
                  {note.pinned ? "* " : "  "}
                </Text>
                <Text
                  style={{
                    color: index === selectedIndex ? "black" : "cyan",
                    bold: index === selectedIndex,
                    flexGrow: 1,
                  }}
                  wrap="truncate"
                >
                  {note.title}
                </Text>
                {note.archived && (
                  <Text style={{ color: index === selectedIndex ? "black" : undefined, dim: index !== selectedIndex }}>
                    [archived]
                  </Text>
                )}
              </Box>
            ))
          )}
        </ScrollView>
      </Box>

      {/* Footer hints */}
      <Box style={{ paddingX: 1 }}>
        <Text style={{ dim: true }}>j/k:navigate  Enter:open  p:pin  D:archive  s:star</Text>
      </Box>

      {/* Scoped keybinds from registry */}
      <ScopedKeybinds registry={registry} scope="list" handlers={listHandlers} />
      <ScopedKeybinds registry={registry} scope="global" handlers={globalHandlers} />

      {showHelp && <HelpOverlay context="list" onClose={() => setShowHelp(false)} />}
    </Box>
  );
}

render(<Root />);
