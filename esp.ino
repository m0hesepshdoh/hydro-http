#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ===============================
// DHT11 Pin Config
// ===============================
#define DHT_PIN 19
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);

// ===============================
// DS18B20 Pin Config
// ===============================
#define DS18B20_PIN 18

OneWire oneWire(DS18B20_PIN);
DallasTemperature waterTempSensor(&oneWire);

// ===============================
// Analog & Pulse Pins
// ===============================
#define SOIL_PIN 34
#define TDS_PIN 35
#define FLOW_PIN 5

float tdsTemperature = 25.0;

// ===============================
// Relay Config (Active-LOW)
// ===============================
int r1 = 0;
int r2 = 0;
int r3 = 0;
int r4 = 0;

int Relay_1 = 26;
int Relay_2 = 25;
int Relay_3 = 33;
int Relay_4 = 32;

// ===============================
// WiFi & Cloudflare Config
// ===============================
#define WiFiSSID "Arham1_2.4GHz" // Replace with your WiFi SSID
#define WiFiPASSWORD "0987654321" // Replace with your WiFi Password

// Replace with your Cloudflare Worker URL
const char* worker_url = "https://hydro-worker.ug671431015.workers.dev/api/telemetry";

// ===============================
// Setup
// ===============================
void setup() {
  Serial.begin(9600);
  delay(1000);

  Serial.println("================================");
  Serial.println("  HYDROPONIC SYSTEM (CLOUDFLARE)");
  Serial.println("================================");

  // Initialize Sensors
  dht.begin();
  waterTempSensor.begin();

  pinMode(SOIL_PIN, INPUT);
  pinMode(TDS_PIN, INPUT);
  pinMode(FLOW_PIN, INPUT);

  analogReadResolution(12);
  analogSetPinAttenuation(TDS_PIN, ADC_11db);

  // Initialize Relays
  pinMode(Relay_1, OUTPUT);
  pinMode(Relay_2, OUTPUT);
  pinMode(Relay_3, OUTPUT);
  pinMode(Relay_4, OUTPUT);

  // Start with Relays OFF (Active-LOW relays: HIGH = OFF, LOW = ON)
  digitalWrite(Relay_1, HIGH);
  digitalWrite(Relay_2, HIGH);
  digitalWrite(Relay_3, HIGH);
  digitalWrite(Relay_4, HIGH);

  // Connect WiFi
  Serial.println("Connecting to WiFi...");
  WiFi.begin(WiFiSSID, WiFiPASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());

  Serial.println("Sensors initialized successfully!");
  Serial.println();
}

