# TUKBMS — Smart Battery Monitoring Dashboard (South Africa)

A live monitoring dashboard for solar-assisted e-tuktuk battery packs (4S NMC Li-ion), built with React + Vite + Tailwind, backed by Supabase, and fed live sensor data from an ESP32.

This README explains, in detail, how to go from **simulated demo data** to **real live data from a physical ESP32 device**.

---

## 1. How the system fits together

```
ESP32 + sensors  --HTTP POST (every 2.5 min)-->  Supabase Edge Function  -->  battery_readings table
   (firmware in                                    ("/ingest" route,               |
   ESP32_TUKBMS/)                                   checks x-api-key)               |
                                                                                     v
Web dashboard  <--polls every 5s / 30s--  Supabase Edge Function  <-- reads latest + history
(src/pages/Dashboard.tsx)                 ("/readings/latest",
                                            "/readings/history")
```

Until a real reading exists in `battery_readings` for a vehicle, the dashboard shows **DEMO MODE** with realistic simulated data (`src/hooks/useBatteryData.ts`). The moment the ESP32 successfully posts one reading for a matching Vehicle ID, the header badge flips to **ESP32 LIVE** and the chart switches from "SIMULATED" to "SUPABASE DB".

---

## 2. Hardware you need

| Component | Purpose | Notes |
|---|---|---|
| ESP32 Dev Module | Main controller | Any standard ESP32 dev board |
| 4× resistor voltage dividers | Read each of the 4 cell voltages | Sized so max cell voltage (4.2V) never exceeds 3.3V on the ADC pin |
| ACS712 current sensor (20A or 30A) | Pack current (charge/discharge) | Hall-effect, analog output |
| DS18B20 + 4.7kΩ pull-up resistor | Pack temperature | OneWire digital sensor |
| BH1750 | Solar irradiance (light → W/m²) | I2C sensor |
| GY-NEO6MV2 GPS module | Location + speed | UART, needs clear sky view for a fix |
| Breadboard / wiring / 3.3V-safe connections | — | Never feed raw cell voltage into the ESP32 without a divider |

### Pin map (already defined in the firmware)

| Sensor | ESP32 Pin |
|---|---|
| Cell 1 voltage divider | GPIO34 (A6) |
| Cell 2 voltage divider | GPIO35 (A7) |
| Cell 3 voltage divider | GPIO32 (A4) |
| Cell 4 voltage divider | GPIO33 (A5) |
| ACS712 current sensor | GPIO36 (A0) |
| DS18B20 temperature | GPIO4 |
| GPS RX (← GPS TX) | GPIO16 |
| GPS TX (→ GPS RX) | GPIO17 |
| BH1750 SDA | GPIO21 |
| BH1750 SCL | GPIO22 |

---

## 3. Software prerequisites

