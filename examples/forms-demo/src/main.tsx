import React, { useState } from "react";
import {
  render,
  Box,
  Text,
  Checkbox,
  Radio,
  Button,
  Input,
  Keybind,
  useApp,
} from "@semos-labs/glyph";

type Theme = "light" | "dark" | "system";
type NotifyFreq = "all" | "important" | "none";

function App() {
  const { exit } = useApp();

  // Form state
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<Theme>("dark");
  const [notifications, setNotifications] = useState<NotifyFreq>("important");
  
  // Checkboxes
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [newsletter, setNewsletter] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [betaFeatures, setBetaFeatures] = useState(false);

  const handleSubmit = () => {
    // Show summary (in real app, would save settings)
  };

  return (
    <Box style={{ padding: 1, gap: 1 }}>
      <Keybind keypress="q" onPress={() => exit()} />

      {/* Header */}
      <Box style={{ paddingBottom: 1 }}>
        <Text style={{ bold: true }}>Settings</Text>
        <Text style={{ dim: true }}>Configure your preferences</Text>
      </Box>

      {/* Name input */}
      <Box style={{ gap: 0 }}>
        <Text style={{ dim: true }}>display name</Text>
        <Input
          value={name}
          onChange={setName}
          placeholder="Enter your name..."
          style={{ bg: "blackBright", paddingX: 1, width: 40, color: "white" }}
          focusedStyle={{ bg: "white", color: "black", paddingX: 1 }}
        />
      </Box>

      {/* Theme selection */}
      <Box style={{ gap: 0 }}>
        <Text style={{ dim: true }}>theme</Text>
        <Radio
          items={[
            { label: "Light", value: "light" as Theme },
            { label: "Dark", value: "dark" as Theme },
            { label: "System", value: "system" as Theme },
          ]}
          value={theme}
          onChange={setTheme}
          direction="row"
          gap={2}
          focusedItemStyle={{ color: "cyanBright" }}
          selectedItemStyle={{ bold: true }}
        />
      </Box>

      {/* Notification frequency */}
      <Box style={{ gap: 0 }}>
        <Text style={{ dim: true }}>notifications</Text>
        <Radio
          items={[
            { label: "All notifications", value: "all" as NotifyFreq },
            { label: "Important only", value: "important" as NotifyFreq },
            { label: "None", value: "none" as NotifyFreq },
          ]}
          value={notifications}
          onChange={setNotifications}
          focusedItemStyle={{ color: "cyanBright" }}
          selectedItemStyle={{ bold: true }}
        />
      </Box>

      {/* Checkboxes */}
      <Box style={{ gap: 0, paddingTop: 1 }}>
        <Text style={{ dim: true }}>preferences</Text>
        <Box style={{ gap: 0 }}>
          <Checkbox
            checked={emailUpdates}
            onChange={setEmailUpdates}
            label="Receive email updates"
            focusedStyle={{ color: "cyanBright" }}
          />
          <Checkbox
            checked={newsletter}
            onChange={setNewsletter}
            label="Subscribe to newsletter"
            focusedStyle={{ color: "cyanBright" }}
          />
          <Checkbox
            checked={analytics}
            onChange={setAnalytics}
            label="Share anonymous analytics"
            focusedStyle={{ color: "cyanBright" }}
          />
          <Checkbox
            checked={betaFeatures}
            onChange={setBetaFeatures}
            label="Enable beta features"
            focusedStyle={{ color: "cyanBright" }}
          />
        </Box>
      </Box>

      {/* Summary */}
      <Box style={{ paddingTop: 1, gap: 0 }}>
        <Text style={{ dim: true }}>current settings</Text>
        <Box style={{ bg: "blackBright", padding: 1, gap: 0 }}>
          <Text>
            <Text style={{ dim: true }}>name: </Text>
            <Text>{name || "(not set)"}</Text>
          </Text>
          <Text>
            <Text style={{ dim: true }}>theme: </Text>
            <Text style={{ bold: true }}>{theme}</Text>
          </Text>
          <Text>
            <Text style={{ dim: true }}>notifications: </Text>
            <Text style={{ bold: true }}>{notifications}</Text>
          </Text>
          <Text>
            <Text style={{ dim: true }}>email: </Text>
            <Text>{emailUpdates ? "yes" : "no"}</Text>
            <Text style={{ dim: true }}> • newsletter: </Text>
            <Text>{newsletter ? "yes" : "no"}</Text>
          </Text>
          <Text>
            <Text style={{ dim: true }}>analytics: </Text>
            <Text>{analytics ? "yes" : "no"}</Text>
            <Text style={{ dim: true }}> • beta: </Text>
            <Text>{betaFeatures ? "yes" : "no"}</Text>
          </Text>
        </Box>
      </Box>

      {/* Actions */}
      <Box style={{ flexDirection: "row", gap: 1, paddingTop: 1 }}>
        <Button
          onPress={handleSubmit}
          style={{ paddingX: 2, bg: "blackBright" }}
          focusedStyle={{ bg: "white", color: "black" }}
        >
          <Text>save</Text>
        </Button>
        <Button
          onPress={() => exit()}
          style={{ paddingX: 2, bg: "blackBright" }}
          focusedStyle={{ bg: "white", color: "black" }}
        >
          <Text>cancel</Text>
        </Button>
      </Box>

      {/* Footer */}
      <Box style={{ paddingTop: 1 }}>
        <Text style={{ dim: true }}>
          tab/shift+tab to navigate • space/enter to toggle • q to quit
        </Text>
      </Box>
    </Box>
  );
}

render(<App />);
