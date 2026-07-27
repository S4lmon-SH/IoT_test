# Oracle 서버 배포

이 문서는 Oracle Cloud의 Ubuntu 서버를 기준으로 한다. Oracle Linux 등 다른 운영체제라면 설치 명령이 달라질 수 있다.

## 배포 전에 필요한 정보

- 서버 공인 IP
- SSH 사용자 이름과 개인키
- 서버 운영체제
- 사용할 도메인 또는 서브도메인

도메인이 없어도 2026년부터 Let’s Encrypt의 단기 공인 IP 인증서를 사용할 수 있다. 인증서 유효기간은 약 6일이므로 이 프로젝트는 자동 갱신 스크립트를 사용한다.

## Oracle Cloud 방화벽

인스턴스가 속한 VCN의 보안 목록 또는 Network Security Group에서 다음 인바운드 포트만 허용한다.

| 포트 | 용도 | 권장 범위 |
|---:|---|---|
| 22 | SSH | 가능하면 본인 IP만 |
| 80 | HTTPS 인증 및 HTTP 리다이렉트 | 전체 |
| 443 | 대시보드와 Arduino 데이터 수신 | 전체 |

애플리케이션 포트 `8000`은 인터넷에 공개하지 않는다.

이 프로젝트의 현재 Oracle 서버에는 OCI CLI 컨테이너가 있으므로 다음 스크립트가 `room-monitor-https` NSG를 만들고 443/TCP 규칙을 연결한다.

```bash
./deploy/configure-oci-https-nsg.sh
```

## Ubuntu에 Docker 설치

서버에 SSH로 접속한 뒤 실행한다.

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

그룹 변경을 적용하려면 SSH 연결을 끊고 다시 접속한다.

## 프로젝트 전송

Windows PowerShell에서 실행하는 예시다.

```powershell
scp -i "개인키경로" -r .\room-monitor ubuntu@서버IP:~/
```

## 비밀 설정 만들기

서버에서 프로젝트 폴더로 이동한다.

```bash
cd ~/room-monitor
chmod +x deploy/*.sh
./deploy/initialize-secrets.sh 서버공인IP
```

스크립트는 다음 파일을 만든다.

- `.env`: Docker와 Arduino API 키
- `deploy/credentials.txt`: 대시보드 로그인 정보

두 파일의 권한은 소유자만 읽을 수 있도록 설정된다.

## 공인 IP HTTPS 인증서 발급

80번 포트가 비어 있는 상태에서 실행한다.

```bash
./deploy/issue-ip-certificate.sh
```

Let’s Encrypt가 서버의 공인 IP를 확인해 약 6일 동안 유효한 인증서를 발급한다.

## 실행

```bash
docker compose --profile production up -d --build
docker compose ps
docker compose logs -f --tail=100
```

브라우저에서 `https://서버공인IP`에 접속한다. 대시보드에는 `deploy/credentials.txt`에 저장된 사용자 이름과 비밀번호로 로그인한다.

## 인증서 자동 갱신

단기 인증서가 만료되지 않도록 12시간마다 갱신 상태를 확인한다.

```bash
./deploy/install-renewal-cron.sh
```

갱신 중에는 Caddy가 잠시 중단되며, 완료 또는 오류 시 자동으로 다시 시작된다.

## Arduino 설정

`firmware/room_monitor/arduino_secrets.h`를 다음 원칙으로 수정한다.

```cpp
#define SERVER_HOST "서버공인IP"
#define SERVER_PORT 443
#define SERVER_USE_TLS 1
#define DEVICE_API_KEY "서버의 API_KEY와 같은 값"
```

## 업데이트

바뀐 프로젝트 파일을 서버에 다시 전송한 다음 실행한다.

```bash
cd ~/room-monitor
docker compose --profile production up -d --build
```

## 데이터 백업

안전하고 단순한 방법은 잠시 서버를 멈추고 데이터베이스를 복사하는 것이다.

```bash
docker compose --profile production stop
cp data/room-monitor.db "data/room-monitor-$(date +%F).db"
docker compose --profile production start
```

백업 파일은 주기적으로 다른 PC나 저장소로 복사한다.
