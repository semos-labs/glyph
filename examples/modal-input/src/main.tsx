import React, { useState, useCallback } from "react";
import {
  render,
  Box,
  Text,
  Input,
  FocusScope,
  Spacer,
  Keybind,
  Portal,
  Button,
  useApp,
} from "glyph";

function Modal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [name, setName] = useState("");

  return (
    <Portal>
      <Box
        style={{
          width: "100%",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Box
          style={{
            width: 50,
            border: "double",
            borderColor: "yellowBright",
            bg: "black",
            flexDirection: "column",
            padding: 1,
            gap: 1,
          }}
        >
          <Text style={{ bold: true, color: "yellowBright", textAlign: "center" }}>
            Modal Dialog
          </Text>

          <Text style={{ color: "white" }}>Enter your name:</Text>

          <FocusScope trap>
            <Input
              value={name}
              onChange={setName}
              placeholder="Type here..."
              style={{
                border: "single",
                borderColor: "cyan",
                padding: 0,
                width: "100%",
              }}
            />
          </FocusScope>

          {name.length > 0 && (
            <Text style={{ color: "green" }}>Hello, {name}!</Text>
          )}

          <Text style={{ dim: true, textAlign: "center" }}>
            Press ESC to close
          </Text>

          <Keybind keypress="escape" onPress={onClose} />
        </Box>
      </Box>
    </Portal>
  );
}

function App() {
  const [showModal, setShowModal] = useState(false);
  const { exit } = useApp();

  const handleClose = useCallback(() => {
    setShowModal(false);
  }, []);

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        border: "round",
        borderColor: "blue",
        padding: 1,
      }}
    >
      <Text style={{ bold: true, color: "blueBright" }}>
        Modal + Input Demo
      </Text>

      <Box style={{ flexGrow: 1, padding: 1, flexDirection: "column", gap: 1 }}>
        <Text style={{ color: "white" }}>
          This demonstrates Portal, Keybind, Spacer, Button, and text input.
        </Text>

        <Spacer />

        <Box style={{ flexDirection: "row", gap: 2 }}>
          <Button
            onPress={() => setShowModal(true)}
            style={{
              border: "single",
              borderColor: "cyan",
              paddingX: 2,
            }}
            focusedStyle={{
              border: "single",
              borderColor: "yellowBright",
              paddingX: 2,
              bold: true,
            }}
          >
            <Text>Open Modal (m)</Text>
          </Button>

          <Button
            onPress={() => exit()}
            style={{
              border: "single",
              borderColor: "red",
              paddingY: 0,
              paddingX: 2,
            }}
            focusedStyle={{
              border: "single",
              borderColor: "blue",
              paddingX: 2,
              bold: true,
            }}
          >
            <Text>Quit (q)</Text>
          </Button>
        </Box>
      </Box>

      <Box
        style={{
          justifyContent: "center",
          bg: "blue",
        }}
      >
        <Text style={{ bold: true }}>
          {showModal ? "Modal is open" : "TAB to navigate | ENTER to press | 'm' for modal | 'q' to quit"}
        </Text>
      </Box>

      {!showModal && (
        <>
          <Keybind keypress="q" onPress={() => exit()} />
          <Keybind keypress="m" onPress={() => setShowModal(true)} />
        </>
      )}

      {showModal && <Modal onClose={handleClose} />}
    </Box>
  );
}

render(<App />);
