import React, { useState } from "react";
import {
  render,
  Box,
  Text,
  Input,
  Button,
  Checkbox,
  Select,
  JumpNav,
  Keybind,
  DialogHost,
  Portal,
  FocusScope,
} from "@semos-labs/glyph";

// Settings modal component - NO JumpNav needed inside!
function SettingsModal({
  onClose
}: {
  onClose: () => void;
}) {
  const [theme, setTheme] = useState("dark");
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(false);
  const [language, setLanguage] = useState("en");

  return (
    <Portal>
      <Box
        style={{
          position: "absolute",
          inset: 0,
          justifyContent: "center",
          alignItems: "center",
          zIndex: 100,
        }}
      >
        {/* Backdrop */}
        <Box
          style={{
            position: "absolute",
            inset: 0,
            bg: "black",
          }}
        />

        {/* Modal - FocusScope trap makes JumpNav show only modal elements */}
        <FocusScope trap autoFocus>
          <Box
            style={{
              position: "relative",
              bg: "blackBright",
              padding: 1,
              width: 50,
              flexDirection: "column",
              gap: 1,
            }}
          >
            <Text style={{ bold: true, color: "cyan" }}>
              ⚙ Settings (Ctrl+O for jump hints)
            </Text>

            {/* Theme select */}
            <Box style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
              <Text style={{ width: 14, color: "gray" }}>Theme</Text>
              <Select
                items={[
                  { label: "Dark", value: "dark" },
                  { label: "Light", value: "light" },
                  { label: "System", value: "system" },
                ]}
                value={theme}
                onChange={setTheme}
                style={{ bg: "black", flexGrow: 1 }}
                focusedStyle={{ bg: "white", color: "black" }}
                highlightColor="cyan"
              />
            </Box>

            {/* Language select */}
            <Box style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
              <Text style={{ width: 14, color: "gray" }}>Language</Text>
              <Select
                items={[
                  { label: "English", value: "en" },
                  { label: "Spanish", value: "es" },
                  { label: "French", value: "fr" },
                  { label: "German", value: "de" },
                ]}
                value={language}
                onChange={setLanguage}
                style={{ bg: "black", flexGrow: 1 }}
                focusedStyle={{ bg: "white", color: "black" }}
                highlightColor="cyan"
              />
            </Box>

            {/* Checkboxes */}
            <Box style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
              <Text style={{ width: 14, color: "gray" }}> </Text>
              <Checkbox
                checked={notifications}
                onChange={setNotifications}
                label="Enable notifications"
                focusedStyle={{ color: "cyan" }}
              />
            </Box>

            <Box style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
              <Text style={{ width: 14, color: "gray" }}> </Text>
              <Checkbox
                checked={autoSave}
                onChange={setAutoSave}
                label="Auto-save drafts"
                focusedStyle={{ color: "cyan" }}
              />
            </Box>

            {/* Buttons */}
            <Box style={{ flexDirection: "row", gap: 2, marginTop: 1, justifyContent: "flex-end" }}>
              <Button
                onPress={onClose}
                style={{ paddingX: 2, bg: "black" }}
                focusedStyle={{ bg: "green", color: "black" }}
              >
                <Text>Save</Text>
              </Button>
              <Button
                onPress={onClose}
                style={{ paddingX: 2, bg: "black" }}
                focusedStyle={{ bg: "red", color: "white" }}
              >
                <Text>Cancel</Text>
              </Button>
            </Box>

            <Keybind keypress="escape" onPress={onClose} />
          </Box>
        </FocusScope>
      </Box>
    </Portal>
  );
}