1. Install the [Arduino IDE](https://www.arduino.cc/en/software) (2.x recommended).
2. Add ESP32 board support: **File → Preferences → Additional Boards Manager URLs** → add
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`, then
   **Tools → Board → Boards Manager** → search "esp32" → install.
3. Install these libraries via **Sketch → Include Library → Manage Libraries**:
   - `ArduinoJson` (Benoit Blanchon)
   - `OneWire` (Paul Stoffregen)
   - `DallasTemperature` (Miles Burton)
   - `BH1750` (Christopher Laws)
   - `TinyGPSPlus` (Mikal Hart)
   - `WiFi` and `HTTPClient` are built into the ESP32 core — no install needed.

---

## 4. Register the vehicle in the web app FIRST

Before flashing the firmware, create the vehicle's account through the dashboard's **Sign Up** flow (driver name, age, city, Vehicle ID, password). This writes a row to the `drivers` table via the `/signup` edge function route.

**The Vehicle ID you choose here must exactly match `VEHICLE_ID` in the firmware** (the server upper-cases both sides, so case doesn't matter, but spelling and dashes do). Use the South African vehicle ID format, e.g. `TUK-JHB-2847` (city code + number — JHB, CPT, DBN, PTA, etc.).

---

## 5. Confirm your Supabase credentials

This project already ships wired to a live Supabase project — `utils/supabase/info.tsx` contains the `projectId` and public anon key, and `ESP32_TUKBMS/ESP32_TUKBMS.ino` already points `SERVER_URL` and `SUPABASE_ANON_KEY` at that same project. **You normally don't need to change these.**

Only change them if you fork this project onto your **own** Supabase project:
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → your project → **Settings → API**.
2. Copy the **Project URL** (`https://<ref>.supabase.co`) and **anon public key**.
3. Update `utils/supabase/info.tsx` (frontend) and `SERVER_URL` / `SUPABASE_ANON_KEY` in the `.ino` file (firmware) to match.
4. Deploy the edge function in `supabase/functions/server/index.tsx` to that project (`supabase functions deploy make-server-ad1287b9`).

---

## 6. Secure the ingest endpoint (API key)

The `/ingest` route checks a `x-api-key` header against the `ESP32_API_KEY` Supabase secret, falling back to the hardcoded default `"TUKBMS-ESP32-2024"` if the secret isn't set. For a real deployment you should:

1. In the Supabase dashboard, go to **Edge Functions → Secrets** and add `ESP32_API_KEY` with a private value of your choosing.
2. Update the matching `ESP32_API_KEY` constant near the top of `ESP32_TUKBMS.ino` to the same value.
3. Re-deploy the edge function so the new secret takes effect.

Skipping this step means anyone who has your anon key could post fake battery readings under any vehicle ID.

---

## 7. Edit the firmware configuration block

Open `ESP32_TUKBMS/ESP32_TUKBMS.ino` in the Arduino IDE and edit the **CONFIGURATION** section near the top:

```cpp
const char* WIFI_SSID     = "YOUR_WIFI_SSID";        // your 2.4GHz WiFi name — ESP32 does not support 5GHz
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* VEHICLE_ID    = "TUK-JHB-2847";           // MUST match the Vehicle ID used at sign-up
```

### Calibrate the voltage dividers

Each cell tap is read cumulatively (tap 4 = full pack voltage), then the firmware subtracts consecutive taps to get individual cell voltages. Measure your actual divider resistors with a multimeter and set the ratios accordingly:

```cpp
const float DIVIDER_RATIO_1 = 0.600;   // cell1 tap:      V_out / V_in = R2 / (R1 + R2)
const float DIVIDER_RATIO_2 = 0.300;   // cell1+2 tap
const float DIVIDER_RATIO_3 = 0.200;   // cell1+2+3 tap
const float DIVIDER_RATIO_4 = 0.150;   // full pack tap
```

Example: for a max 4.2V cell using R1=10kΩ (top) and R2=15kΩ (bottom), ratio = 15/(10+15) = 0.6.

### Calibrate the current sensor

```cpp
const float ACS712_SENSITIVITY = 0.100;  // 0.100 V/A for the 20A module, 0.066 for the 30A module
const float ACS712_ZERO_VOLTAGE = 1.65;  // measure this with ZERO current flowing through the sensor
```

To calibrate `ACS712_ZERO_VOLTAGE`: with the pack disconnected from any load and no current flowing, read the raw ADC voltage on `PIN_CURRENT` and use that value.

---

## 8. Flash the firmware

1. Connect the ESP32 to your computer via USB.
2. **Tools** menu in Arduino IDE:
   - Board: **ESP32 Dev Module**
   - Upload Speed: **115200**
   - CPU Frequency: **240MHz**
   - Flash Size: **4MB**
   - Port: select the COM port your ESP32 shows up as
3. Click **Upload**. Hold the **BOOT** button on the board if it doesn't enter flashing mode automatically.

---

## 9. Verify over Serial Monitor

Open **Tools → Serial Monitor** at **115200 baud**. On boot you should see:

```
=== TUKBMS ESP32 Starting ===
[OK] BH1750 light sensor ready
[OK] DS18B20 temperature sensor ready
[OK] GPS serial started
[WiFi] Connecting to <your SSID>....
[WiFi] Connected! IP: 192.168.x.x
[OK] Initial SOC seeded from voltage curve
```

Every 2.5 minutes it prints a sensor readings table, then:

```
[HTTP] Sending data to Supabase...
[HTTP] SUCCESS (200): {"success":true,"recorded_at":"..."}
```

If you see `[HTTP] ERROR (401)`, the `x-api-key` doesn't match the server's `ESP32_API_KEY` — see step 6. If you see `[WARN] GPS no fix yet`, give the GPS module a clear view of the sky; first fix can take a few minutes outdoors.

---

## 10. Verify in the dashboard

1. Log in with the same Vehicle ID you registered in step 4.
2. Within ~5 seconds of the ESP32's first successful post, the header badge changes from **DEMO MODE** to **ESP32 LIVE**, and the historical chart label switches from "SIMULATED" to "SUPABASE DB".
3. All widgets (SOC, pack voltage, current, temperature, solar, GPS location) now reflect real sensor readings.

---

## 11. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `401 Unauthorized` in Serial Monitor | `ESP32_API_KEY` in firmware doesn't match the server secret |
| Dashboard stays in DEMO MODE forever | Vehicle ID mismatch between sign-up and firmware, or WiFi never connected |
| WiFi never connects | ESP32 only supports 2.4GHz networks, not 5GHz |
| Cell voltages look wrong / negative | Voltage divider ratios not calibrated to your actual resistors |
| Current always reads ~0A | `ACS712_ZERO_VOLTAGE` not calibrated with zero current flowing |
| GPS shows "No fix yet" | Needs an unobstructed sky view; first fix can take several minutes |
| `500` error on ingest | Check the Supabase `battery_readings` table exists (hit `/health` once to bootstrap schema) |

---

## 12. Data interval

The firmware sends one reading every **2.5 minutes** (`SEND_INTERVAL_MS = 150000`), matching the dashboard's chart cadence and the "~576 rows/day" note in the CSV export dialog. You can shorten this for testing, but the dashboard's chart labels and CSV export copy assume the 2.5-minute cadence.

---

## About

TUKBMS is a battery monitoring system for solar-assisted e-tuktuks operating in South Africa (Johannesburg, Cape Town, Durban, Pretoria, and other cities). Built with React 19, Vite, Tailwind CSS v4, Supabase, and ESP32.
