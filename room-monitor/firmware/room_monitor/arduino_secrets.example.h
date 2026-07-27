#pragma once

// 집이나 학교의 2.4GHz Wi-Fi 정보를 입력합니다.
#define WIFI_SSID "YOUR_WIFI_NAME"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Oracle 서버에 연결한 도메인을 입력합니다.
// 도메인과 HTTPS 적용 전, 같은 Wi-Fi의 PC에서 시험할 때는
// PC의 IPv4 주소와 포트 8000을 사용하고 SERVER_USE_TLS를 0으로 둡니다.
#define SERVER_HOST "sensor.example.com"
#define SERVER_PORT 443
#define SERVER_USE_TLS 1

// 서버의 .env 파일에 넣은 API_KEY와 정확히 같아야 합니다.
#define DEVICE_API_KEY "replace-with-the-same-api-key-as-server"

// 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.
#define DEVICE_ID "room-uno-r4"

// PIR 센서까지 연결한 뒤 1로 바꾸세요. 처음에는 0으로 둡니다.
#define ENABLE_PIR 0

