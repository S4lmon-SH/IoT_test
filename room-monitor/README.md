# ROOM / 01 환경 모니터

Arduino UNO R4 WiFi와 DHT11로 온습도를 측정해 개인 Oracle 서버에 보관하고, 휴대폰용 웹 대시보드에서 그래프로 확인하는 프로젝트다.

## 현재 배포 주소

- 대시보드: <https://134-185-118-90.sslip.io/>
- 상태 확인: <https://134-185-118-90.sslip.io/health>
- 로그인 정보: `deploy/credentials.txt` 로컬 비밀 파일
- 서버 위치: `/home/ubuntu/room-monitor`

## 현재 구현된 기능

- 장치 API 키로 보호되는 온습도 수신 API
- SQLite 영구 저장
- 최신 측정값과 최근 24시간 통계
- 24시간·7일·30일 구간별 집계
- 모바일 반응형 대시보드
- 온도·습도 이중 그래프와 터치 툴팁
- 센서 온라인/오프라인 표시
- Docker Compose 배포
- 공인 IP용 Certbot 인증서, Caddy HTTPS와 대시보드 비밀번호 보호
- UNO R4 WiFi용 DHT11 펌웨어
- 선택형 PIR 움직임 기록
- 서버 API 자동 테스트

## 전체 구조

```text
DHT11 ──> UNO R4 WiFi
                 │
                 │ HTTPS POST /api/v1/readings
                 ▼
          Oracle 개인 서버
          ├─ FastAPI
          ├─ SQLite
          └─ 모바일 대시보드
```

Arduino는 60초마다 온습도를 전송한다. 측정 시각은 Oracle 서버가 UTC로 기록하고, 대시보드는 접속한 휴대폰의 현지 시각으로 표시한다.

## 폴더 구성

```text
room-monitor/
├─ firmware/room_monitor/  Arduino 펌웨어
├─ server/app/             API와 대시보드
├─ server/tests/           자동 테스트
├─ scripts/                Windows 실행 도구
├─ docs/                   배선과 Oracle 배포 설명
├─ data/                   SQLite 데이터
└─ docker-compose.yml
```

## 1. PC에서 대시보드 시험

PowerShell에서 `room-monitor` 폴더로 이동한 뒤 실행한다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup_windows.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\run_local.ps1
```

브라우저에서 <http://127.0.0.1:8000>을 연다.

다른 PowerShell 창에서 시험 측정값을 하나 보낸다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\send_test_reading.ps1
```

그래프 모양을 먼저 보고 싶으면 서버를 멈춘 상태에서 예제 데이터를 만든다.

```powershell
.\.venv\Scripts\python.exe .\scripts\seed_demo_data.py --reset
```

## 2. 자동 테스트

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run_tests.ps1
```

## 3. Arduino 도구 준비

이 프로젝트에는 Arduino CLI 자동 설치 스크립트가 포함되어 있다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup_arduino.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\compile_firmware.ps1
```

보드를 USB로 연결한 뒤 COM 포트를 확인한다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\list_arduino_boards.ps1
```

예를 들어 보드가 `COM5`라면 다음처럼 업로드하고 시리얼 출력을 본다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\upload_firmware.ps1 -Port COM5
powershell -ExecutionPolicy Bypass -File .\scripts\monitor_serial.ps1 -Port COM5
```

## 4. 센서 연결과 업로드

[DHT11 배선과 첫 업로드](docs/01_배선과_첫_업로드.md)를 순서대로 따른다.

Wi-Fi 정보는 화면에 비밀번호를 노출하지 않는 입력 스크립트로 저장할 수 있다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\set_wifi_credentials.ps1
```

처음에는 같은 Wi-Fi에 연결된 PC 서버로 시험할 수 있다. PowerShell에서 PC 주소를 확인한다.

```powershell
ipconfig
```

`arduino_secrets.h`에는 PC의 IPv4 주소를 사용한다.

```cpp
#define SERVER_HOST "192.168.0.10"
#define SERVER_PORT 8000
#define SERVER_USE_TLS 0
#define DEVICE_API_KEY "local-development-key"
```

Windows 방화벽이 8000 포트 연결을 물으면 개인 네트워크에만 허용한다. PC와 Arduino가 동일한 Wi-Fi에 있어야 한다.

## 5. Oracle 서버에 배포

[Oracle 서버 배포 설명](docs/02_Oracle_서버_배포.md)을 따른다.

## 주의사항

- DHT11은 저가형 센서라 그래프가 계단처럼 보이고 정밀도도 높지 않다.
- 이 장치는 미세먼지, CO₂ 또는 공기 오염도를 측정하지 않는다.
- `arduino_secrets.h`와 `.env`에는 비밀번호가 들어가므로 공유하지 않는다.
- Oracle 서버에서는 8000 포트를 공개하지 않고 HTTPS 포트 443만 사용한다.
- 실내 상태를 더 정확하게 측정하려면 나중에 SHT31 또는 BME280으로 교체할 수 있다.
