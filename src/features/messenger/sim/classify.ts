/* Intent / topic classifier for simulated teammate replies (pure). */
import { plain } from './text'

export type Topic =
  | 'food' // 점심/저녁/메뉴/맛집
  | 'coffee'
  | 'dinner' // 회식/술
  | 'snack'
  | 'meeting'
  | 'deploy'
  | 'incident'
  | 'review'
  | 'design'
  | 'deadline'
  | 'leave'
  | 'late'
  | 'offwork'
  | 'weekend'
  | 'weather'
  | 'metrics'
  | 'ai'
  | 'marketing'
  | 'sales'
  | 'hiring'
  | 'docs'
  | 'approval'
  | 'availability'
  | 'help'
  | 'health'
  | 'office'
  | 'hobby' // 넷플릭스/책/러닝/보드게임…
  | 'none'

export type Act =
  | 'greeting'
  | 'thanks'
  | 'apology'
  | 'congrats' // "축하해요" (to someone)
  | 'goodnews' // "계약 따냈어요!" (author's own news)
  | 'farewell'
  | 'praise' // "다들 고생 많으셨어요"
  | 'request'
  | 'question'
  | 'opinion'
  | 'proposal'
  | 'announce'
  | 'tired'
  | 'laugh'
  | 'ack'
  | 'cancel'
  | 'statement'

export interface Intent {
  text: string
  topic: Topic
  topicScore: number
  acts: Act[]
  primary: Act
  question: boolean
  /** question without a wh-word → a yes/no answer fits */
  yesno: boolean
  /** asks about the listener ("드셨어요?", "왜 늦으셨어요?") */
  youRef: boolean
  /** speaks about themselves ("저 내일 연차예요") */
  selfRef: boolean
  /** addressed to everyone ("다들", "@here") */
  toAll: boolean
  urgent: boolean
  howTo: boolean
  when: boolean
  /** asks for feedback on something the author shares ("초안 공유드립니다. 의견 주세요") */
  feedback: boolean
  /** asks the room for ideas ("아이디어 있으신 분?") */
  ideas: boolean
  /** shares a link */
  link: boolean
  /** wants to borrow something ("충전기 빌려주실 분?") */
  lend: boolean
  /** offers to do something ("데모 자료 제가 준비할까요?") */
  offer: boolean
  sentiment: 'pos' | 'neg' | 'neutral'
}

type P = [RegExp, number]

