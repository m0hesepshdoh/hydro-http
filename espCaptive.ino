#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFiManager.h>
#include <Preferences.h> 

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
int r1 = 0, r2 = 0, r3 = 0, r4 = 0;
int Relay_1 = 26;
int Relay_2 = 25;
int Relay_3 = 33;
int Relay_4 = 32;

// ===============================
// Cloudflare Config & Storage
// ===============================
Preferences preferences;
char worker_url[150] = "https://hydro-worker.ug671431015.workers.dev/api/telemetry";

// ===============================
// Setup
// ===============================
void setup()
{
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
  digitalWrite(Relay_1, HIGH);
  digitalWrite(Relay_2, HIGH);
  digitalWrite(Relay_3, HIGH);
  digitalWrite(Relay_4, HIGH);

  // Load Saved Worker URL
  preferences.begin("hydro", false);
  String savedUrl = preferences.getString("url", worker_url);
  strncpy(worker_url, savedUrl.c_str(), sizeof(worker_url));

  // Initialize WiFiManager Captive Portal
  WiFiManager wm;

  // --- ADD THIS BLOCK FOR CUSTOM UI ---
  const char *customUI = "<style>"
                         "body { background-color: #f1f8e9; font-family: 'Segoe UI', Tahoma, sans-serif; color: #333; }"
                         "button { background-color: #2e7d32; color: white; border-radius: 25px; border: none; padding: 12px; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: 0.3s; }"
                         "button:hover { background-color: #1b5e20; }"
                         "input { border-radius: 8px; border: 1px solid #ccc; padding: 10px; width: 95%; box-sizing: border-box; }"
                         ".wrap { background: white; padding: 20px; border-radius: 15px; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }"
                         "</style>";
  wm.setCustomHeadElement(customUI);
  // ------------------------------------

  // Create a custom field for the Worker URL in the captive portal
  WiFiManagerParameter custom_worker_url("workerUrl", "Worker URL", worker_url, 150);
  wm.addParameter(&custom_worker_url);

  Serial.println("Connecting to WiFi or opening Portal...");
  // Connects to saved WiFi OR opens an AP named "HydroponicESP_Setup"
  if (!wm.autoConnect("HydroponicESP_Setup"))
  {
    Serial.println("Failed to connect. Restarting...");
    ESP.restart();
  }

  // Save the URL if it was changed in the portal
  if (String(worker_url) != String(custom_worker_url.getValue()))
  {
    strncpy(worker_url, custom_worker_url.getValue(), sizeof(worker_url));
    preferences.putString("url", worker_url);
  }

  Serial.println();
  Serial.println("WiFi connected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.print("Using Worker URL: ");
  Serial.println(worker_url);
  Serial.println("Sensors initialized successfully!\n");
}

// ===============================
// Loop
// ===============================
void loop()
{
  float humidity = dht.readHumidity();
  float airTemp = dht.readTemperature();

  Serial.println("--------------------------------");

  if (isnan(humidity) || isnan(airTemp))
  {
    Serial.println("DHT11: Failed to read!");
    humidity = 0.0;
    airTemp = 0.0;
  }
  else
  {
    Serial.printf("DHT11 Temperature : %.2f C\n", airTemp);
    Serial.printf("DHT11 Humidity    : %.2f %%\n", humidity);
  }

  waterTempSensor.requestTemperatures();
  float waterTemp = waterTempSensor.getTempCByIndex(0);
  if (waterTemp == DEVICE_DISCONNECTED_C)
  {
    Serial.println("DS18B20: Failed to read!");
    waterTemp = 0.0;
  }
  else
  {
    Serial.printf("Water Temperature : %.2f C\n", waterTemp);
  }

  int soilADC = analogRead(SOIL_PIN);
  float soilMoisture = 100.0 - ((soilADC / 4095.0) * 100.0);
  Serial.printf("Soil ADC          : %d\nSoil Moisture     : %.1f %%\n", soilADC, soilMoisture);

  long sum = 0;
  for (int i = 0; i < 30; i++)
  {
    sum += analogRead(TDS_PIN);
    delay(5);
  }
  float tdsADC = sum / 30.0;
  float voltage = tdsADC * (3.3 / 4095.0);
  float compensationCoefficient = 1.0 + 0.02 * (tdsTemperature - 25.0);
  float compensationVoltage = voltage / compensationCoefficient;
  float tdsValue = (133.42 * pow(compensationVoltage, 3) - 255.86 * pow(compensationVoltage, 2) + 857.39 * compensationVoltage) * 0.5;

  Serial.printf("TDS ADC           : %.1f\nTDS Voltage       : %.3f V\nTDS               : %.0f ppm\n", tdsADC, voltage, tdsValue);

  uint32_t pulse = pulseIn(FLOW_PIN, HIGH, 1000000);
  float flowRate = 0;
  if (pulse > 0)
  {
    flowRate = (7.2725 * (1.0 / (2.0 * pulse * 0.000001)) + 3.2094) / 60.0;
  }
  Serial.printf("Water Flow        : %.2f L/min\n", flowRate);

  // HTTP POST to Cloudflare Worker
  if (WiFi.status() == WL_CONNECTED)
  {
    HTTPClient http;
    http.begin(worker_url); // Uses the dynamically saved URL
    http.addHeader("Content-Type", "application/json");

    String payload = "{\"airTemp\":" + String(airTemp, 1) +
                     ",\"humidity\":" + String(humidity, 1) +
                     ",\"waterTemp\":" + String(waterTemp, 1) +
                     ",\"soilMoisture\":" + String(soilMoisture, 1) +
                     ",\"tds\":" + String(tdsValue, 0) +
                     ",\"flowRate\":" + String(flowRate, 2) + "}";

    Serial.println("Posting Payload   : " + payload);

    int httpResponseCode = http.POST(payload);
    if (httpResponseCode == 200)
    {
      String response = http.getString();
      Serial.println("Worker Response   : " + response);

      StaticJsonDocument<128> doc;
      if (!deserializeJson(doc, response))
      {
        r1 = doc["r1"];
        r2 = doc["r2"];
        r3 = doc["r3"];
        r4 = doc["r4"];
        digitalWrite(Relay_1, r1 == 1 ? LOW : HIGH);
        digitalWrite(Relay_2, r2 == 1 ? LOW : HIGH);
        digitalWrite(Relay_3, r3 == 1 ? LOW : HIGH);
        digitalWrite(Relay_4, r4 == 1 ? LOW : HIGH);
        Serial.printf("Relays Set -> R1: %d | R2: %d | R3: %d | R4: %d\n", r1, r2, r3, r4);
      }
      else
      {
        Serial.println("JSON Parsing Failed.");
      }
    }
    else
    {
      Serial.printf("HTTP Error Code   : %d\n", httpResponseCode);
    }
    http.end();
  }
  else
  {
    Serial.println("WiFi Disconnected! Reconnecting...");
  }
  Serial.println("--------------------------------");
  delay(2000);
}