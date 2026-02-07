import React, { useState } from "react";
import {
  render,
  Box,
  Text,
  Button,
  Keybind,
  useApp,
  DialogHost,
  useDialog,
} from "@nick-skriabin/glyph";

function App() {
  const { exit } = useApp();
  const { alert, confirm } = useDialog();
  const [lastAction, setLastAction] = useState<string>("No actions yet");
  const [itemCount, setItemCount] = useState(5);

  const handleSimpleAlert = async () => {
    await alert("This is a simple alert message!");
    setLastAction("Dismissed simple alert");
  };

  const handleCustomAlert = async () => {
    await alert("Operation completed successfully! Your changes have been saved.", {
      okText: "Got it!",
    });
    setLastAction("Dismissed custom alert");
  };

  const handleRichAlert = async () => {
    await alert(
      React.createElement(
        Box,
        { style: { flexDirection: "column", gap: 1 } },
        React.createElement(Text, { style: { bold: true, color: "greenBright" } }, "✓ Success!"),
        React.createElement(Text, null, "Your profile has been updated."),
        React.createElement(Text, { style: { dim: true } }, "Changes may take a few minutes to appear."),
      ),
      { okText: "Awesome!" }
    );
    setLastAction("Dismissed rich content alert");
  };

  const handleSimpleConfirm = async () => {
    const result = await confirm("Are you sure you want to continue?");
    setLastAction(result ? "Confirmed (simple)" : "Cancelled (simple)");
  };

  const handleDeleteConfirm = async () => {
    const result = await confirm("Are you sure you want to delete this item? This cannot be undone.", {
      okText: "Delete",
      cancelText: "Keep",
    });
    if (result) {
      setItemCount((c) => Math.max(0, c - 1));
      setLastAction("Item deleted!");
    } else {
      setLastAction("Deletion cancelled");
    }
  };

  const handleRichConfirm = async () => {
    const result = await confirm(
      React.createElement(
        Box,
        { style: { flexDirection: "column", gap: 1 } },
        React.createElement(Text, { style: { bold: true, color: "redBright" } }, "⚠ Warning"),
        React.createElement(Text, null, "You are about to reset all settings to defaults."),
        React.createElement(Text, { style: { dim: true } }, "This will clear all your preferences and customizations."),
      ),
      {
        okText: "Reset Everything",
        cancelText: "Never Mind",
      }
    );
    setLastAction(result ? "Settings reset!" : "Reset cancelled");
  };

  const handleChainedDialogs = async () => {
    await alert("Step 1: First, let me explain what's happening...");
    
    const proceed = await confirm("Step 2: Do you want to proceed with the operation?");
    if (!proceed) {
      setLastAction("Chained dialogs: cancelled at step 2");
      return;
    }

    const finalConfirm = await confirm("Step 3: Final confirmation - are you absolutely sure?", {
      okText: "Yes, I'm sure",
      cancelText: "Go back",
    });

    if (finalConfirm) {
      await alert("Step 4: Operation completed successfully! 🎉", {
        okText: "Hooray!",
      });
      setLastAction("Chained dialogs: completed all steps");
    } else {
      setLastAction("Chained dialogs: cancelled at step 3");
    }
  };

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: 1,
        gap: 1,
      }}
    >
      {/* Header */}
      <Box style={{ flexDirection: "column" }}>
        <Text style={{ bold: true, color: "cyanBright" }}>
          💬 Dialog Demo
        </Text>
        <Text style={{ dim: true }}>
          Alert and Confirm dialogs • Use Tab/Arrows + Enter • Press q to quit
        </Text>
      </Box>

      <Box style={{ height: 1 }} />

      {/* Alert Section */}
      <Text style={{ bold: true, color: "yellowBright" }}>Alerts</Text>
      <Box style={{ flexDirection: "row", gap: 2, flexWrap: "wrap" }}>
        <Button
          onPress={handleSimpleAlert}
          style={{ bg: "blackBright", paddingX: 2 }}
          focusedStyle={{ bg: "white", color: "black" }}
        >
          <Text>Simple Alert</Text>
        </Button>
        <Button
          onPress={handleCustomAlert}
          style={{ bg: "blackBright", paddingX: 2 }}
          focusedStyle={{ bg: "white", color: "black" }}
        >
          <Text>Custom Button Text</Text>
        </Button>
        <Button
          onPress={handleRichAlert}
          style={{ bg: "blackBright", paddingX: 2 }}
          focusedStyle={{ bg: "white", color: "black" }}
        >
          <Text>Rich Content</Text>
        </Button>
      </Box>

      <Box style={{ height: 1 }} />

      {/* Confirm Section */}
      <Text style={{ bold: true, color: "yellowBright" }}>Confirms</Text>
      <Box style={{ flexDirection: "row", gap: 2, flexWrap: "wrap" }}>
        <Button
          onPress={handleSimpleConfirm}
          style={{ bg: "blackBright", paddingX: 2 }}
          focusedStyle={{ bg: "white", color: "black" }}
        >
          <Text>Simple Confirm</Text>
        </Button>
        <Button
          onPress={handleDeleteConfirm}
          style={{ bg: "blackBright", paddingX: 2 }}
          focusedStyle={{ bg: "white", color: "black" }}
        >
          <Text>Delete Item ({itemCount})</Text>
        </Button>
        <Button
          onPress={handleRichConfirm}
          style={{ bg: "blackBright", paddingX: 2 }}
          focusedStyle={{ bg: "white", color: "black" }}
        >
          <Text>Rich Confirm</Text>
        </Button>
      </Box>

      <Box style={{ height: 1 }} />

      {/* Advanced Section */}
      <Text style={{ bold: true, color: "yellowBright" }}>Advanced</Text>
      <Box style={{ flexDirection: "row", gap: 2 }}>
        <Button
          onPress={handleChainedDialogs}
          style={{ bg: "blackBright", paddingX: 2 }}
          focusedStyle={{ bg: "white", color: "black" }}
        >
          <Text>Chained Dialogs (4 steps)</Text>
        </Button>
      </Box>

      {/* Spacer */}
      <Box style={{ flexGrow: 1 }} />

      {/* Status */}
      <Box style={{ bg: "blackBright", padding: 1 }}>
        <Text style={{ dim: true }}>Last action: </Text>
        <Text style={{ color: "green" }}>{lastAction}</Text>
      </Box>

      <Keybind keypress="q" onPress={() => exit()} />
    </Box>
  );
}

function Root() {
  return (
    <DialogHost>
      <App />
    </DialogHost>
  );
}

render(<Root />);
