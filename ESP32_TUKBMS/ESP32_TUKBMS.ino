/*
 * ============================================================
 *  TUKBMS — TukTuk Battery Management System
 *  ESP32 Firmware · Arduino IDE
 * ============================================================
 *
 *  HARDWARE CONNECTIONS (4S Li-ion pack)
 *  ─────────────────────────────────────
 *  Sensor                   ESP32 Pin    Notes
 *  ─────────────────────────────────────────────────────────
 *  Cell 1 voltage divider   GPIO34 (A6)  3.3V max — use divider!
 *  Cell 2 voltage divider   GPIO35 (A7)
 *  Cell 3 voltage divider   GPIO32 (A4)
 *  Cell 4 voltage divider   GPIO33 (A5)
 *  ACS712 current sensor    GPIO36 (A0)  Hall-effect, analog
 *  DS18B20 temperature      GPIO4        OneWire, needs 4.7kΩ pullup
 *  GY-NEO6MV2 GPS (RX)      GPIO16
 *  GY-NEO6MV2 GPS (TX)      GPIO17
 *  BH1750 solar irradiance  SDA=GPIO21   I2C
 *                           SCL=GPIO22
 *
 *  REQUIRED LIBRARIES (install via Arduino Library Manager)
 *  ─────────────────────────────────────────────────────────
 *  - WiFi             (built-in ESP32)
 *  - HTTPClient       (built-in ESP32)
 *  - ArduinoJson      by Benoit Blanchon   → search "ArduinoJson"
 *  - OneWire          by Paul Stoffregen   → search "OneWire"
 *  - DallasTemperature by Miles Burton     → search "DallasTemperature"
 *  - BH1750           by Christopher Laws → search "BH1750"
 *  - TinyGPSPlus      by Mikal Hart        → search "TinyGPSPlus"
 *
 *  BOARD SETTINGS (Arduino IDE → Tools)
 *  ─────────────────────────────────────
 *  Board:      ESP32 Dev Module
 *  Upload Speed: 115200
 *  CPU Freq:   240MHz
 *  Flash Size: 4MB
 * ============================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <BH1750.h>
#include <Wire.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>

// ── CONFIGURATION — edit these ─────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";          // Your WiFi network name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";       // Your WiFi password

// Supabase edge function URL — your project
const char* SERVER_URL = "https://atffjlrwxgoblnaxftlm.supabase.co/functions/v1/make-server-ad1287b9/ingest";
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0ZmZqbHJ3eGdvYmxuYXhmdGxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTY5NjYsImV4cCI6MjEwMTY5Mjk2Nn0.kr9KB5p7ZQK-3EiSKOd8Ii-3MBnLaB9hm4JpzhWUOE8";
const char* ESP32_API_KEY = "TUKBMS-ESP32-2024";       // Must match server

// Your vehicle ID (registered in the web app)
const char* VEHICLE_ID = "TUK-GP-2847";                // Change to your vehicle ID (province-coded, e.g. GP = Gauteng)

// Data interval: 2.5 minutes = 150,000 ms
const unsigned long SEND_INTERVAL_MS = 150000UL;

// ── PIN DEFINITIONS ─────────────────────────────────────────────────────────
#define PIN_CELL1   34    // ADC — cell 1 voltage (via divider)
#define PIN_CELL2   35    // ADC — cell 2 voltage (via divider)
#define PIN_CELL3   32    // ADC — cell 3 voltage (via divider)
#define PIN_CELL4   33    // ADC — cell 4 voltage (via divider)
#define PIN_CURRENT 36    // ADC — ACS712 current sensor
#define PIN_TEMP     4    // OneWire — DS18B20 temperature
#define GPS_RX_PIN  16    // UART2 RX ← GPS TX
#define GPS_TX_PIN  17    // UART2 TX → GPS RX (unused)

// ── VOLTAGE DIVIDER CALIBRATION ─────────────────────────────────────────────
// Each cell tap goes through a resistor divider to stay within 0–3.3V ADC range.
// Example: For max 4.2V cell, use R1=10kΩ, R2=15kΩ → V_out = V_in × 15/(10+15) = V_in × 0.6
// Measure your actual resistors and adjust DIVIDER_RATIO
// Cumulative taps: C1=cell1, C2=cell1+cell2, C3=cell1+2+3, C4=full pack
const float DIVIDER_RATIO_1 = 0.600;   // ratio for cell1 tap
const float DIVIDER_RATIO_2 = 0.300;   // ratio for cell1+2 tap
const float DIVIDER_RATIO_3 = 0.200;   // ratio for cell1+2+3 tap
const float DIVIDER_RATIO_4 = 0.150;   // ratio for full pack tap

// ADC calibration (ESP32 ADC is non-linear; use measured offset/scale if needed)
const float ADC_REF_VOLTAGE = 3.3;
const float ADC_RESOLUTION  = 4095.0;

// ── ACS712 CURRENT SENSOR ───────────────────────────────────────────────────
// ACS712-20A: sensitivity = 100mV/A, zero-current output = VCC/2 = 1.65V
// ACS712-30A: sensitivity = 66mV/A
const float ACS712_SENSITIVITY = 0.100;  // V/A  (use 0.100 for 20A, 0.066 for 30A)
const float ACS712_ZERO_VOLTAGE = 1.65;  // V at 0A (calibrate by measuring with no current)

// ── SOC LOOKUP TABLE (NMC Li-ion, per cell) ─────────────────────────────────
// Maps cell voltage to approximate SOC%
const float SOC_VOLTAGE[] = {3.00, 3.40, 3.55, 3.65, 3.70, 3.75, 3.80, 3.87, 3.95, 4.05, 4.20};
const float SOC_PERCENT[] = {  0,   10,   20,   30,   40,   50,   60,   70,   80,   90,  100};
const int   SOC_TABLE_LEN = 11;

// ── OBJECTS ─────────────────────────────────────────────────────────────────
OneWire           oneWire(PIN_TEMP);
DallasTemperature tempSensor(&oneWire);
BH1750            lightMeter;
TinyGPSPlus       gps;
HardwareSerial    gpsSerial(2);   // UART2

// ── STATE ───────────────────────────────────────────────────────────────────
unsigned long lastSendTime = 0;
float   cell1V, cell2V, cell3V, cell4V;
float   currentA;
float   packVoltage;
float   temperatureC;
float   solarRadiation;
float   latitude, longitude, speedKmh;
bool    gpsFixed = false;

// Accumulated SOC (coulomb counting, seeded from voltage lookup)
float   packSOC = 75.0;
float   cell1SOC, cell2SOC, cell3SOC, cell4SOC;

// SOH — placeholder; update based on capacity fade tracking
float   cell1SOH = 97.0, cell2SOH = 95.0, cell3SOH = 98.0, cell4SOH = 96.0;

// ── SETUP ───────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== TUKBMS ESP32 Starting ===");

  // I2C for BH1750
  Wire.begin(21, 22);
  lightMeter.begin();
  Serial.println("[OK] BH1750 light sensor ready");

  // DS18B20
  tempSensor.begin();
  Serial.println("[OK] DS18B20 temperature sensor ready");

  // GPS UART
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("[OK] GPS serial started");

  // WiFi
  connectWiFi();

  // ADC attenuation (allows reading up to ~3.3V)
  analogSetAttenuation(ADC_11db);

  // Read initial cell voltages to seed SOC
  readCellVoltages();
  packSOC = voltageToSOC((cell1V + cell2V + cell3V + cell4V) / 4.0);
  cell1SOC = voltageToSOC(cell1V);
  cell2SOC = voltageToSOC(cell2V);
  cell3SOC = voltageToSOC(cell3V);
  cell4SOC = voltageToSOC(cell4V);

  Serial.println("[OK] Initial SOC seeded from voltage curve");
  Serial.printf("[OK] Pack SOC = %.1f%%  Pack Voltage = %.2fV\n", packSOC, cell1V+cell2V+cell3V+cell4V);
}

// ── MAIN LOOP ────────────────────────────────────────────────────────────────
void loop() {
  // Read GPS continuously (non-blocking)
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  unsigned long now = millis();

  // Send every 2.5 minutes
  if (now - lastSendTime >= SEND_INTERVAL_MS || lastSendTime == 0) {
    lastSendTime = now;
    readAllSensors();
    printSensorReadings();
    sendToSupabase();
  }

  delay(100);  // Small delay to prevent watchdog issues
}

// ── SENSOR READING ───────────────────────────────────────────────────────────

void readAllSensors() {
  readCellVoltages();
  readCurrent();
  readTemperature();
  readSolar();
  readGPS();
  updateSOC();
}

void readCellVoltages() {
  // Read cumulative taps and subtract to get individual cell voltages
  // IMPORTANT: Taps are measured from battery negative to each cell junction
  int rawTap1 = analogRead(PIN_CELL1);
  int rawTap2 = analogRead(PIN_CELL2);
  int rawTap3 = analogRead(PIN_CELL3);
  int rawTap4 = analogRead(PIN_CELL4);

  float vTap1 = (rawTap1 / ADC_RESOLUTION) * ADC_REF_VOLTAGE / DIVIDER_RATIO_1;
  float vTap2 = (rawTap2 / ADC_RESOLUTION) * ADC_REF_VOLTAGE / DIVIDER_RATIO_2;
  float vTap3 = (rawTap3 / ADC_RESOLUTION) * ADC_REF_VOLTAGE / DIVIDER_RATIO_3;
  float vTap4 = (rawTap4 / ADC_RESOLUTION) * ADC_REF_VOLTAGE / DIVIDER_RATIO_4;

  // Individual cell voltages from cumulative taps
  cell1V = constrain(vTap1, 2.8, 4.25);
  cell2V = constrain(vTap2 - vTap1, 2.8, 4.25);
  cell3V = constrain(vTap3 - vTap2, 2.8, 4.25);
  cell4V = constrain(vTap4 - vTap3, 2.8, 4.25);

  packVoltage = cell1V + cell2V + cell3V + cell4V;
}

void readCurrent() {
  // ACS712: multiple samples for noise reduction
  long sum = 0;
  for (int i = 0; i < 64; i++) {
    sum += analogRead(PIN_CURRENT);
    delayMicroseconds(100);
  }
  float avgRaw = sum / 64.0;
  float sensorVoltage = (avgRaw / ADC_RESOLUTION) * ADC_REF_VOLTAGE;

  // Positive current = discharge, negative = charge
  currentA = (sensorVoltage - ACS712_ZERO_VOLTAGE) / ACS712_SENSITIVITY;

  // Clamp to reasonable range (±50A)
  currentA = constrain(currentA, -50.0, 50.0);
}

void readTemperature() {
  tempSensor.requestTemperatures();
  float t = tempSensor.getTempCByIndex(0);
  if (t != DEVICE_DISCONNECTED_C) {
    temperatureC = t;
  } else {
    Serial.println("[WARN] DS18B20 disconnected, using last reading");
  }
}

void readSolar() {
  // BH1750 returns lux; convert to W/m² (approx: 1 W/m² ≈ 120 lux for sunlight)
  float lux = lightMeter.readLightLevel();
  solarRadiation = lux / 120.0;  // W/m²
  solarRadiation = constrain(solarRadiation, 0, 1500);
}

void readGPS() {
  if (gps.location.isValid() && gps.location.age() < 5000) {
    latitude  = gps.location.lat();
    longitude = gps.location.lng();
    speedKmh  = gps.speed.kmph();
    gpsFixed  = true;
  } else {
    gpsFixed  = false;
    speedKmh  = 0.0;
    Serial.println("[WARN] GPS no fix yet");
  }
}

void updateSOC() {
  // Simple SOC integration from voltage (more accurate with coulomb counting)
  // For production: integrate current over time using:
  //   dSOC = -(current * deltaTime) / batteryCapacity_Ah * 100
  // For now: seed from voltage curve each reading
  cell1SOC = voltageToSOC(cell1V);
  cell2SOC = voltageToSOC(cell2V);
  cell3SOC = voltageToSOC(cell3V);
  cell4SOC = voltageToSOC(cell4V);

  // Pack SOC = average of cell SOCs
  packSOC = (cell1SOC + cell2SOC + cell3SOC + cell4SOC) / 4.0;
}

// ── SOC LOOKUP ────────────────────────────────────────────────────────────────

float voltageToSOC(float voltage) {
  if (voltage <= SOC_VOLTAGE[0]) return 0.0;
  if (voltage >= SOC_VOLTAGE[SOC_TABLE_LEN - 1]) return 100.0;

  for (int i = 0; i < SOC_TABLE_LEN - 1; i++) {
    if (voltage >= SOC_VOLTAGE[i] && voltage <= SOC_VOLTAGE[i + 1]) {
      float t = (voltage - SOC_VOLTAGE[i]) / (SOC_VOLTAGE[i + 1] - SOC_VOLTAGE[i]);
      return SOC_PERCENT[i] + t * (SOC_PERCENT[i + 1] - SOC_PERCENT[i]);
    }
  }
  return 50.0;  // fallback
}

// ── WIFI ──────────────────────────────────────────────────────────────────────

void connectWiFi() {
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] FAILED — will retry on next send cycle");
  }
}

// ── SUPABASE UPLOAD ───────────────────────────────────────────────────────────

void sendToSupabase() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] WiFi not connected — reconnecting...");
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  // Build ISO8601 timestamp
  char timestamp[32];
  // Use GPS time if available, else use ESP32 uptime (for production use NTP)
  if (gps.date.isValid() && gps.time.isValid()) {
    snprintf(timestamp, sizeof(timestamp), "%04d-%02d-%02dT%02d:%02d:%02dZ",
      gps.date.year(), gps.date.month(), gps.date.day(),
      gps.time.hour(), gps.time.minute(), gps.time.second());
  } else {
    // Fallback: use millis (not real time — add NTP for production)
    snprintf(timestamp, sizeof(timestamp), "2024-09-01T%02lu:%02lu:%02luZ",
      (millis() / 3600000UL) % 24,
      (millis() / 60000UL) % 60,
      (millis() / 1000UL) % 60);
  }

  // Build JSON payload
  StaticJsonDocument<1024> doc;
  doc["vehicle_id"]          = VEHICLE_ID;
  doc["timestamp"]           = timestamp;
  doc["pack_voltage"]        = round(packVoltage * 1000) / 1000.0;
  doc["current_amps"]        = round(currentA * 100) / 100.0;
  doc["is_charging"]         = (currentA < -0.5);
  doc["pack_soc"]            = round(packSOC * 10) / 10.0;
  doc["pack_soh"]            = min(cell1SOH, min(cell2SOH, min(cell3SOH, cell4SOH)));
  doc["temperature_c"]       = round(temperatureC * 10) / 10.0;
  doc["solar_radiation_wm2"] = round(solarRadiation * 10) / 10.0;
  doc["latitude"]            = latitude;
  doc["longitude"]           = longitude;
  doc["speed_kmh"]           = round(speedKmh * 10) / 10.0;
  doc["cell1_voltage"]       = round(cell1V * 1000) / 1000.0;
  doc["cell2_voltage"]       = round(cell2V * 1000) / 1000.0;
  doc["cell3_voltage"]       = round(cell3V * 1000) / 1000.0;
  doc["cell4_voltage"]       = round(cell4V * 1000) / 1000.0;
  doc["cell1_soc"]           = round(cell1SOC * 10) / 10.0;
  doc["cell2_soc"]           = round(cell2SOC * 10) / 10.0;
  doc["cell3_soc"]           = round(cell3SOC * 10) / 10.0;
  doc["cell4_soc"]           = round(cell4SOC * 10) / 10.0;
  doc["cell1_soh"]           = cell1SOH;
  doc["cell2_soh"]           = cell2SOH;
  doc["cell3_soh"]           = cell3SOH;
  doc["cell4_soh"]           = cell4SOH;

  String payload;
  serializeJson(doc, payload);

  Serial.println("[HTTP] Sending data to Supabase...");
  Serial.println(payload);

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("x-api-key", ESP32_API_KEY);
  http.setTimeout(10000);  // 10s timeout

  int httpCode = http.POST(payload);

  if (httpCode == 200 || httpCode == 201) {
    String response = http.getString();
    Serial.printf("[HTTP] SUCCESS (%d): %s\n", httpCode, response.c_str());
  } else if (httpCode > 0) {
    Serial.printf("[HTTP] ERROR (%d): %s\n", httpCode, http.getString().c_str());
  } else {
    Serial.printf("[HTTP] CONNECTION FAILED: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

// ── DEBUG PRINT ───────────────────────────────────────────────────────────────

void printSensorReadings() {
  Serial.println("\n╔══════════════════════════════════════╗");
  Serial.println("║         TUKBMS SENSOR READINGS       ║");
  Serial.println("╠══════════════════════════════════════╣");
  Serial.printf( "║  Pack Voltage : %6.3f V              ║\n", packVoltage);
  Serial.printf( "║  Current      : %+6.2f A (%-8s)  ║\n", currentA, currentA < 0 ? "CHARGING" : "DISCHARGING");
  Serial.printf( "║  Pack SOC     : %5.1f %%              ║\n", packSOC);
  Serial.printf( "║  Temperature  : %5.1f °C              ║\n", temperatureC);
  Serial.printf( "║  Solar        : %6.1f W/m²            ║\n", solarRadiation);
  Serial.println("╠══════════════════════════════════════╣");
  Serial.printf( "║  Cell 1 : %5.3fV  SOC:%5.1f%%  SOH:%3.0f%% ║\n", cell1V, cell1SOC, cell1SOH);
  Serial.printf( "║  Cell 2 : %5.3fV  SOC:%5.1f%%  SOH:%3.0f%% ║\n", cell2V, cell2SOC, cell2SOH);
  Serial.printf( "║  Cell 3 : %5.3fV  SOC:%5.1f%%  SOH:%3.0f%% ║\n", cell3V, cell3SOC, cell3SOH);
  Serial.printf( "║  Cell 4 : %5.3fV  SOC:%5.1f%%  SOH:%3.0f%% ║\n", cell4V, cell4SOC, cell4SOH);
  Serial.println("╠══════════════════════════════════════╣");
  if (gpsFixed) {
    Serial.printf("║  GPS: %.5f, %.5f  %.1fkm/h  ║\n", latitude, longitude, speedKmh);
  } else {
    Serial.println("║  GPS: No fix yet...                  ║");
  }
  Serial.println("╚══════════════════════════════════════╝\n");
}