function App() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("us");
  const [newsletter, setNewsletter] = useState(false);
  const [terms, setTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleSubmit = () => {
    if (name && email && terms) {
      setSubmitted(true);
    }
  };

  const handleReset = () => {
    setName("");
    setEmail("");
    setCountry("us");
    setNewsletter(false);
    setTerms(false);
    setSubmitted(false);
  };

  return (
    <DialogHost>
      {/* ONE JumpNav at root - it's trap-aware! */}
      <JumpNav activationKey="ctrl+o">
        <Box style={{ flexDirection: "column", padding: 1 }}>
          {/* Header */}
          <Box style={{ marginBottom: 1, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ bold: true, color: "cyan" }}>
              JumpNav Demo - Press Ctrl+O to quick-jump
            </Text>
            <Button
              onPress={() => setShowSettings(true)}
              style={{ paddingX: 1, bg: "blackBright" }}
              focusedStyle={{ bg: "cyan", color: "black" }}
            >
              <Text>⚙ Settings</Text>
            </Button>
          </Box>

          {/* Instructions */}
          <Box style={{ marginBottom: 1 }}>
            <Text style={{ color: "gray", dim: true }}>
              Tab to navigate • Ctrl+O for jump hints • Open Settings to test trap-aware hints!
            </Text>
          </Box>

          {submitted ? (
            // Success state
            <Box style={{ flexDirection: "column", gap: 1 }}>
              <Text style={{ color: "green", bold: true }}>
                ✓ Form submitted successfully!
              </Text>
              <Box style={{ flexDirection: "column", paddingLeft: 2 }}>
                <Text>Name: {name}</Text>
                <Text>Email: {email}</Text>
                <Text>Country: {country}</Text>
                <Text>Newsletter: {newsletter ? "Yes" : "No"}</Text>
              </Box>
              <Box style={{ marginTop: 1 }}>
                <Button
                  onPress={handleReset}
                  style={{ paddingX: 2, bg: "blackBright" }}
                  focusedStyle={{ bg: "cyan", color: "black" }}
                >
                  <Text>Reset Form</Text>
                </Button>
              </Box>
            </Box>
          ) : (
            // Form
            <Box style={{ flexDirection: "column", gap: 1 }}>
              {/* Name field */}
              <Box style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
                <Text style={{ width: 12, color: "gray" }}>Name</Text>
                <Input
                  value={name}
                  onChange={setName}
                  placeholder="Enter your name"
                  style={{ bg: "blackBright", width: 30 }}
                  focusedStyle={{ bg: "white", color: "black" }}
                />
              </Box>

              {/* Email field */}
              <Box style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
                <Text style={{ width: 12, color: "gray" }}>Email</Text>
                <Input
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  style={{ bg: "blackBright", width: 30 }}
                  focusedStyle={{ bg: "white", color: "black" }}
                />
              </Box>

              {/* Country select */}
              <Box style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
                <Text style={{ width: 12, color: "gray" }}>Country</Text>
                <Select
                  items={[
                    { label: "United States", value: "us" },
                    { label: "Canada", value: "ca" },
                    { label: "United Kingdom", value: "uk" },
                    { label: "Germany", value: "de" },
                    { label: "France", value: "fr" },
                    { label: "Japan", value: "jp" },
                    { label: "Australia", value: "au" },
                  ]}
                  value={country}
                  onChange={setCountry}
                  style={{ bg: "blackBright", width: 30 }}
                  focusedStyle={{ bg: "white", color: "black" }}
                  highlightColor="cyan"
                />
              </Box>

              {/* Checkboxes */}
              <Box style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
                <Text style={{ width: 12, color: "gray" }}> </Text>
                <Checkbox
                  checked={newsletter}
                  onChange={setNewsletter}
                  label="Subscribe to newsletter"
                  focusedStyle={{ color: "cyan" }}
                />
              </Box>

              <Box style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
                <Text style={{ width: 12, color: "gray" }}> </Text>
                <Checkbox
                  checked={terms}
                  onChange={setTerms}
                  label="I agree to the terms"
                  focusedStyle={{ color: "cyan" }}
                />
              </Box>

              {/* Buttons */}
              <Box style={{ flexDirection: "row", gap: 2, marginTop: 1 }}>
                <Text style={{ width: 12 }}> </Text>
                <Button
                  onPress={handleSubmit}
                  style={{ paddingX: 2, bg: "blackBright" }}
                  focusedStyle={{ bg: "green", color: "black", bold: true }}
                  disabled={!name || !email || !terms}
                >
                  <Text>Submit</Text>
                </Button>
                <Button
                  onPress={handleReset}
                  style={{ paddingX: 2, bg: "blackBright" }}
                  focusedStyle={{ bg: "red", color: "white" }}
                >
                  <Text>Cancel</Text>
                </Button>
              </Box>

              {/* Validation hint */}
              {(!name || !email || !terms) && (
                <Box style={{ marginTop: 1, paddingLeft: 13 }}>
                  <Text style={{ color: "yellow", dim: true }}>
                    * Fill all required fields and accept terms
                  </Text>
                </Box>
              )}
            </Box>
          )}

          {/* Footer */}
          <Box style={{ marginTop: 2 }}>
            <Text style={{ color: "gray", dim: true }}>
              Press Ctrl+C to exit
            </Text>
          </Box>
        </Box>

        <Keybind keypress="ctrl+c" onPress={() => process.exit(0)} />

        {/* Settings Modal */}
        {showSettings && (
          <SettingsModal onClose={() => setShowSettings(false)} />
        )}
      </JumpNav>
    </DialogHost>
  );
}

render(<App />);
