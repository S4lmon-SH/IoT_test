#include <DHT.h>
#include <WiFiS3.h>

#include "arduino_secrets.h"

constexpr uint8_t DHT_PIN = 2;
constexpr uint8_t PIR_PIN = 3;
constexpr uint8_t DHT_TYPE = DHT11;
constexpr unsigned long UPLOAD_INTERVAL_MS = 60000UL;
constexpr unsigned long WIFI_RETRY_INTERVAL_MS = 10000UL;
constexpr unsigned long RESPONSE_TIMEOUT_MS = 8000UL;

DHT dht(DHT_PIN, DHT_TYPE);

#if SERVER_USE_TLS
WiFiSSLClient serverClient;
#else
WiFiClient serverClient;
#endif

unsigned long lastUploadAt = 0;
unsigned long lastWifiAttemptAt = 0;
bool motionSeenSinceUpload = false;

void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  const unsigned long now = millis();
  if (now - lastWifiAttemptAt < WIFI_RETRY_INTERVAL_MS &&
      lastWifiAttemptAt != 0) {
    return;
  }

  lastWifiAttemptAt = now;
  Serial.print("Wi-Fi connection attempt: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void printNetworkStatus() {
  Serial.print("Wi-Fi connected, IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Wi-Fi firmware: ");
  Serial.println(WiFi.firmwareVersion());
  Serial.print("Signal strength: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
}

int readHttpStatusCode() {
  const unsigned long waitStartedAt = millis();
  while (!serverClient.available() &&
         millis() - waitStartedAt < RESPONSE_TIMEOUT_MS) {
    delay(10);
  }

  if (!serverClient.available()) {
    return 0;
  }

  const String statusLine = serverClient.readStringUntil('\n');
  const int firstSpace = statusLine.indexOf(' ');
  if (firstSpace < 0 ||
      static_cast<int>(statusLine.length()) < firstSpace + 4) {
    return 0;
  }
  return statusLine.substring(firstSpace + 1, firstSpace + 4).toInt();
}

bool uploadReading(float temperature, float humidity, bool motion) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Upload postponed: Wi-Fi is not connected.");
    return false;
  }

  char payload[180];
  const int payloadLength = snprintf(
      payload,
      sizeof(payload),
      "{\"device_id\":\"%s\",\"temperature\":%.1f,"
      "\"humidity\":%.1f,\"motion\":%s}",
      DEVICE_ID,
      temperature,
      humidity,
      motion ? "true" : "false");

  if (payloadLength <= 0 || payloadLength >= static_cast<int>(sizeof(payload))) {
    Serial.println("Upload failed: JSON payload is too long.");
    return false;
  }

  Serial.print("Server connection: ");
  Serial.print(SERVER_HOST);
  Serial.print(":");
  Serial.println(SERVER_PORT);

  if (!serverClient.connect(SERVER_HOST, SERVER_PORT)) {
    Serial.println("Upload failed: cannot connect to the server.");
    serverClient.stop();
    return false;
  }

  serverClient.println("POST /api/v1/readings HTTP/1.1");
  serverClient.print("Host: ");
  serverClient.println(SERVER_HOST);
  serverClient.println("User-Agent: UNO-R4-Room-Monitor/1.0");
  serverClient.println("Content-Type: application/json");
  serverClient.println("Accept: application/json");
  serverClient.print("X-API-Key: ");
  serverClient.println(DEVICE_API_KEY);
  serverClient.print("Content-Length: ");
  serverClient.println(payloadLength);
  serverClient.println("Connection: close");
  serverClient.println();
  serverClient.print(payload);

  const int statusCode = readHttpStatusCode();
  while (serverClient.available()) {
    serverClient.read();
  }
  serverClient.stop();

  Serial.print("Server response: HTTP ");
  Serial.println(statusCode);
  return statusCode == 201;
}

void setup() {
  Serial.begin(115200);
  const unsigned long serialWaitStartedAt = millis();
  while (!Serial && millis() - serialWaitStartedAt < 3000UL) {
  }

  Serial.println();
  Serial.println("=== ROOM / 01 monitor starting ===");
  Serial.print("Wi-Fi firmware: ");
  Serial.println(WiFi.firmwareVersion());

  dht.begin();
#if ENABLE_PIR
  pinMode(PIR_PIN, INPUT);
  Serial.println("PIR motion sensor: enabled");
#else
  Serial.println("PIR motion sensor: disabled");
#endif

  connectToWiFi();
  delay(2000);
  lastUploadAt = millis() - UPLOAD_INTERVAL_MS;
}

void loop() {
  static int previousWifiStatus = WL_IDLE_STATUS;
  const int currentWifiStatus = WiFi.status();
  if (currentWifiStatus != previousWifiStatus) {
    if (currentWifiStatus == WL_CONNECTED) {
      printNetworkStatus();
    }
    previousWifiStatus = currentWifiStatus;
  }

  connectToWiFi();

#if ENABLE_PIR
  if (digitalRead(PIR_PIN) == HIGH) {
    motionSeenSinceUpload = true;
  }
#endif

  const unsigned long now = millis();
  if (now - lastUploadAt < UPLOAD_INTERVAL_MS) {
    delay(20);
    return;
  }
  lastUploadAt = now;

  const float humidity = dht.readHumidity();
  const float temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT11 read failed: check wiring and sensor type.");
    return;
  }

  Serial.print("Reading: ");
  Serial.print(temperature, 1);
  Serial.print(" C, ");
  Serial.print(humidity, 1);
  Serial.print(" %, motion: ");
  Serial.println(motionSeenSinceUpload ? "detected" : "none");

  if (uploadReading(temperature, humidity, motionSeenSinceUpload)) {
    motionSeenSinceUpload = false;
  }
}
