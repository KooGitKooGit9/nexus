/* Background teammate chatter, per channel and per persona (pure data). */

/** A curated follow-up to an ambient post. `who` limits it to people who'd plausibly say it. */
export interface AmbientReply {
  t: string
  who?: string[]
}

/**
 * `who` limits a line to people who'd plausibly post it. `{me}` = current user's short name.
 * `replies` are hand-written answers that actually fit the post (the simulator never improvises
 * a reply to background chatter — a wrong guess reads worse than silence). `react` are fitting emoji.
 */
export interface AmbientLine {
  t: string
  who?: string[]
  replies?: AmbientReply[]
  react?: string[]
}

const ENG = ['u_cto', 'u_fe', 'u_be', 'u_ml', 'u_devops']

export const CHANNEL_AMBIENT: Record<string, AmbientLine[]> = {
  c_general: [
    { t: '이번 주 타운홀 자료 미리 올려뒀어요 📺 금요일 16시에 봬요!', who: ['u_ceo', 'u_hr'], react: ['👍', '🙌'], replies: [{ t: '질문은 미리 스레드에 남겨도 되나요? 🙋', who: ['u_pm', 'u_design2', 'u_fe'] }, { t: '자료 잘 봤어요 👀 금요일에 봬요!' }] },
    { t: '다음 달 전사 워크숍 장소 확정됐습니다 🌿 가평으로 가요! 세부 일정은 곧 공유드릴게요', who: ['u_hr'], react: ['🎉', '🌿', '🙌'], replies: [{ t: '오 가평 좋네요 🌿 버스로 가나요?' }, { t: '벌써 기대돼요 ㅎㅎ 🙌' }] },
    { t: '보안 교육 아직 안 들으신 분들 이번 주 금요일까지 꼭 부탁드려요 🔐', who: ['u_hr', 'u_cto'], react: ['👍', '✅'], replies: [{ t: '앗 저 아직이에요 😅 오늘 들을게요!' }, { t: '방금 수료했어요 ✅' }] },
    { t: '건강검진 예약 마감이 10월 15일이에요! 아직 안 하신 분들 서둘러주세요 🏥', who: ['u_hr'], react: ['👍', '🙏'], replies: [{ t: '헉 까먹고 있었어요 😅 오늘 예약할게요!' }, { t: '지정 병원 목록은 어디서 보면 돼요?', who: ['u_fe', 'u_ml', 'u_design2', 'u_sales'] }] },
    { t: '이번 달 생일자 파티 목요일 3시에 라운지에서 해요 🎂 케이크 준비해둘게요!', who: ['u_hr'], react: ['🎂', '🎉', '😋'], replies: [{ t: '와 케이크 기대돼요 😋' }, { t: '생일자분들 미리 축하드려요 🎉' }] },
    { t: '3분기 회고 설문 열었어요 📝 익명이니까 솔직하게 남겨주세요', who: ['u_hr', 'u_ceo'], react: ['👍', '📝'], replies: [{ t: '방금 제출했어요 ✅' }, { t: '마감이 언제까지예요?', who: ['u_fe', 'u_be', 'u_sales', 'u_design'] }] },
    { t: '10월 런칭 앞두고 다들 고생 많으세요 🙏 이번 주 금요일은 다 같이 일찍 퇴근해요', who: ['u_ceo'], react: ['🙌', '❤️', '🎉'], replies: [{ t: '와 감사합니다 🙌 금요일만 기다릴게요' }, { t: '대표님도 고생 많으세요 🙏' }] },
    { t: '사내 동호회 신청 받아요! 러닝, 보드게임, 독서 중에 골라주세요 🏃📚', who: ['u_hr'], react: ['🙋', '🏃', '📚'], replies: [{ t: '저 러닝이요 🏃', who: ['u_devops', 'u_sales', 'u_fe'] }, { t: '보드게임 신청할게요 🎲' }, { t: '독서 모임 들어갈게요 📚', who: ['u_design2', 'u_mkt', 'u_hr'] }] },
    { t: '이번 주 금요일 오후 4시부터 사내 와이파이 점검이 있어요 📶 30분 정도 걸려요', who: ['u_hr', 'u_devops'], react: ['👍', '🙆'], replies: [{ t: '넵 그 시간엔 테더링 쓸게요 📱' }] },
  ],
  c_random: [
    { t: '탕비실에 쿠키 채워뒀어요 🍪 선착순!', who: ['u_hr', 'u_mkt'], react: ['🍪', '😋', '🙏'], replies: [{ t: '헉 바로 갑니다 🏃' }, { t: '센스 최고 👍 회의 끝나고 갈게요' }] },
    { t: '혹시 C타입 충전기 빌려주실 분 계신가요? 🙏', react: ['🙋'], replies: [{ t: '저 있어요! 자리로 갖다드릴게요 🙋' }, { t: '라운지 공용 서랍에 몇 개 있을 거예요 🔌' }] },
    { t: '요즘 작업할 때 로파이 무한반복 중 🎧 추천 플리 있으면 공유해주세요', react: ['🎧'], replies: [{ t: '집중할 땐 영화 OST 플리가 최고예요 🎬' }, { t: '재즈 좋아하시면 Bill Evans 추천해요 🎹' }] },
    { t: '사무실 화분에 꽃 폈어요 🌸 누가 물 주시는 거예요?', react: ['🌸', '😍'], replies: [{ t: '제가 월요일마다 주고 있어요 ㅎㅎ 🪴', who: ['u_hr'] }, { t: '헉 예쁘다 🌸 사진 찍으러 가야겠어요' }] },
    { t: '오늘 점심 뭐 드세요? 저 아직 못 정했어요 🤔', react: ['😋'], replies: [{ t: '저 쌀국수 먹으러 가요 🍜 같이 가실래요?' }, { t: '회사 뒤 김치찌개 어때요? 🍲' }, { t: '오늘은 도시락 싸 왔어요 🍱 내일 같이 가요!' }] },
    { t: '1층 카페 신메뉴 나왔대요 ☕ 밤라떼 맛있네요', react: ['☕', '😋'], replies: [{ t: '오 이따 먹어봐야겠어요 ☕' }, { t: '달아요? 저 단 거 잘 못 먹어서요 ㅎㅎ' }] },
    { t: '오늘 하늘 진짜 예쁘네요 ☁️ 퇴근길에 산책해야겠어요', react: ['☁️', '😍', '🍁'], replies: [{ t: '진짜 가을 날씨네요 🍁' }, { t: '점심 먹고 한 바퀴 돌아요 ㅎㅎ 🚶' }] },
    { t: '주말에 성수 새로 생긴 베이커리 가봤는데 소금빵 맛집이에요 🥐', react: ['🥐', '😋'], replies: [{ t: '오 어디예요? 지도 링크 주세요 📍' }, { t: '소금빵 최고죠 😋 이번 주에 가봐야겠어요' }] },
    { t: '혹시 넷플릭스 요즘 볼 만한 거 있나요? 📺', react: ['📺', '👀'], replies: [{ t: '「흑백요리사」 아직 안 보셨으면 강추해요 📺' }, { t: '다큐 좋아하시면 「나의 문어 선생님」 추천해요 🐙' }] },
    { t: '이번 주 수요일 한강 러닝 같이 뛰실 분? 🏃', who: ['u_devops', 'u_sales', 'u_fe'], react: ['🙋', '🏃'], replies: [{ t: '저요! 🙋 몇 시에 모여요?' }, { t: '5km만 뛰어도 되나요? ㅋㅋ' }] },
    { t: '오늘 왜 이렇게 졸리죠 😪 커피 수혈하러 갑니다', react: ['☕', '😂'], replies: [{ t: '저도 같이 가요 ☕' }, { t: 'ㅋㅋ 저 오늘 벌써 두 잔째예요' }] },
    { t: '고양이 사진 투척합니다 🐱 오늘 아침 출근 방해 중', who: ['u_design', 'u_ml', 'u_mkt'], react: ['😍', '🐱', '🥰'], replies: [{ t: '헉 너무 귀여워요 😍' }, { t: '출근 방해 인정합니다 ㅋㅋ 🐱' }] },
  ],
  c_engineering: [
    { t: '스테이징 환경 잠깐 재시작합니다 🔄 5분 정도 걸려요', who: ['u_devops', 'u_be'], react: ['👍', '🙏'] },
    { t: 'CI 캐시 설정 바꿨더니 빌드 시간 40% 줄었어요 ⚡', who: ['u_devops', 'u_fe'], react: ['🚀', '⚡', '🙌'], replies: [{ t: '오 체감돼요 👏 감사합니다' }, { t: '프론트 e2e도 같이 빨라졌네요 ⚛️', who: ['u_fe'] }] },
    { t: '`main` 브랜치 리베이스 했습니다. 로컬에서 pull 한 번 받아주세요!', who: ENG, react: ['👍', '✅'] },
    { t: '혹시 Redis 메모리 그래프 보신 분? 오후부터 조금 튀는 것 같아요 👀', who: ['u_be', 'u_devops'], react: ['👀'], replies: [{ t: '저도 봤어요. 배치 작업 시간이랑 겹치는 것 같아요 🔍', who: ['u_devops', 'u_be', 'u_cto'] }, { t: '알람 임계치 근처라 일단 모니터링 걸어둘게요 🔔', who: ['u_devops'] }] },
    { t: '의존성 보안 패치 PR 올렸습니다. 리뷰 부탁드려요 🔒', who: ['u_fe', 'u_be'], react: ['👀', '👍'], replies: [{ t: '지금 볼게요 👀', who: ENG }, { t: '회의 끝나고 30분 안에 볼게요 🙏', who: ENG }] },
    { t: '검색 API p95가 380ms → 210ms로 줄었어요 🚀 인덱스 튜닝 효과 있네요', who: ['u_be'], react: ['🚀', '🔥', '👏'], replies: [{ t: '와 거의 반이네요 👏 검색 체감 확 좋아졌어요' }, { t: '프론트에서 스켈레톤 시간도 줄여볼게요 ⚛️', who: ['u_fe'] }] },
    { t: '내일 오전 10시에 DB 마이너 버전 업그레이드 예정입니다. 다운타임은 없어요 🛠', who: ['u_devops'], react: ['👍', '🙏'] },
    { t: '프론트 번들 사이즈 18% 줄였어요 📦 코드 스플리팅 적용했습니다', who: ['u_fe'], react: ['🚀', '👏'], replies: [{ t: '오 LCP도 줄었겠네요 👏' }, { t: '라이트하우스 점수 궁금해요 👀', who: ['u_pm', 'u_cto', 'u_design'] }] },
    { t: '이번 주 아키텍처 리뷰 안건 있으신 분 스레드에 남겨주세요 📝', who: ['u_cto'], react: ['👍'], replies: [{ t: '검색 인덱스 샤딩 건 올릴게요 📝', who: ['u_be'] }, { t: '추천 서빙 캐시 구조 얘기하고 싶어요 🧠', who: ['u_ml'] }] },
    { t: '오늘 온콜 교대합니다 📟 이번 주는 제가 볼게요', who: ['u_devops', 'u_be'], react: ['🙏', '💪'], replies: [{ t: '고생하세요 🙏 조용한 한 주 되길!' }] },
  ],
  c_design: [
    { t: '아이콘 세트 v2 업데이트했어요 ✨ 라이브러리 업데이트 받아주세요', who: ['u_design'], react: ['✨', '😍'], replies: [{ t: '코드 쪽 아이콘도 같이 교체해둘게요 ⚛️', who: ['u_fe'] }, { t: '라인 두께 통일되니까 훨씬 깔끔하네요 ✨' }] },
    { t: '컴포넌트 라이브러리에 Toast 변형 3종 추가했습니다 🍞', who: ['u_design'], react: ['✨', '👍'], replies: [{ t: '오 마침 필요했어요! 이번 스프린트에 적용할게요 ⚛️', who: ['u_fe'] }] },
    { t: '다음 크리틱 안건 있으신 분 스레드에 남겨주세요 🎨', who: ['u_design'], react: ['🎨'], replies: [{ t: '온보딩 v2 리서치 결과 공유할게요 📝', who: ['u_design2'] }, { t: '런칭 배너 시안 봐주세요 🙏', who: ['u_mkt'] }] },
    { t: '모션 가이드 초안 공유드려요. 이징 커브 통일했습니다 🌀', who: ['u_design'], react: ['😍', '✨'], replies: [{ t: '구현할 때 토큰으로 바로 쓸 수 있겠네요 👍', who: ['u_fe'] }, { t: '전환이 훨씬 자연스러워졌어요 ✨' }] },
    { t: '온보딩 사용성 테스트 5명 중 4명이 2단계에서 막혔어요 📝 리포트 정리 중이에요', who: ['u_design2'], react: ['👀', '😮'], replies: [{ t: '헉 생각보다 많네요 😮 어떤 부분에서 막혔어요?', who: ['u_design', 'u_pm'] }, { t: '리포트 나오면 2단계부터 다시 볼게요 ✏️', who: ['u_design'] }] },
    { t: '이번 주 인터뷰 참가자 모집 완료했어요! 목·금 오후에 진행합니다 🎙️', who: ['u_design2'], react: ['👏', '🙌'], replies: [{ t: '참관 가능할까요? 🙋', who: ['u_design', 'u_pm', 'u_fe'] }] },
    { t: '다크 모드 대비 토큰 한 단계씩 올려봤는데 어떤가요? 👀', who: ['u_design'], react: ['👀', '👍'], replies: [{ t: '훨씬 잘 읽혀요 👍 특히 보조 텍스트가 좋아졌어요' }, { t: '저시력 테스트 기준도 통과할 것 같아요 📝', who: ['u_design2'] }] },
  ],
  c_product: [
    { t: '이번 주 활성 사용자 지표 공유드려요 📈 WAU +8%', who: ['u_pm'], react: ['📈', '🔥'], replies: [{ t: '좋은 흐름이네요 👏 리텐션도 같이 보면 좋겠어요', who: ['u_ceo', 'u_me'] }, { t: '캠페인 유입 효과가 커 보이네요 📣', who: ['u_mkt'] }] },
    { t: '고객 인터뷰 노트 업로드했습니다 📝 반복적으로 나온 키워드는 "검색"이에요', who: ['u_design2', 'u_pm'], react: ['👀', '🙏'], replies: [{ t: '검색 개편 우선순위 올려야겠네요 🔎', who: ['u_pm', 'u_ceo'] }, { t: '검색 API 개선분이랑 같이 보면 좋겠어요 👀', who: ['u_be'] }] },
    { t: '스프린트 데모 순서 정리했어요 🎬 각자 5분씩이에요', who: ['u_pm'], react: ['👍', '🎬'], replies: [{ t: '저 순서 바꿔도 될까요? 오후 미팅이 있어서요 🙏' }] },
    { t: '경쟁사 신규 기능 분석 문서 올렸습니다 🔍', who: ['u_pm', 'u_mkt'], react: ['👀', '🙏'], replies: [{ t: '정리 감사해요 🙏 가격 정책 부분이 흥미롭네요' }] },
    { t: 'Q4 로드맵 확정 D-3이에요 🗓 우선순위 이견 있으면 오늘 중으로 코멘트 주세요', who: ['u_pm'], react: ['👍', '👀'], replies: [{ t: '인프라 비용 쪽 코멘트 남겼어요 💬', who: ['u_cto', 'u_be'] }, { t: '고객 요청 많은 SSO 우선순위 한 번만 더 봐주세요 🙏', who: ['u_mkt', 'u_ceo'] }] },
    { t: '추천 모델 v4 A/B 결과 나왔어요 🧪 클릭률 +6.2%, 유의미합니다', who: ['u_ml'], react: ['🔥', '🧪', '👏'], replies: [{ t: '오 바로 전체 적용 가능할까요? 🚀', who: ['u_pm', 'u_ceo'] }, { t: '서빙 비용은 얼마나 늘었어요? 👀', who: ['u_cto', 'u_be'] }] },
  ],
  c_marketing: [
    { t: '블로그 신규 포스트 발행했어요 ✍️ 링크드인 공유 부탁드려요!', who: ['u_mkt'], react: ['📣', '🙌'], replies: [{ t: '방금 공유했어요 📣' }, { t: 'Shared on LinkedIn 🙌', who: ['u_global'] }] },
    { t: '웨비나 사전 등록 400명 돌파 🎉', who: ['u_mkt'], react: ['🎉', '🔥', '👏'], replies: [{ t: '와 목표 초과네요 👏' }, { t: '고객사 쪽에도 한 번 더 안내할게요 🤝', who: ['u_sales', 'u_global'] }] },
    { t: '뉴스레터 오픈율 41% 나왔습니다 📬 지난달보다 6%p 올랐어요', who: ['u_mkt'], react: ['📈', '👏'], replies: [{ t: '제목 A/B 테스트 효과 있었네요 👏' }] },
    { t: '런칭 랜딩페이지 카피 2안 올렸어요. 어느 쪽이 더 좋아요? ✍️', who: ['u_mkt'], react: ['👀'], replies: [{ t: '저는 A안이요! 첫 문장이 훨씬 명확해요' }, { t: 'B안이 고객 언어에 더 가까운 것 같아요 🤝', who: ['u_sales', 'u_global'] }] },
    { t: 'US 쪽 파트너 웨비나 일정 확정됐어요 🇺🇸 11월 둘째 주예요', who: ['u_global'], react: ['🇺🇸', '🙌'], replies: [{ t: '한국어 자막본도 만들까요? 🎬', who: ['u_mkt'] }] },
  ],
  c_sales: [
    { t: '방금 데모 미팅 끝났는데 반응 너무 좋았어요 🔥', who: ['u_sales'], react: ['🔥', '🙌'], replies: [{ t: '오 어떤 기능 반응이 제일 좋았어요? 👀' }, { t: '고생하셨어요 👏 다음 단계는 POC인가요?' }] },
    { t: '파이프라인 업데이트: 이번 달 클로징 예정 5건 💼', who: ['u_sales'], react: ['💼', '🔥'], replies: [{ t: '좋네요 👍 지원 필요한 딜 있으면 말씀주세요', who: ['u_ceo'] }] },
    { t: '고객사에서 레퍼런스 콜 수락해줬어요 🙌', who: ['u_sales', 'u_global'], react: ['🙌', '🎉'], replies: [{ t: '케이스 스터디로도 만들 수 있을까요? ✍️', who: ['u_mkt'] }] },
    { t: '한빛금융 POC 2주 연장 확정됐습니다 🤝', who: ['u_sales'], react: ['🤝', '💪'], replies: [{ t: '연장 기간에 SSO 데모까지 보여주면 좋겠어요 🔐', who: ['u_ceo', 'u_global'] }] },
    { t: 'Brightwave renewal signed — 2-year term! 🎉 계약 갱신 완료요!', who: ['u_global'], react: ['🎉', '🥳', '👏'], replies: [{ t: 'Emily 최고 👏👏', who: ['u_sales', 'u_ceo', 'u_mkt'] }] },
  ],
  c_incidents: [
    { t: '알람 해제되었습니다 ✅ 30분 더 모니터링할게요', who: ['u_devops', 'u_be'], react: ['🙏', '✅'], replies: [{ t: '고생하셨어요 🙏', who: ENG }] },
    { t: '에러율 정상 범위로 돌아왔습니다 📉', who: ['u_devops', 'u_be'], react: ['🙌', '✅'], replies: [{ t: '휴 다행이네요 😮‍💨 포스트모템 간단히 남겨주세요', who: ['u_cto'] }] },
    { t: 'CDN 캐시 퍼지 완료했습니다 🧹', who: ['u_devops'], react: ['👍', '✅'] },
    { t: '지난주 장애 포스트모템 초안 올렸어요 📝 리뷰 부탁드려요', who: ['u_be', 'u_devops'], react: ['👀', '🙏'], replies: [{ t: '꼼꼼하네요 👍 재발 방지 항목에 알람 임계치도 넣어주세요', who: ['u_cto'] }, { t: '오늘 중으로 코멘트 남길게요 📝', who: ENG }] },
  ],
  c_seoul: [
    { t: '3층 프린터 토너 교체 완료했어요 🖨', who: ['u_hr'], react: ['🙏', '👍'] },
    { t: '오늘 저녁 라운지에서 보드게임 하실 분? 🎲', react: ['🙋', '🎲'], replies: [{ t: '저요! 🙋 몇 시에 모여요?' }, { t: '할리갈리 있으면 갈게요 ㅋㅋ' }] },
    { t: '택배 도착했어요! 1층 데스크에서 찾아가세요 📦', who: ['u_hr'], react: ['🙏', '📦'], replies: [{ t: '앗 제 거 같아요 🏃 감사합니다!' }] },
    { t: '내일 오전 9~10시 엘리베이터 점검이 있어요 🛗 계단 이용 부탁드려요', who: ['u_hr'], react: ['👍', '🙆'], replies: [{ t: '내일은 운동하는 날이네요 ㅋㅋ 🏃' }] },
    { t: '회의실 Orion 에어컨 수리 완료됐어요 ❄️', who: ['u_hr'], react: ['🙏', '❄️'], replies: [{ t: '드디어 ㅠㅠ 감사합니다 🙏' }] },
    { t: '4층 라운지 커피머신 원두 새로 채웠어요 ☕', who: ['u_hr'], react: ['☕', '😍'], replies: [{ t: '오 이번엔 어떤 원두예요? ☕' }] },
  ],
  c_leadership: [
    { t: '다음 주 OKR 리뷰 안건 정리 부탁드립니다 🎯', who: ['u_ceo'], react: ['👍'], replies: [{ t: '넵 목요일까지 정리해서 올릴게요 📝', who: ['u_cto', 'u_mkt', 'u_hr'] }] },
    { t: '채용 파이프라인 현황 업데이트했어요 🌱 프론트 포지션 최종 2명 남았어요', who: ['u_hr'], react: ['👀', '🌱'], replies: [{ t: '최종 면접은 제가 들어갈게요 🙋', who: ['u_cto'] }] },
    { t: '이번 분기 예산 집행률 공유드려요 📊 마케팅 쪽 여유가 좀 있어요', who: ['u_ceo'], react: ['👀'], replies: [{ t: '런칭 광고 예산으로 돌려도 될까요? 📣', who: ['u_mkt'] }] },
  ],
  c_ailab: [
    { t: '이번 주 논문 스터디는 RAG 평가 방법론이에요 📄', who: ['u_ml'], react: ['🧠', '👀'], replies: [{ t: '발제 자료 미리 읽어갈게요 📄' }] },
    { t: '임베딩 모델 교체 실험 결과 recall@10 +4%p 나왔어요 🧠', who: ['u_ml'], react: ['🔥', '🧠'], replies: [{ t: '오 레이턴시는 어때요? 👀', who: ['u_cto', 'u_be'] }] },
  ],
}