// ===============================
// Loop
// ===============================
void loop() {
  // -------------------------------
  // 1. DHT11 Reading
  // -------------------------------
  float humidity = dht.readHumidity();
  float airTemp = dht.readTemperature();

  Serial.println("--------------------------------");

  if (isnan(humidity) || isnan(airTemp)) {
    Serial.println("DHT11: Failed to read!");
    humidity = 0.0;
    airTemp = 0.0;
  } else {
    Serial.print("DHT11 Temperature : ");
    Serial.print(airTemp);
    Serial.println(" C");

    Serial.print("DHT11 Humidity    : ");
    Serial.print(humidity);
    Serial.println(" %");
  }

  // -------------------------------
  // 2. DS18B20 Reading
  // -------------------------------
  waterTempSensor.requestTemperatures();
  float waterTemp = waterTempSensor.getTempCByIndex(0);

  if (waterTemp == DEVICE_DISCONNECTED_C) {
    Serial.println("DS18B20: Failed to read!");
    waterTemp = 0.0;
  } else {
    Serial.print("Water Temperature : ");
    Serial.print(waterTemp);
    Serial.println(" C");
  }

  // -------------------------------
  // 3. Soil Moisture Reading
  // -------------------------------
  int soilADC = analogRead(SOIL_PIN);
  float soilMoisture = 100.0 - ((soilADC / 4095.0) * 100.0);

  Serial.print("Soil ADC          : ");
  Serial.println(soilADC);
  Serial.print("Soil Moisture     : ");
  Serial.print(soilMoisture, 1);
  Serial.println(" %");

  // -------------------------------
  // 4. TDS Reading
  // -------------------------------
  long sum = 0;
  for (int i = 0; i < 30; i++) {
    sum += analogRead(TDS_PIN);
    delay(5);
  }

  float tdsADC = sum / 30.0;
  float voltage = tdsADC * (3.3 / 4095.0);
  float compensationCoefficient = 1.0 + 0.02 * (tdsTemperature - 25.0);
  float compensationVoltage = voltage / compensationCoefficient;
  float tdsValue = (133.42 * compensationVoltage * compensationVoltage * compensationVoltage
                   - 255.86 * compensationVoltage * compensationVoltage
                   + 857.39 * compensationVoltage) * 0.5;

  Serial.print("TDS ADC           : ");
  Serial.println(tdsADC, 1);
  Serial.print("TDS Voltage       : ");
  Serial.print(voltage, 3);
  Serial.println(" V");
  Serial.print("TDS               : ");
  Serial.print(tdsValue, 0);
  Serial.println(" ppm");

  // -------------------------------
  // 5. Water Flow Reading
  // -------------------------------
  uint32_t pulse = pulseIn(FLOW_PIN, HIGH, 1000000);
  float flowRate = 0;

  if (pulse > 0) {
    float frequency = 1.0 / (2.0 * pulse * 0.000001);
    float flow = 7.2725 * frequency + 3.2094;
    flowRate = flow / 60.0;
  }

  Serial.print("Water Flow        : ");
  Serial.print(flowRate, 2);
  Serial.println(" L/min");

  // -------------------------------
  // 6. HTTP POST to Cloudflare Worker
  // -------------------------------
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(worker_url);
    http.addHeader("Content-Type", "application/json");

    // Construct Payload
    String payload = "{";
    payload += "\"airTemp\":" + String(airTemp, 1) + ",";
    payload += "\"humidity\":" + String(humidity, 1) + ",";
    payload += "\"waterTemp\":" + String(waterTemp, 1) + ",";
    payload += "\"soilMoisture\":" + String(soilMoisture, 1) + ",";
    payload += "\"tds\":" + String(tdsValue, 0) + ",";
    payload += "\"flowRate\":" + String(flowRate, 2);
    payload += "}";

    Serial.print("Posting Payload   : ");
    Serial.println(payload);

    int httpResponseCode = http.POST(payload);

    if (httpResponseCode == 200) {
      String response = http.getString();
      Serial.print("Worker Response   : ");
      Serial.println(response);

      // Parse JSON Response containing targeted relay states
      StaticJsonDocument<128> doc;
      DeserializationError error = deserializeJson(doc, response);

      if (!error) {
        r1 = doc["r1"];
        r2 = doc["r2"];
        r3 = doc["r3"];
        r4 = doc["r4"];

        // Apply state changes to Active-LOW relay pins (1 = ON/LOW, 0 = OFF/HIGH)
        digitalWrite(Relay_1, r1 == 1 ? LOW : HIGH);
        digitalWrite(Relay_2, r2 == 1 ? LOW : HIGH);
        digitalWrite(Relay_3, r3 == 1 ? LOW : HIGH);
        digitalWrite(Relay_4, r4 == 1 ? LOW : HIGH);

        Serial.printf("Relays Set -> R1: %d | R2: %d | R3: %d | R4: %d\n", r1, r2, r3, r4);
      } else {
        Serial.print("JSON Parsing Failed: ");
        Serial.println(error.c_str());
      }
    } else {
      Serial.print("HTTP Error Code   : ");
      Serial.println(httpResponseCode);
    }

    http.end();
  } else {
    Serial.println("WiFi Disconnected! Reconnecting...");
    WiFi.reconnect();
  }

  Serial.println("--------------------------------");

  // Interval between updates (2 seconds)
  delay(2000);
}