import React, { useState, useEffect } from "react";
import {
  render,
  Box,
  Text,
  Select,
  Keybind,
  Spacer,
  useApp,
} from "@semos-labs/glyph";

const LANGUAGES = [
  { label: "TypeScript", value: "ts" },
  { label: "JavaScript", value: "js" },
  { label: "Rust", value: "rust" },
  { label: "Go", value: "go" },
  { label: "Python", value: "python" },
  { label: "Ruby", value: "ruby" },
  { label: "C++", value: "cpp" },
  { label: "Java", value: "java" },
  { label: "Kotlin", value: "kotlin" },
  { label: "Swift", value: "swift" },
  { label: "Zig", value: "zig" },
  { label: "Haskell", value: "haskell" },
  { label: "COBOL", value: "cobol", disabled: true },
];

const EDITORS = [
  { label: "Neovim", value: "nvim" },
  { label: "VS Code", value: "vscode" },
  { label: "Zed", value: "zed" },
  { label: "Helix", value: "helix" },
  { label: "Emacs", value: "emacs" },
];

const THEMES = [
  { label: "Catppuccin", value: "catppuccin" },
  { label: "Gruvbox", value: "gruvbox" },
  { label: "Nord", value: "nord" },
  { label: "Dracula", value: "dracula" },
  { label: "Solarized", value: "solarized" },
  { label: "Tokyo Night", value: "tokyo-night" },
];

const DYNAMIC_ITEMS = [
  { label: "Option A", value: "a" },
  { label: "Option B", value: "b" },
  { label: "Option C", value: "c" },
];

const CONDITIONAL_ITEMS = [
  { label: "Calendar 1", value: "cal1" },
  { label: "Calendar 2 (primary)", value: "cal2" },
  { label: "Calendar 3", value: "cal3" },
];

// Dependent selects data - like Account -> Calendars
const ACCOUNTS = [
  { label: "work@company.com", value: "work" },
  { label: "personal@gmail.com", value: "personal" },
  { label: "side@project.io", value: "side" },
];

const CALENDARS_BY_ACCOUNT: Record<string, { label: string; value: string }[]> = {
  work: [
    { label: "Work Calendar (primary)", value: "work-main" },
    { label: "Team Meetings", value: "work-team" },
    { label: "Deadlines", value: "work-deadlines" },
  ],
  personal: [
    { label: "Personal (primary)", value: "personal-main" },
    { label: "Family Events", value: "personal-family" },
    { label: "Birthdays", value: "personal-birthdays" },
    { label: "Gym Schedule", value: "personal-gym" },
  ],
  side: [
    { label: "Side Project (primary)", value: "side-main" },
  ],
};