const TOPICS: Record<Exclude<Topic, 'none'>, P[]> = {
  food: [
    [/점심|저녁\s*(뭐|메뉴|먹|드|같이|식사)|메뉴|맛집|식사|밥\s*(먹|드|뭐|같이)|밥은|배고|배고파|먹을까|드실|드셨|먹었|먹고|뭐 먹|뭘 먹|식당|배달|도시락/, 3],
    [/냉면|국밥|김치찌개|된장|찌개|파스타|피자|버거|햄버거|초밥|스시|라멘|우동|쌀국수|샐러드|돈까스|돈가스|짜장|짬뽕|중식|일식|한식|양식|분식|떡볶이|덮밥|텐동|비빔밥|칼국수|마라탕|샌드위치|포케|치킨|삼겹살|고기|곱창|부대찌개|순대|백반/, 3],
  ],
  coffee: [[/커피|카페|아아|아메리카노|라떼|스벅|스타벅스|블루보틀|티타임|☕/, 4]],
  dinner: [[/회식|술\s*한잔|한잔\s*(해|하|할)|맥주|소주|와인|치맥|뒤풀이|저녁\s*회식|2차|🍻|🍺/, 5]],
  snack: [
    [/간식|탕비실|쿠키|과자|케이크|디저트|빵|도넛|아이스크림|🍪|🍩/, 3],
    [/생일|파티|🎂/, 5],
  ],
  meeting: [
    [/회의|미팅|싱크|스탠드업|스크럼|1on1|원온원|1:1|킥오프|회고|플래닝|타운홀|워크숍|발표|데모데이|안건|크리틱/, 3],
    [/모일까|모여서|만날까|볼까요|시간\s*(맞춰|정해)|워크숍|워크샵|야유회/, 3],
    [/캘린더|일정\s*(잡|조율|맞|공유)|초대\s*(보내|해)|회의실|미팅룸|줌|zoom|구글\s*밋|meet/i, 3],
  ],
  deploy: [[/\bci\b|빌드|github\s*actions|배포|릴리즈|릴리스|release|deploy|롤백|핫픽스|hotfix|프로덕션|스테이징|staging|prod\b|프리즈|버전\s*업|출시\s*(일|일정|준비)|마이그레이션/i, 4]],
  incident: [
    [/redis|메모리|\bcpu\b|스파이크|튀는|튀어|튀고|레이턴시|latency|부하|서버\s*(다운|느|터)/i, 4],
    [/장애|에러|오류|버그|bug|error|안\s*돼|안\s*되|안됨|먹통|다운|500|503|크래시|터졌|터짐|느려|느림|느린|응답\s*속도|지연|타임아웃|timeout|알람|경보|sev\d|이슈|재현|(에러|서버|접속|시스템)\s*로그|로그\s*(확인|봐|보니|에)/i, 4],
  ],
  review: [[/\bpr\b|풀리퀘|pull request|리뷰|머지|merge|lgtm|approve|코드\s*(봐|좀|확인)|브랜치|커밋|테스트\s*코드/i, 4]],
  design: [
    [/디자인|시안|피그마|figma|프로토타입|와이어프레임|와이어|목업|mockup|컴포넌트|아이콘|폰트|타이포|컬러|색상|색감|팔레트|레이아웃|일러스트|모션|애니메이션|다크\s*모드|ux|ui|사용성|사용자\s*테스트|유저\s*테스트|인터뷰|무드보드|배너|랜딩/i, 4],
  ],
  deadline: [
    [/마감|데드라인|deadline|언제까지|eta|일정\s*(확인|어떻게|괜찮)|진행\s*(상황|률|도)|어디까지|얼마나\s*(됐|걸|남)|완료\s*(예정|되|됐)|언제\s*끝|끝(나|날|낼)\s*(것|까|예정|수)|스프린트|기한|납기|d-\d/i, 4],
  ],
  leave: [[/휴가|연차|반차|반반차|병가|월차|리프레시|복지|건강검진|경조사|육아휴직|출산휴가|휴직|복리후생|도서구입비|식대|법카|법인카드/, 5]],
  late: [[/지각|늦었|늦을|늦어|늦게|늦으|늦는|늦겠|출근\s*(늦|못|했|하셨)|지하철|버스|차가\s*막|길이\s*막|교통|신호\s*장애/, 5]],
  offwork: [[/퇴근|칼퇴|야근|집에\s*(가|갑|간)|먼저\s*(들어|가보|갈게)|오늘\s*고생|수고하셨|수고\s*많|들어가\s*(보|겠|세요)/, 4]],
  weekend: [[/주말|금요일\s*(저녁|밤)|불금|토요일|일요일|월요병|연휴|추석|설날|명절/, 3]],
  weather: [[/날씨|비\s*(와|오|온|올|가|내|소식)|비가|눈\s*(와|오)|눈이|덥|더워|춥|추워|미세먼지|우산|햇살|하늘\s*(예쁘|맑)|태풍|장마|🌧|☔/, 4]],
  metrics: [[/지표|매출|arr|mrr|mau|dau|wau|전환율|리텐션|이탈률|kpi|okr|nps|대시보드|성장률|목표\s*(치|달성)|분기\s*(목표|실적)|실적|퍼널|코호트|a\/b|ab\s*테스트/i, 4]],
  ai: [[/llm|gpt|claude|모델|프롬프트|임베딩|파인튜닝|fine-?tun|학습|추론|데이터셋|gpu|rag|에이전트|agent|ai\b|머신러닝|딥러닝|벡터/i, 4]],
  marketing: [[/캠페인|블로그|뉴스레터|광고|sns|인스타|링크드인|보도자료|프레스|웨비나|브랜드|브랜딩|카피|콘텐츠|컨텐츠|홍보|런칭\s*(행사|이벤트|캠페인)|seo/i, 4]],
  sales: [[/pipeline|deal|고객사|고객\s*(미팅|사|요청|문의|피드백)|계약|데모\s*(미팅|일정|요청)|딜\b|견적|파이프라인|리드|세일즈|영업|레퍼런스|갱신|제안서|rfp|po\b/i, 4]],
  hiring: [[/채용|면접|지원자|후보자|이력서|레퍼럴|입사자|신규\s*입사|입사|신입|경력직|오퍼|jd\b|포지션/i, 4]],
  docs: [[/로드맵|초안|문서|자료|노션|위키|링크|슬라이드|보고서|기획서|스펙|명세|prd|가이드|매뉴얼|회의록|정리본|시트|엑셀|드라이브/i, 3]],
  approval: [[/결재|품의|기안|승인\s*(부탁|요청|해|좀)|전결|지출\s*결의|비용\s*처리|정산/, 5]],
  availability: [[/시간\s*(되|괜찮|있으|있나|있어|가능)|잠깐\s*(얘기|이야기|통화|대화|시간|볼)|통화\s*(가능|되|할)|허들\s*(가능|할|해)|지금\s*(바쁘|가능|괜찮|되세요)|바쁘세요|자리에\s*계/, 6]],
  help: [[/도와|도움|막혔|막혀|모르겠|헷갈|어떻게\s*하는|방법\s*(이|좀|알)|해결이\s*안|감이\s*안/, 4]],
  health: [[/아파|아프|병원|감기|몸살|두통|컨디션|열이\s*(나|있)|코로나|독감|약\s*(먹|드)|목이\s*(아|부)|몸이\s*(안\s*좋|좀|별로|무거)|안\s*좋아서|배탈|체했/, 5]],
  hobby: [[/넷플릭스|드라마|영화|볼\s*만한|시리즈|웹툰|플리|플레이리스트|음악|노래|책\s*(추천|읽)|읽을\s*만한|독서|러닝|달리기|운동|헬스|등산|클라이밍|요가|보드게임|게임|동호회|전시|공연|콘서트/, 5]],
  office: [[/프린터|택배|에어컨|난방|주차|사무실|와이파이|wifi|모니터|노트북|키보드|자리\s*(배치|이동)|청소|라운지|엘리베이터|출입\s*카드|사원증|고장|수리/i, 5]],
}

