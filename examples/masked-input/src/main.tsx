import React, { useState } from "react";
import {
  render,
  Box,
  Text,
  Input,
  Keybind,
  useApp,
  createMask,
  masks,
  ScrollView,
} from "@semos-labs/glyph";

// Custom masks
const licensePlate = createMask("aaa-9999");
const productCode = createMask("aa-999-**");
const hexColor = createMask("#******");

function App() {
  const { exit } = useApp();

  // Form state
  const [phone, setPhone] = useState("");
  const [creditCard, setCreditCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [ssn, setSsn] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [zip, setZip] = useState("");
  const [ip, setIp] = useState("");
  const [mac, setMac] = useState("");
  const [plate, setPlate] = useState("");
  const [product, setProduct] = useState("");
  const [color, setColor] = useState("");

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: 1,
      }}
    >
      {/* Header */}
      <Box style={{ flexDirection: "column", gap: 0 }}>
        <Text style={{ bold: true, color: "cyanBright" }}>
          ⌨️  Masked Input Demo
        </Text>
        <Text style={{ dim: true }}>
          Input masks for formatted data entry • Tab to navigate • q to quit
        </Text>
      </Box>

      <Box style={{ height: 1 }} />

      {/* Form */}
      <ScrollView style={{ flexGrow: 1 }} focusable={false}>
        <Box style={{ flexDirection: "column", gap: 1 }}>
          {/* Contact Section */}
          <Text style={{ bold: true, color: "yellowBright" }}>
            Contact Information
          </Text>
          
          <Box style={{ flexDirection: "row", gap: 2 }}>
            <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
              <Text style={{ dim: true }}>phone (us)</Text>
              <Input
                value={phone}
                onChange={setPhone}
                onBeforeChange={masks.usPhone}
                placeholder="(___) ___-____"
                style={{ bg: "blackBright", paddingX: 1 }}
                focusedStyle={{ bg: "white", color: "black" }}
              />
            </Box>
            <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
              <Text style={{ dim: true }}>social security</Text>
              <Input
                value={ssn}
                onChange={setSsn}
                onBeforeChange={masks.ssn}
                placeholder="___-__-____"
                style={{ bg: "blackBright", paddingX: 1 }}
                focusedStyle={{ bg: "white", color: "black" }}
              />
            </Box>
          </Box>

          <Box style={{ height: 1 }} />

          {/* Payment Section */}
          <Text style={{ bold: true, color: "yellowBright" }}>
            Payment Details
          </Text>

          <Box style={{ flexDirection: "column" }}>
            <Text style={{ dim: true }}>credit card</Text>
            <Input
              value={creditCard}
              onChange={setCreditCard}
              onBeforeChange={masks.creditCard}
              placeholder="____ ____ ____ ____"
              style={{ bg: "blackBright", paddingX: 1 }}
              focusedStyle={{ bg: "white", color: "black" }}
            />
          </Box>

          <Box style={{ flexDirection: "row", gap: 2 }}>
            <Box style={{ flexDirection: "column", width: 15 }}>
              <Text style={{ dim: true }}>expiry</Text>
              <Input
                value={expiry}
                onChange={setExpiry}
                onBeforeChange={createMask("99/99")}
                placeholder="MM/YY"
                style={{ bg: "blackBright", paddingX: 1 }}
                focusedStyle={{ bg: "white", color: "black" }}
              />
            </Box>
            <Box style={{ flexDirection: "column", width: 10 }}>
              <Text style={{ dim: true }}>cvv</Text>
              <Input
                value={cvv}
                onChange={setCvv}
                onBeforeChange={createMask("999")}
                placeholder="___"
                style={{ bg: "blackBright", paddingX: 1 }}
                focusedStyle={{ bg: "white", color: "black" }}
              />
            </Box>
          </Box>

          <Box style={{ height: 1 }} />

          {/* Date & Time Section */}
          <Text style={{ bold: true, color: "yellowBright" }}>
            Date & Time
          </Text>

          <Box style={{ flexDirection: "row", gap: 2 }}>
            <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
              <Text style={{ dim: true }}>date (mm/dd/yyyy)</Text>
              <Input
                value={date}
                onChange={setDate}
                onBeforeChange={masks.dateUS}
                placeholder="__/__/____"
                style={{ bg: "blackBright", paddingX: 1 }}
                focusedStyle={{ bg: "white", color: "black" }}
              />
            </Box>
            <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
              <Text style={{ dim: true }}>time (hh:mm)</Text>
              <Input
                value={time}
                onChange={setTime}
                onBeforeChange={masks.time}
                placeholder="__:__"
                style={{ bg: "blackBright", paddingX: 1 }}
                focusedStyle={{ bg: "white", color: "black" }}
              />
            </Box>
          </Box>

          <Box style={{ height: 1 }} />

          {/* Network Section */}
          <Text style={{ bold: true, color: "yellowBright" }}>
            Network
          </Text>

          <Box style={{ flexDirection: "row", gap: 2 }}>
            <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
              <Text style={{ dim: true }}>ip address</Text>
              <Input
                value={ip}
                onChange={setIp}
                onBeforeChange={masks.ipv4}
                placeholder="___.___.___.___"
                style={{ bg: "blackBright", paddingX: 1 }}
                focusedStyle={{ bg: "white", color: "black" }}
              />
            </Box>
            <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
              <Text style={{ dim: true }}>mac address</Text>
              <Input
                value={mac}
                onChange={setMac}
                onBeforeChange={masks.mac}
                placeholder="__:__:__:__:__:__"
                style={{ bg: "blackBright", paddingX: 1 }}
                focusedStyle={{ bg: "white", color: "black" }}
              />
            </Box>
          </Box>

          <Box style={{ height: 1 }} />

          {/* Custom Masks Section */}
          <Text style={{ bold: true, color: "yellowBright" }}>
            Custom Masks
          </Text>

          <Box style={{ flexDirection: "row", gap: 2 }}>
            <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
              <Text style={{ dim: true }}>zip code</Text>
              <Input
                value={zip}
                onChange={setZip}
                onBeforeChange={masks.zip}
                placeholder="_____"
                style={{ bg: "blackBright", paddingX: 1 }}
                focusedStyle={{ bg: "white", color: "black" }}
              />
            </Box>
            <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
              <Text style={{ dim: true }}>license plate (aaa-9999)</Text>
              <Input
                value={plate}
                onChange={setPlate}
                onBeforeChange={licensePlate}
                placeholder="___-____"
                style={{ bg: "blackBright", paddingX: 1 }}
                focusedStyle={{ bg: "white", color: "black" }}
              />
            </Box>
          </Box>

          <Box style={{ flexDirection: "row", gap: 2 }}>
            <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
              <Text style={{ dim: true }}>product code (aa-999-**)</Text>
              <Input
                value={product}
                onChange={setProduct}
                onBeforeChange={productCode}
                placeholder="__-___-__"
                style={{ bg: "blackBright", paddingX: 1 }}
                focusedStyle={{ bg: "white", color: "black" }}
              />
            </Box>
            <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
              <Text style={{ dim: true }}>hex color (#******)</Text>
              <Input
                value={color}
                onChange={setColor}
                onBeforeChange={hexColor}
                placeholder="#______"
                style={{ bg: "blackBright", paddingX: 1 }}
                focusedStyle={{ bg: "white", color: "black" }}
              />
            </Box>
          </Box>

          <Box style={{ height: 1 }} />

          {/* Preview Section */}
          <Text style={{ bold: true, color: "yellowBright" }}>
            Entered Values
          </Text>
          
          <Box style={{ flexDirection: "column", bg: "blackBright", padding: 1 }}>
            <Text>
              <Text style={{ dim: true }}>Phone: </Text>
              <Text style={{ color: "green" }}>{phone || "—"}</Text>
              <Text style={{ dim: true }}>  SSN: </Text>
              <Text style={{ color: "green" }}>{ssn || "—"}</Text>
            </Text>
            <Text>
              <Text style={{ dim: true }}>Card: </Text>
              <Text style={{ color: "green" }}>{creditCard || "—"}</Text>
              <Text style={{ dim: true }}>  Exp: </Text>
              <Text style={{ color: "green" }}>{expiry || "—"}</Text>
              <Text style={{ dim: true }}>  CVV: </Text>
              <Text style={{ color: "green" }}>{cvv || "—"}</Text>
            </Text>
            <Text>
              <Text style={{ dim: true }}>Date: </Text>
              <Text style={{ color: "green" }}>{date || "—"}</Text>
              <Text style={{ dim: true }}>  Time: </Text>
              <Text style={{ color: "green" }}>{time || "—"}</Text>
            </Text>
            <Text>
              <Text style={{ dim: true }}>IP: </Text>
              <Text style={{ color: "green" }}>{ip || "—"}</Text>
              <Text style={{ dim: true }}>  MAC: </Text>
              <Text style={{ color: "green" }}>{mac || "—"}</Text>
            </Text>
            <Text>
              <Text style={{ dim: true }}>ZIP: </Text>
              <Text style={{ color: "green" }}>{zip || "—"}</Text>
              <Text style={{ dim: true }}>  Plate: </Text>
              <Text style={{ color: "green" }}>{plate || "—"}</Text>
              <Text style={{ dim: true }}>  Product: </Text>
              <Text style={{ color: "green" }}>{product || "—"}</Text>
              <Text style={{ dim: true }}>  Color: </Text>
              <Text style={{ color: "green" }}>{color || "—"}</Text>
            </Text>
          </Box>
        </Box>
      </ScrollView>

      {/* Footer */}
      <Box style={{ height: 1 }} />
      <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ dim: true }}>
          Mask patterns: 9=digit  a=letter  *=alphanumeric
        </Text>
        <Text style={{ dim: true }}>Press q to quit</Text>
      </Box>

      <Keybind keypress="q" onPress={() => exit()} />
    </Box>
  );
}

render(<App />);