function App() {
  const { exit } = useApp();
  const [lang, setLang] = useState<string | undefined>(undefined);
  const [editor, setEditor] = useState<string | undefined>(undefined);
  const [theme, setTheme] = useState<string | undefined>(undefined);
  
  // Dynamic items - starts empty, loads after 2 seconds
  const [dynamicItems, setDynamicItems] = useState<typeof DYNAMIC_ITEMS>([]);
  const [dynamicValue, setDynamicValue] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  
  // Conditional select - mimics user's implementation where Select doesn't exist until items load
  const [conditionalItems, setConditionalItems] = useState<typeof CONDITIONAL_ITEMS>([]);
  const [conditionalValue, setConditionalValue] = useState<string | undefined>(undefined);
  
  // Dependent selects - Account -> Calendars (like user's actual use case)
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>(undefined);
  const [selectedCalendar, setSelectedCalendar] = useState<string | undefined>(undefined);
  
  // Simulate async loading of calendars when account changes
  const [calendarsForAccount, setCalendarsForAccount] = useState<typeof CALENDARS_BY_ACCOUNT.work>([]);
  const [calendarsLoading, setCalendarsLoading] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDynamicItems(DYNAMIC_ITEMS);
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);
  
  // Load conditional items after 3 seconds (separate from dynamic)
  useEffect(() => {
    const timer = setTimeout(() => {
      setConditionalItems(CONDITIONAL_ITEMS);
      setConditionalValue(CONDITIONAL_ITEMS[0]?.value);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);
  
  // When account changes, load calendars with a delay (simulating API call)
  useEffect(() => {
    if (!selectedAccount) {
      setCalendarsForAccount([]);
      setSelectedCalendar(undefined);
      return;
    }
    
    setCalendarsLoading(true);
    setCalendarsForAccount([]); // Clear while loading
    setSelectedCalendar(undefined);
    
    const timer = setTimeout(() => {
      const calendars = CALENDARS_BY_ACCOUNT[selectedAccount] ?? [];
      setCalendarsForAccount(calendars);
      setSelectedCalendar(calendars[0]?.value); // Auto-select first
      setCalendarsLoading(false);
    }, 1000); // 1 second delay to simulate API
    
    return () => clearTimeout(timer);
  }, [selectedAccount]);

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        border: "round",
        borderColor: "cyan",
        padding: 1,
        gap: 1,
      }}
    >
      <Text style={{ bold: true, color: "cyanBright", textAlign: "center" }}>
        Select Component Demo
      </Text>

      <Box style={{ flexDirection: "row", gap: 2 }}>
        <Box style={{ flexDirection: "column", gap: 1, width: 30 }}>
          <Text style={{ bold: true, color: "yellow" }}>Language</Text>
          <Select
            items={LANGUAGES}
            value={lang}
            onChange={setLang}
            placeholder="Pick a language..."
            maxVisible={6}
            style={{ borderColor: "yellow" }}
            focusedStyle={{ borderColor: "yellowBright" }}
            highlightColor="yellow"
          />
        </Box>

        <Box style={{ flexDirection: "column", gap: 1, width: 25 }}>
          <Text style={{ bold: true, color: "green" }}>Editor</Text>
          <Select
            items={EDITORS}
            value={editor}
            onChange={setEditor}
            placeholder="Pick an editor..."
            style={{ borderColor: "green" }}
            focusedStyle={{ borderColor: "greenBright" }}
            highlightColor="green"
          />
        </Box>

        <Box style={{ flexDirection: "column", gap: 1, width: 25 }}>
          <Text style={{ bold: true, color: "magenta" }}>Theme</Text>
          <Select
            items={THEMES}
            value={theme}
            onChange={setTheme}
            placeholder="Pick a theme..."
            style={{ borderColor: "magenta" }}
            focusedStyle={{ borderColor: "magentaBright" }}
            highlightColor="magenta"
          />
        </Box>

        <Box style={{ flexDirection: "column", gap: 1, width: 25 }}>
          <Text style={{ bold: true, color: "red" }}>
            Dynamic {isLoading ? "(loading...)" : "(loaded)"}
          </Text>
          <Select
            items={dynamicItems}
            value={dynamicValue}
            onChange={setDynamicValue}
            placeholder={isLoading ? "Loading..." : "Pick one..."}
            style={{ borderColor: "red" }}
            focusedStyle={{ borderColor: "redBright" }}
            highlightColor="red"
          />
        </Box>
      </Box>

      {/* Conditional Select - mimics user's calendar implementation */}
      <Box style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
        <Text style={{ color: "white", width: 12 }}>calendar</Text>
        {conditionalItems.length > 0 ? (
          <Select
            items={conditionalItems}
            value={conditionalValue}
            onChange={setConditionalValue}
            placeholder="Pick calendar..."
            style={{ borderColor: "blue", width: 30 }}
            focusedStyle={{ borderColor: "blueBright" }}
            highlightColor="blue"
          />
        ) : (
          <Text style={{ color: "white", dim: true }}>Loading...</Text>
        )}
      </Box>

      {/* Dependent Selects - Account -> Calendar (exact user scenario) */}
      <Box style={{ flexDirection: "column", gap: 1, border: "round", borderColor: "cyan", padding: 1 }}>
        <Text style={{ bold: true, color: "cyanBright" }}>
          Dependent Selects (Account → Calendar)
        </Text>
        
        <Box style={{ flexDirection: "row", gap: 2 }}>
          <Box style={{ flexDirection: "column", gap: 1, width: 30 }}>
            <Text style={{ color: "white" }}>Account</Text>
            <Select
              items={ACCOUNTS}
              value={selectedAccount}
              onChange={setSelectedAccount}
              placeholder="Select account..."
              style={{ borderColor: "cyan" }}
              focusedStyle={{ borderColor: "cyanBright" }}
              highlightColor="cyan"
            />
          </Box>

          <Box style={{ flexDirection: "column", gap: 1, width: 35 }}>
            <Text style={{ color: "white" }}>
              Calendar {calendarsLoading ? "(loading...)" : `(${calendarsForAccount.length} items)`}
            </Text>
            <Select
              items={calendarsForAccount}
              value={selectedCalendar}
              onChange={setSelectedCalendar}
              disabled={calendarsForAccount.length === 0}
              placeholder={
                !selectedAccount 
                  ? "Select account first" 
                  : calendarsLoading 
                    ? "Loading..." 
                    : "Select calendar..."
              }
              style={{ borderColor: "cyan" }}
              focusedStyle={{ borderColor: "cyanBright" }}
              highlightColor="cyan"
            />
          </Box>
        </Box>

        <Text style={{ dim: true }}>
          Debug: calendarsForAccount = {JSON.stringify(calendarsForAccount.map(c => c.value))}
        </Text>
      </Box>

      <Box style={{ flexDirection: "column", gap: 0 }}>
        <Text style={{ bold: true, color: "cyan" }}>Selection:</Text>
        <Text>
          {lang ? `Language: ${lang}` : "Language: (none)"} |{" "}
          {editor ? `Editor: ${editor}` : "Editor: (none)"} |{" "}
          {theme ? `Theme: ${theme}` : "Theme: (none)"}
        </Text>
        <Text>
          {dynamicValue ? `Dynamic: ${dynamicValue}` : "Dynamic: (none)"} |{" "}
          {conditionalValue ? `Conditional: ${conditionalValue}` : "Conditional: (none)"}
        </Text>
        <Text>
          {selectedAccount ? `Account: ${selectedAccount}` : "Account: (none)"} |{" "}
          {selectedCalendar ? `Calendar: ${selectedCalendar}` : "Calendar: (none)"}
        </Text>
      </Box>

      <Spacer />

      <Box style={{ bg: "cyan", justifyContent: "center" }}>
        <Text style={{ bold: true, color: "black" }}>
          Tab = next | Enter/Space = open | Type to filter | Esc = close | q =
          quit
        </Text>
      </Box>

      <Keybind keypress="q" onPress={() => exit()} />
    </Box>
  );
}

render(<App />);