const ACTS: Record<Exclude<Act, 'question' | 'statement'>, RegExp> = {
  greeting: /^(안녕|좋은\s*아침|굿모닝|굿모닝|하이\b|하이~|hello|hi\b|헬로|반갑|여러분\s*안녕|다들\s*안녕|좋은\s*오후|좋은\s*저녁)/i,
  thanks: /감사|고마|땡큐|thx|thanks|thank you|thank u|🙏|덕분에/i,
  apology: /죄송|미안|송구|sorry|양해\s*부탁/i,
  congrats: /축하|congrat|🎉🎉|짝짝|👏👏/i,
  goodnews: /성공했|돌파|달성했|달성!|합격|승진|계약\s*(성사|체결|따|했)|따냈|런칭했|출시했|오픈했|해냈|수상|1등|신기록|통과했|머지됐|배포\s*완료|드디어\s*(끝|완료|됐)|클로징|closed/i,
  farewell: /퇴근\s*(합니다|할게|하겠|해요|하세요|했)|먼저\s*(들어가|가보|갈게|퇴근)|내일\s*(봬|뵙|봐요|만나)|굿나잇|좋은\s*밤|들어가\s*(보겠|볼게|볼께|겠습니다)|들어갈게|퇴근각/,
  praise: /고생\s*(많|하셨|하셨어|했어)|수고\s*(많|하셨)|덕분에\s*(잘|무사|성공)|잘\s*해\s*주셨|멋졌|최고였|애쓰셨/,
  request: /부탁|해\s*주세요|해주세요|해\s*줄\s*수|해주실|주실\s*수|줄\s*수\s*있|해줘|해줄래|주세요|봐\s*주|봐주|확인\s*(좀|부탁|해)|추천\s*(좀|해|받|부탁|해주)|추천받|알려\s*주|알려주|공유\s*(좀|부탁|해주)|가능할까요|가능하실까요|해\s*주실|챙겨\s*주|도와\s*주|도와주/,
  opinion: /어때요|어떠세요|어떨까요|어떤가요|어때\?|어떻게\s*생각|의견|피드백|괜찮을까요|괜찮나요|좋을까요|나을까요|뭐가\s*(좋|나)|어느\s*(쪽|게|것)/,
  proposal: /아이디어|제안|는\s*거\s*어때|는\s*건\s*어때|는\s*게\s*어때|해보면|해\s*보면|해보는\s*거|해보는\s*건|하면\s*어떨|하는\s*건\s*어때|도입하|도입해|바꿔\s*보|바꿔보|시도해|해볼까요|해\s*볼까요|하면\s*좋을\s*것\s*같/,
  announce: /공지|안내\s*(드|합|해)|알려\s*드|알려드|공유\s*드립|공유드립|공유합니다|공유해요|참고\s*(부탁|해\s*주|하세요|바랍)|예정입니다|진행합니다|진행할\s*예정|시작합니다|완료했습니다|완료했어요|올렸습니다|올렸어요|업데이트했|배포합니다|배포했|변경되었|변경됐|확정됐|확정되었|📢|📌|리마인드/,
  tired: /피곤|힘들|힘드|졸려|졸리|지친|지쳤|번아웃|멘붕|죽겠|ㅠㅠ|ㅜㅜ|하기\s*싫|월요병|(퇴근|집에\s*가|자)고\s*싶|싶다\s*\.{2,}|😭|😩|🥲/,
  laugh: /^[ㅋㅎ]{2,}|ㅋㅋㅋ|ㅎㅎㅎ|😂|🤣|웃기|빵\s*터/,
  ack: /^(넵|네|넹|녜|예|ok|오케이|오키|확인했|확인입니다|알겠|좋아요|좋습니다|굿|👍|콜|ㅇㅋ|그래요|그럽시다|그러죠|동의|맞아요|맞습니다)/i,
  cancel: /취소|연기|미뤄|미룰|다음으로\s*(미|옮)|못\s*(갈|가|하|할)|불참|빠질게|빠져야/,
}

