# Nexus 배포 가이드

Nexus는 **Node 프로세스 하나**로 동작합니다. API(`/api`), 실시간 동기화(`/ws`, WebSocket), 빌드된 웹앱(`dist/`)을
같은 서버가 제공하고, 데이터는 **SQLite 파일 + 업로드 폴더**(기본 `server/data/`)에 저장됩니다.

```bash
npm ci && npm run build      # dist/ 생성
npm start                    # = node server/index.mjs --prod  (PORT, 기본 8080)
```

> ⚠️ SQLite와 WebSocket 접속 정보가 한 프로세스에 있으므로 **인스턴스는 1대**로 운영하세요(수평 확장 X).
> 한 대로도 수백 명 규모 팀까지는 충분합니다. 더 커지면 Postgres + Redis pub/sub 구조로 옮겨야 합니다.

---

## 1. 환경 변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `NEXUS_PUBLIC_URL` | **운영 필수** | 서비스 주소. 예: `https://nexus.example.com`. 초대·비밀번호 재설정 링크에 쓰이고, `https://`로 시작하면 쿠키에 `Secure`와 HSTS가 붙습니다. |
| `GEMINI_API_KEY` | 선택 | Google AI Studio 키. 없으면 AI 기능이 꺼집니다. `mock`이면 네트워크 없이 스크립트 응답(테스트용). |
| `GEMINI_MODEL` | 선택 | 기본 `gemini-3.8-flash`. 비용을 줄이려면 `gemini-3.1-flash-lite`. |
| `RESEND_API_KEY` | 권장 | [Resend](https://resend.com) API 키. 비밀번호 재설정·초대 메일 발송용. |
| `MAIL_FROM` | 권장 | 보내는 사람. 예: `Nexus <no-reply@nexus.example.com>` (Resend에서 도메인 인증 필요). 키/발신자가 없으면 링크를 **서버 콘솔에 출력**만 합니다. |
| `TOSS_CLIENT_KEY` | 선택 | 토스페이먼츠 클라이언트 키(`test_ck_…` / `live_ck_…`). |
| `TOSS_SECRET_KEY` | 선택 | 토스페이먼츠 시크릿 키. **두 키가 모두 있어야** 결제가 켜지고, 없으면 "14일 무료 체험"만 제공합니다. |
| `PORT` | 선택 | 운영 포트(기본 8080). 호스팅 업체가 보통 자동 주입합니다. |
| `NEXUS_DATA_DIR` | 선택 | DB·업로드 저장 경로(기본 `server/data`, Docker는 `/app/server/data`). |
| `NEXUS_TRUST_PROXY` | 프록시 뒤라면 `1` | Fly/Railway/Caddy/nginx 뒤에서는 `1`로 설정해야 로그인 시도 제한이 실제 사용자 IP 기준으로 동작합니다. |
| `NEXUS_API_PORT` | 개발용 | 개발 모드 API 포트(기본 5200, Vite가 프록시). 운영에서는 `PORT`가 우선합니다. |

시크릿(`GEMINI_API_KEY`, `RESEND_API_KEY`, `TOSS_SECRET_KEY`)은 **호스팅 업체의 Secret 기능**으로 넣으세요.
로컬에서는 `server/.env`(git 제외됨)에 둘 수 있습니다 — `server/.env.example` 참고.

## 2. HTTPS는 필수

- 세션 쿠키(`nexus_sid`, HttpOnly)는 `NEXUS_PUBLIC_URL`이 `https://`일 때 `Secure`로 발급됩니다.
- **화상/음성 허들(WebRTC)의 카메라·마이크는 HTTPS에서만** 브라우저가 허용합니다(localhost 제외).
- 토스페이먼츠 결제창 리다이렉트도 HTTPS 도메인을 요구합니다.

Fly.io·Railway는 HTTPS를 자동 제공하고, VPS라면 아래 Caddy 예시처럼 자동 인증서를 쓰면 됩니다.
리버스 프록시가 **WebSocket 업그레이드(`/ws`)를 통과**시키는지 꼭 확인하세요.

## 3. 데이터 보관 · 백업

모든 데이터는 `NEXUS_DATA_DIR` 한 폴더에 있습니다.

```
nexus.db (+ nexus.db-wal, nexus.db-shm)   ← 계정·워크스페이스·메시지 등 전부
uploads/                                    ← 업로드한 파일 원본
```

- 컨테이너라면 이 폴더를 **영구 볼륨**에 마운트하세요(Dockerfile의 `VOLUME /app/server/data`). 볼륨이 없으면 재배포 시 데이터가 사라집니다.
- **백업(권장: 하루 1회 이상, 외부 저장소로 복사)**
  ```bash
  # 서버가 켜져 있는 상태에서도 안전한 온라인 백업
  sqlite3 /app/server/data/nexus.db ".backup '/backup/nexus-$(date +%F).db'"
  rsync -a /app/server/data/uploads/ /backup/uploads/
  ```
  `sqlite3` CLI가 없다면 서버를 잠시 멈춘 뒤 `nexus.db`, `nexus.db-wal`, `nexus.db-shm`을 **함께** 복사하거나,
  `sqlite3 nexus.db "PRAGMA wal_checkpoint(TRUNCATE);"`로 WAL을 비운 뒤 `nexus.db`만 복사하세요.
  (WAL 파일 없이 `nexus.db`만 복사하면 최근 변경이 빠질 수 있습니다.)
- 복원: 서버를 멈추고 백업 파일을 `nexus.db`로 바꿔 넣은 뒤(`-wal`/`-shm` 삭제) 다시 시작합니다.
- 결제 기록(`payments` 테이블)은 워크스페이스·계정을 삭제해도 남습니다(전자상거래법상 거래기록 보관 의무 — 5년).
- 게스트 체험 계정과 데모 워크스페이스는 **24시간 후 자동 삭제**됩니다(서버가 1시간마다 정리).
- 예전 단일 워크스페이스 개발 DB를 발견하면 서버가 `nexus.legacy-<시각>.db`로 옮겨두고 새로 시작합니다.

## 4. 배포 예시

### A. Fly.io

```bash
fly launch --no-deploy            # Dockerfile 자동 인식, 리전은 nrt(도쿄) 또는 icn(서울) 권장
fly volumes create nexus_data --size 10 --region icn
```

`fly.toml`에 추가:

```toml
[env]
  PORT = "8080"
  NEXUS_TRUST_PROXY = "1"
  NEXUS_PUBLIC_URL = "https://nexus.example.com"

[[mounts]]
  source = "nexus_data"
  destination = "/app/server/data"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "off"     # WebSocket 실시간 동기화를 위해 상시 실행
  min_machines_running = 1
```

```bash
fly secrets set GEMINI_API_KEY=... RESEND_API_KEY=... MAIL_FROM="Nexus <no-reply@nexus.example.com>" \
                TOSS_CLIENT_KEY=live_ck_... TOSS_SECRET_KEY=live_sk_...
fly deploy
fly scale count 1                 # 반드시 1대
fly certs add nexus.example.com   # 커스텀 도메인
```

### B. Railway

1. GitHub 저장소 연결 → Dockerfile로 자동 빌드됩니다.
2. **Volume** 추가 → 마운트 경로 `/app/server/data`.
3. Variables: `NEXUS_PUBLIC_URL`, `NEXUS_TRUST_PROXY=1`, 각종 키. (`PORT`는 Railway가 주입)
4. Settings → Networking에서 도메인 연결. Replicas는 **1**로 유지.

### C. VPS (Ubuntu) + Caddy

```bash
# Node 22 설치 후
git clone <repo> /srv/nexus && cd /srv/nexus
npm ci && npm run build && npm prune --omit=dev
sudo useradd -r -s /usr/sbin/nologin nexus && sudo mkdir -p /var/lib/nexus && sudo chown nexus /var/lib/nexus
```

`/etc/systemd/system/nexus.service`

```ini
[Unit]
Description=Nexus
After=network.target

[Service]
User=nexus
WorkingDirectory=/srv/nexus
Environment=NODE_ENV=production PORT=8080 NEXUS_DATA_DIR=/var/lib/nexus NEXUS_TRUST_PROXY=1
Environment=NEXUS_PUBLIC_URL=https://nexus.example.com
EnvironmentFile=/etc/nexus.env
ExecStart=/usr/bin/node server/index.mjs --prod
Restart=always

[Install]
WantedBy=multi-user.target
```

시크릿은 `/etc/nexus.env`(권한 600)에 `GEMINI_API_KEY=...` 형식으로 넣고 `sudo systemctl enable --now nexus`.

`/etc/caddy/Caddyfile` — 인증서 자동 발급, WebSocket도 그대로 통과합니다.

```
nexus.example.com {
	encode zstd gzip
	request_body {
		max_size 64MB
	}
	reverse_proxy 127.0.0.1:8080
}
```

백업 cron 예: `0 4 * * * sqlite3 /var/lib/nexus/nexus.db ".backup '/var/backups/nexus-$(date +\%F).db'"` + 외부 저장소 동기화.

### D. Docker 단독

```bash
docker build -t nexus .
docker run -d --name nexus -p 8080:8080 -v nexus_data:/app/server/data \
  -e NEXUS_PUBLIC_URL=https://nexus.example.com -e NEXUS_TRUST_PROXY=1 \
  -e GEMINI_API_KEY=... nexus
```

## 5. 결제(토스페이먼츠) 동작 방식

- **선불 · 자동 갱신 없음**: 금액 = 멤버당 가격 × 현재 멤버 수 × (연간이면 12개월) + **부가세 10%**.
  (Pro 8,900원 / 연간 결제 시 월 7,900원, Business 15,900원 / 13,900원 — VAT 별도 표기)
- 결제 흐름: `/api/billing/checkout`이 대기 주문을 만들고 → 결제창 → 성공 리다이렉트에서 `/api/billing/confirm`이
  주문 금액을 대조한 뒤 토스 승인 API를 호출합니다. 승인되면 기간(1개월/12개월) 동안 요금제가 적용됩니다.
- 기간이 끝나면 자동으로 무료 요금제로 돌아갑니다. "해지"는 남은 기간까지 쓰고 끝나는 방식입니다.
- 환불·부분취소는 아직 API로 구현되어 있지 않습니다 → **토스페이먼츠 상점관리자**에서 처리하고, 환불 정책을 약관에 명시하세요.
- 먼저 `test_ck_…/test_sk_…` 테스트 키로 전체 흐름을 확인한 뒤 라이브 키로 바꾸세요.

## 6. 출시 전 체크리스트

**사업 · 법무**
- [ ] 사업자등록 (개인/법인) — 업태: 정보통신업, 종목: 소프트웨어 개발 및 공급 / 응용 소프트웨어
- [ ] **통신판매업 신고** (정부24, 관할 시·군·구) — 온라인 유료 결제를 받으려면 필요
- [ ] 이용약관 · 개인정보 처리방침 초안을 **전문가(변호사/노무·개인정보 컨설팅) 검토** 후 게시
  - 수집 항목(이름·이메일·업로드 파일·AI 요청 내용), 보관 기간, **국외 이전**(Google Gemini, Resend, 호스팅 리전) 고지
  - 회원 탈퇴 시 파기 절차, 결제 기록 5년 보관 고지
- [ ] 청약철회·환불 정책(전자상거래법) 명시, 요금은 **VAT 별도/포함 여부** 표기
- [ ] 사업자 정보(상호, 대표자, 사업자등록번호, 통신판매업 신고번호, 주소, 문의 이메일)를 `src/config/brand.ts`에 입력 → 푸터 표시
- [ ] **토스페이먼츠 가맹 계약** (사업자 서류 제출 · 심사) → 라이브 키 발급

**인프라**
- [ ] 도메인 구입 및 DNS 연결, HTTPS 확인 (`NEXUS_PUBLIC_URL`을 https 주소로)
- [ ] 메일 발송 도메인 인증(Resend: SPF/DKIM), 재설정·초대 메일 수신 테스트(스팸함 포함)
- [ ] 영구 볼륨 연결 확인 → 재배포 후에도 데이터가 남는지 확인
- [ ] 자동 백업 + **복원 리허설** 1회
- [ ] `NEXUS_TRUST_PROXY=1` (프록시 뒤인 경우), 인스턴스 1대 고정
- [ ] 업타임 모니터링(`GET /api/health`), 서버 로그 보관
- [ ] Gemini API 결제/한도 설정 — 요금제별 일일 AI 한도(무료 30 / Pro 500 / Business 3,000회)가 비용 상한이 됩니다

**최종 점검**
- [ ] 회원가입 → 워크스페이스 생성 → 초대 메일 → 다른 브라우저에서 수락 → 실시간 메시지/허들 확인
- [ ] 비밀번호 재설정, 회원 탈퇴, 워크스페이스 삭제
- [ ] 테스트 키로 결제 → 요금제 반영 확인, 금액(VAT 포함) 확인
- [ ] 게스트 체험(데모) → 회원가입 전환