/** Generic chatter for channels without their own bank. */
export const GENERIC_AMBIENT: AmbientLine[] = [
  { t: '오늘도 다들 화이팅이에요 💪', react: ['💪', '🙌'] },
  { t: '이번 주도 벌써 반 지났네요 ⏳', react: ['😂', '⏳'], replies: [{ t: '시간 진짜 빠르네요 ㅎㅎ' }] },
  { t: '좋은 아티클 있어서 공유드려요 📎 시간 날 때 읽어보세요', react: ['🙏', '👀'], replies: [{ t: '오 저장해두고 읽어볼게요 🔖' }] },
]

/** DM openers from a teammate to the current user (persona-specific first, then generic). */
export const DM_AMBIENT: Record<string, string[]> = {
  u_ceo: ['{me}님 이번 주 로드맵 리뷰 시간 잠깐 괜찮으세요?', '투자사에서 제품 데모 요청이 왔어요. 다음 주 가능할까요?', '어제 발표 좋았어요 👏 고생 많았어요'],
  u_cto: ['{me}님 다음 스프린트에 기술 부채 정리 시간 좀 확보할 수 있을까요?', '검색 개편 스펙 봤어요. 인프라 비용 쪽 한 번 같이 봐요'],
  u_fe: ['{me}님 온보딩 v2 프론트 작업 거의 끝났어요! 스테이징에서 한번 봐주실래요? 🙏', '디자인 시스템 v3 마이그레이션 일정 공유드려도 될까요?'],
  u_be: ['{me}님 검색 API 응답 포맷 바꿔도 괜찮을까요? 프론트랑은 얘기해뒀어요', '오늘 재택이라 혹시 급한 거 있으면 DM 주세요 🏠'],
  u_ml: ['{me}님 추천 모델 v4 결과 공유드려요 🧪 클릭률 +6.2%예요!', '평가 데이터셋 라벨링 인력 2명만 더 지원받을 수 있을까요?'],
  u_devops: ['{me}님 이번 주 금요일 배포 프리즈 예외 요청 있으세요?'],
  u_design: ['{me}님 온보딩 시안 v2 올렸어요! 시간 될 때 봐주세요 🎨', '크리틱 때 말씀하신 부분 반영했어요 ✏️ 한번 확인 부탁드려요'],
  u_design2: ['{me}님 사용성 테스트 리포트 초안 보내드려요 📝', '다음 주 인터뷰 질문지 검토해주실 수 있나요?'],
  u_pm: ['{me}님 스프린트 리뷰 자료 보셨어요?', '내일 오전 스탠드업 대신 비동기로 해도 될까요?', '로드맵 우선순위 표 업데이트했어요 📋 확인 부탁드려요'],
  u_mkt: ['{me}님 런칭 보도자료 초안 검토 부탁드려도 될까요? ✍️', '랜딩페이지 카피 최종본이에요! 오늘 중으로 컨펌 가능하실까요?'],
  u_sales: ['{me}님 한빛금융 데모에 같이 들어가 주실 수 있나요? 🤝', '고객사에서 SSO 요건 문의 왔는데 로드맵에 있을까요?'],
  u_hr: ['{me}님 이번 분기 평가 일정 공유드려요 🌱', '신규 입사자 온보딩 버디 부탁드려도 될까요? 🙏'],
  u_global: ['Hi {me}! Quick question — is the SSO feature on the Q4 roadmap? 🙏'],
}
export const DM_GENERIC = ['{me}님 잠깐 시간 되세요? ☕', '아까 말씀하신 자료 공유드려요! 📎', '혹시 내일 오전에 15분만 얘기 가능하실까요?', '덕분에 일 잘 마무리했어요 🙏', '이거 한번 봐주실 수 있나요? 급한 건 아니에요 😊']

export const MENTION_AMBIENT = [
  '@{name} 이거 한번 확인 부탁드려요 🙏',
  '@{name} 의견 주실 수 있을까요?',
  '@{name} 내일 오전 미팅 시간 괜찮으세요?',
  '@{name} 문서 업데이트했어요! 시간 될 때 봐주세요 📄',
  '@{name} 이 부분 결정이 필요해요 🤔 오늘 중으로 가능할까요?',
]