const WH = /뭐|뭘|무엇|무슨|언제|어디|누가|누구|왜|몇|어떻게|어떤|얼마|어느|어때|어떠|어떨/
const Q_END = /(\?|까요|까\?|(있|없|하|되|했|됐|았|었|였|는|시|가|오|맞|좋|괜찮|많|싫|셨|겠)나요|나\?|가요\?|인가|ㄴ가요|는지|을지|ㄹ지|세요\?|셨어요\?|셨나요|하셨|드셨|되세요|계세요|있으세요|가능해요\?|돼요\?|되나요|될까|맞나요|맞죠|죠\?|요\?)\s*[~!.]*\s*$/
const YOU = /(으)?세요\?|셨어요|셨나요|셨죠|하셨|드셨|가셨|오셨|계세요|계신|있으세요|되세요|가세요|하세요\?|하실|드실|가실|오실|되실|보실|늦으|아프세요|괜찮으세요|어떠세요|님은|님도/
const SELF = /^(저|제가|저는|전\s|저도|저희|제\s)|\s(저|제가|저는|저도)\s|나\s?오늘|(할게요|갈게요|하겠습니다|갑니다|예요|이에요|입니다)\s*[~!.🙏😊]*$/
const TO_ALL = /다들|여러분|모두|혹시\s*(누구|아시는|계신)|@(here|channel|everyone)|누구\s*(있|계|가)|분\s*(있|계|구)|분\?|분~|실\s*분|하실\s*분|가실\s*분|드실\s*분/
const URGENT = /급해|급합|긴급|asap|빨리|당장|지금\s*바로|🚨|🔥/i
const HOWTO = /어떻게|방법|어디서|어디에서|어디로|절차|신청/
const WHEN = /언제|몇\s*시|며칠|무슨\s*요일|시간이|일정/

