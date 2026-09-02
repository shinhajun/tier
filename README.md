# TIER

개인적으로 자주 열고 바로 수정하는 모바일 우선 티어표입니다.

- Production: <https://tier.hajunshin.com>
- Seed board: `/t/space-movie-scores`
- Stack: React 19, TypeScript, Vite, Supabase, Cloudflare Pages

## Product

- 간결한 티어표 목록과 카테고리 필터
- 점수형·문자형·자유형 행 구성
- 항목 추가, 점수/메모, 행 간 이동, 순서 변경
- 드래그 없이도 모든 편집이 가능한 버튼·선택 메뉴
- Cloudflare Turnstile을 통과한 로그인 화면 없는 Supabase anonymous Auth
- 같은 브라우저의 익명 소유권과 개인 관리자 키를 분리한 쓰기 RPC
- 관리자 키로 기본 영화표를 포함한 모든 표 수정·삭제
- 320 px부터 데스크톱까지 대응하는 반응형 UI

초기 영화 표에는 요청받은 8개 작품과 9·8·7.5·7·6점 기준이 포함되어 있습니다.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`에는 브라우저 공개가 전제된 Supabase URL과 **publishable key**만 둡니다.

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA...
```

`sb_secret_*`, service-role key, DB password, Supabase management token, Cloudflare token은 브라우저 빌드와 저장소에 넣지 않습니다.
로컬 `supabase start`는 `supabase/config.toml`의 `env(TURNSTILE_SECRET_KEY)`를 참조하므로, Cloudflare widget secret을 shell 환경에만 넣습니다. 이 값에는 절대 `VITE_` 접두사를 붙이지 않습니다.

개인 관리자 키 원문은 Obsidian 자격증명 노트와 ignored `.env.admin.local`에만 둡니다. Supabase에는 SHA-256 digest만 저장하고 Vite/GitHub secret에는 넣지 않습니다.

## Validation

```bash
npm run lint
npm test
npm run build
npm run test:e2e
npm run smoke:db
npm run verify:captcha
psql "$SUPABASE_DB_URL" -f scripts/smoke-database.sql
PLAYWRIGHT_BASE_URL=https://tier.hajunshin.com xvfb-run -a node --env-file-if-exists=.env.local --env-file-if-exists=.env.admin.local scripts/smoke-browser-mutation.mjs
npm audit --omit=dev
./scripts/verify-no-secrets.sh
```

`npm run test:e2e`는 desktop Chrome, 390×844 mobile Chrome, 320×568 Chrome, mobile WebKit에서 간결한 목록·공개 영화 표·직접 URL·44px 터치 대상·긴 입력값 오버플로·행 편집 컨트롤을 검사합니다. `scripts/smoke-database.sql`은 운영 DB 트랜잭션을 롤백하며 소유자/관리자 쓰기·잘못된 관리자 키 거부·직접 쓰기 차단·payload rollback·충돌·삭제를 검증합니다. `npm run verify:captcha`는 token이 없는 익명 가입을 운영 Auth가 거부하는지 검사합니다. `smoke-browser-mutation.mjs`는 실제 Turnstile로 표를 만든 뒤 소유자 세션을 제거하고 관리자 키로 수정·삭제·미존재 확인까지 실행합니다. Cloudflare는 호스팅 사업자 IP의 자동 위젯 해결을 차단할 수 있으므로 이 양성 경로는 신뢰 가능한 운영자 환경에서 실행합니다. `npm run smoke:db`는 CAPTCHA를 켜기 전의 실제 익명 Auth 통합 호출에 사용합니다. 배포된 사이트를 검사하려면:

```bash
PLAYWRIGHT_BASE_URL=https://tier.hajunshin.com npm run test:e2e
```

## Database

일곱 개의 `20260902*` migration은 다음을 생성·보강합니다.

- `tier_boards`
- `tier_rows`
- `tier_items`
- 4개 행·행당 3개 항목만 반환하는 `tier_board_gallery` 요약 view
- 완전한 표를 원자적으로 반환하는 `create_tier_board` / `save_tier_board` / `delete_tier_board` RPC
- public-read RLS와 authenticated 직접 table write 차단
- 소유자별 25개 표 상한, 24개 gallery 조회 상한, payload 크기 검증
- `updated_at` 선행 조건으로 다른 탭의 수정을 덮어쓰지 않는 충돌 감지
- 개인 관리자 키 digest와 `verify_tier_admin` / `admin_save_tier_board` / `admin_delete_tier_board` RPC
- 수정 가능한 영화 seed board

활성 무료 프로젝트 한도 때문에 이 서비스는 소유자의 기존 Supabase 프로젝트 안에서 충돌 없는 `tier_*` 전용 테이블을 사용합니다. 다른 제품 테이블과 권한은 공유하지 않습니다. 공유 프로젝트의 기존 migration history는 이 저장소에 복제하지 않으므로, 신규 DB migration은 운영자 검토 후 적용하고 remote history에 기록합니다.

## Deployment

`main` push 시 `.github/workflows/deploy.yml`이 다음을 실행합니다.

1. Supabase/Turnstile 환경값 및 운영 seed REST 검증
2. lint, unit/component tests, production build
3. dependency audit와 tracked/untracked candidate secret scan
4. Cloudflare Pages `tier` 프로젝트 배포
5. 롤백 트랜잭션으로 운영 DB의 소유권·검증·충돌 경계 검사
6. `tier.hajunshin.com`의 HTML, SPA deep link, 보안 헤더와 공개 브라우저 seed 로드 검사

실제 Turnstile→Supabase 익명 Auth→관리자 unlock→수정→삭제 경로는 위의 `smoke-browser-mutation.mjs` 명령으로 신뢰 가능한 운영자 환경에서 별도 수행합니다. CI는 token 없는 가입 거부, 소유자·관리자 데이터베이스 권한 경계와 공개 운영 화면을 계속 자동 검증합니다.

GitHub encrypted secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_TURNSTILE_SITE_KEY`
- `SUPABASE_DB_URL` (CI에서 rollback 통합 검사에만 사용)

## Design contract

제품 목표, 모바일 동작, 접근성, 시각 언어와 금지 패턴은 [`DESIGN.md`](./DESIGN.md)가 기준입니다. 구현 계획과 수용 기준은 [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md)에 기록되어 있습니다.
