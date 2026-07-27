# IoT_test

Arduino UNO R4 WiFi와 DHT11 센서로 실내 온도·습도를 1분마다 측정하고,
Oracle Cloud 서버의 SQLite 데이터베이스와 웹 대시보드에 기록하는
첫 Arduino 프로젝트입니다.

## 구성

- Arduino UNO R4 WiFi + DHT11 펌웨어
- HTTPS 측정값 전송
- FastAPI + SQLite 서버
- 온도·습도 1분 간격 그래프
- Caddy HTTPS 및 대시보드 로그인 보호
- Docker Compose 기반 Oracle Cloud 배포

## 시작하기

- [초보자용 시작 안내](room-monitor/시작하기.md)
- [프로젝트 전체 설명](room-monitor/README.md)
- [배선과 첫 업로드](room-monitor/docs/01_배선과_첫_업로드.md)
- [Oracle 서버 배포](room-monitor/docs/02_Oracle_서버_배포.md)
- [보유 부품과 프로젝트 아이디어](아두이노_부품목록과_프로젝트_아이디어.md)

## 비밀정보

실제 Wi-Fi 정보, 장치 API 키, 대시보드 비밀번호, 서버 `.env`,
인증서 개인키와 측정 데이터베이스는 저장소에 포함하지 않습니다.
설정할 때는 다음 예제 파일을 복사해 개인 값으로 채우세요.

- `room-monitor/.env.example`
- `room-monitor/firmware/room_monitor/arduino_secrets.example.h`