export function classify(raw: string, mentionNames: string[] = []): Intent {
  let t = plain(raw)
  for (const n of mentionNames) t = t.split(`@${n}`).join(' ')
  t = t.replace(/@\S+/g, ' ').replace(/#[\w가-힣-]+/g, ' ').replace(/\s+/g, ' ').trim()
  // "늦게 봤어요" / "답이 늦었네요" is about replying late, not commuting late
  const low = t.toLowerCase().replace(/늦게\s*(봤|봐|확인|답|읽|드려|드렸|연락)|(답|답장|회신|연락)(이|을|도)?\s*(좀\s*)?늦/g, ' ')

  // topic scoring
  let topic: Topic = 'none'
  let topicScore = 0
  for (const [k, pats] of Object.entries(TOPICS) as [Exclude<Topic, 'none'>, P[]][]) {
    let s = 0
    for (const [re, w] of pats) {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
      const hits = low.match(g)
      if (hits) s += w + (hits.length - 1)
    }
    if (s > topicScore) {
      topicScore = s
      topic = k
    }
  }
  // disambiguation: "점심 회의" → meeting; "커피챗" → coffee; "회식 메뉴" → dinner
  const has = (k: Exclude<Topic, 'none'>) => TOPICS[k].some(([re]) => re.test(low))
  if (topic === 'food' && has('dinner')) topic = 'dinner'
  if (topic === 'food' && has('coffee') && !/점심|저녁|메뉴/.test(low)) topic = 'coffee'
  // "커피 한잔 하실래요?" is coffee, not drinks after work
  if (topic === 'dinner' && has('coffee') && !/회식|술|맥주|소주|와인|치맥|뒤풀이|🍻|🍺/.test(low)) topic = 'coffee'
  if ((topic === 'incident' || topic === 'docs') && has('review') && /리뷰|pr\b/i.test(low)) topic = 'review'
  if (topic === 'docs' && has('design')) topic = 'design'
  if (topic === 'late' && has('meeting') && !/지각|출근|지하철|버스|막혀|막혔/.test(low)) topic = 'meeting'
  if (topic === 'offwork' && has('late')) topic = 'late'
  if (topic === 'meeting' && /고장|에어컨|난방|수리|프린터|청소|와이파이/.test(low)) topic = 'office'
  if (topic === 'deadline' && /회고|플래닝|데모\s*데이|킥오프|미팅|회의/.test(low) && !/언제까지|마감|기한/.test(low)) topic = 'meeting'

  const acts: Act[] = []
  for (const [k, re] of Object.entries(ACTS) as [Act, RegExp][]) if (re.test(t)) acts.push(k)
  if (acts.includes('greeting') && acts.includes('farewell')) acts.splice(acts.indexOf('greeting'), 1)
  // "축하해요 @지우 승진!" congratulates someone else — it isn't the author's own good news
  if (acts.includes('congrats') && acts.includes('goodnews') && /축하|congrat/i.test(t)) acts.splice(acts.indexOf('goodnews'), 1)

  const question = /\?/.test(t) || Q_END.test(t) || (WH.test(t) && /요|까|나|니|지/.test(t.slice(-3)))
  if (question) acts.push('question')
  const yesno = question && !WH.test(t)
  const youRef = YOU.test(t) && !/^(저|제가)\s/.test(t)
  const selfRef = SELF.test(t)
  const toAll = TO_ALL.test(t) || /@(here|channel|everyone)/.test(raw)

  let primary: Act = 'statement'
  const pri: Act[] = ['request', 'proposal', 'opinion', 'question', 'cancel', 'goodnews', 'congrats', 'apology', 'farewell', 'praise', 'thanks', 'greeting', 'announce', 'tired', 'laugh', 'ack']
  // a short greeting/thanks with no substance wins over a trailing question ("안녕하세요~ 잘 지내셨어요?")
  // "다들 고생 많으셨어요 🙏" is praise even though 🙏 also reads as thanks
  if (acts.includes('praise') && !acts.includes('request') && !acts.includes('question') && !acts.includes('goodnews')) primary = 'praise'
  else if (acts.includes('thanks') && !acts.includes('request') && !acts.includes('question')) primary = 'thanks'
  else if (acts.includes('apology') && !acts.includes('request') && !acts.includes('question')) primary = 'apology'
  else if (acts.includes('greeting') && topic === 'none' && t.length < 22 && !acts.includes('request')) primary = 'greeting'
  else if (acts.includes('farewell') && !acts.includes('request') && !acts.includes('question')) primary = 'farewell'
  else if (acts.includes('praise') && !acts.includes('request') && !acts.includes('question') && !acts.includes('goodnews')) primary = 'praise'
  else if (acts.includes('goodnews') && !acts.includes('question')) primary = 'goodnews'
  else if (acts.includes('congrats') && !acts.includes('question')) primary = 'congrats'
  else primary = pri.find((a) => acts.includes(a)) ?? 'statement'
  // "메뉴 추천 받습니다" is effectively a question to the room
  if (primary === 'ack' && t.length > 14) primary = 'statement'
  if (primary === 'laugh' && t.replace(/[ㅋㅎ\s😂🤣!~.]/g, '').length > 10) primary = acts.includes('question') ? 'question' : 'statement'

  const pos = /좋|최고|대박|굿|감사|축하|행복|신나|완벽|멋지|짱|👍|🎉|🔥|😍|❤️|🙌/.test(t)
  const neg = /싫|최악|힘들|아파|짜증|망했|ㅠ|ㅜ|문제|에러|장애|실패|안\s*돼|느려|걱정/.test(t)

  const ideas = /아이디어\s*(있|좀|주|부탁|모아|구해)|좋은\s*방법|어떻게\s*하면\s*(좋|될|줄|늘|올)|방안\s*(있|좀)|해결책/.test(t)
  return {
    text: t,
    topic,
    topicScore,
    acts,
    primary,
    question,
    yesno,
    youRef,
    selfRef,
    toAll,
    urgent: URGENT.test(raw),
    howTo: HOWTO.test(t),
    when: WHEN.test(t),
    ideas,
    link: /https?:\/\//.test(raw),
    offer: /(제가|저희가|내가)\s.{0,24}(할까요|드릴까요|볼까요|둘까요|놓을까요|갈까요|올까요|잡을까요|챙길까요|정리할까요|준비할까요|맡을까요)\s*[?~!.]*$/.test(t),
    lend: !ideas && /빌려\s*주|빌릴\s*수|빌려도|남는\s*거|여분|가지고\s*계신|있으신\s*분/.test(t),
    feedback:
      /의견|피드백|코멘트|검토|리뷰\s*(부탁|해\s*주)|봐\s*주세요|봐주세요|읽어\s*봐/.test(t) ||
      (/정리했|올렸|공유|작성했|썼|만들었|업데이트했/.test(t) && /확인\s*(부탁|해\s*주|좀)/.test(t)),
    sentiment: pos && !neg ? 'pos' : neg && !pos ? 'neg' : 'neutral',
  }
}
