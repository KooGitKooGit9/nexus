export interface EmojiEntry {
  e: string
  k: string // search keywords (ko + en)
}
export interface EmojiCategory {
  id: string
  label: string
  icon: string
  items: EmojiEntry[]
}

function parse(src: string): EmojiEntry[] {
  return src
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.indexOf(':')
      return { e: s.slice(0, i), k: s.slice(i + 1) }
    })
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys', label: '스마일리', icon: '😀',
    items: parse(`😀:웃음 smile grin|😃:웃음 행복 happy|😄:웃음 기쁨 joy|😁:활짝 grin|😆:빵터짐 laugh|😅:식은땀 sweat|🤣:데굴데굴 rofl|😂:눈물 웃음 lol joy|🙂:미소 slight smile|🙃:거꾸로 upside|😉:윙크 wink|😊:수줍 blush|😇:천사 angel|🥰:사랑 love hearts|😍:하트눈 heart eyes|🤩:반함 star struck|😘:뽀뽀 kiss|😋:맛있 yum|😛:메롱 tongue|😜:장난 wink tongue|🤪:미침 zany|🤗:포옹 hug|🤭:웁스 oops|🤫:쉿 shh|🤔:생각 think|🤐:입다물 zip|🤨:의심 raised eyebrow|😐:무표정 neutral|😑:노코멘트 expressionless|😶:말없음 silent|😏:흐흐 smirk|😒:시큰둥 unamused|🙄:어이없 eye roll|😬:어색 grimace|😌:안도 relieved|😔:우울 pensive|😪:졸림 sleepy|😴:잠 sleep|😷:마스크 sick mask|🤒:아픔 fever|🤯:머리폭발 mind blown|🥳:파티 party|😎:선글라스 cool|🤓:공부 nerd|🧐:관찰 monocle|😕:혼란 confused|😟:걱정 worried|😮:놀람 wow|😲:깜짝 astonished|🥺:부탁 pleading|😢:슬픔 cry|😭:엉엉 sob|😱:비명 scream|😤:씩씩 triumph|😡:화남 angry|🤬:욕 cursing|😈:악마 devil|💀:해골 skull dead|💩:똥 poop|🤡:광대 clown|👻:유령 ghost|👽:외계인 alien|🤖:로봇 robot bot|😺:고양이 cat`),
  },
  {
    id: 'people', label: '사람 & 제스처', icon: '👋',
    items: parse(`👋:안녕 wave hi|🤚:손 raised hand|✋:손들기 hand|🖖:벌칸 vulcan|👌:오케이 ok|🤌:이탈리안 pinched|🤏:조금 pinch|✌️:브이 peace|🤞:행운 fingers crossed|🤟:사랑해 love you|🤘:락 rock|🤙:전화 call|👈:왼쪽 left|👉:오른쪽 right|👆:위 up|👇:아래 down|☝️:하나 one|👍:좋아요 thumbs up like yes|👎:싫어요 thumbs down no|✊:주먹 fist|👊:펀치 punch|🤛:주먹인사 fist bump|👏:박수 clap|🙌:만세 hooray raise|👐:펼친손 open hands|🤲:두손 palms|🤝:악수 handshake deal|🙏:감사 부탁 pray thanks please|✍️:작성 writing|💅:네일 nail|💪:힘 근육 muscle strong|🧠:뇌 brain|👀:눈 보는중 eyes look|👁️:눈 eye|🫡:경례 salute|🫶:하트손 heart hands|🙋:손들기 raising hand|🙆:오케이 ok gesture|🙅:안돼 no gesture|🤷:몰라 shrug|🤦:아이고 facepalm|🙇:꾸벅 bow|💁:안내 info|🧑‍💻:개발자 developer coder|👩‍🎨:디자이너 artist|🧑‍🚀:우주인 astronaut|🥷:닌자 ninja|🧙:마법사 wizard|🦸:히어로 hero|🏃:달리기 run|💃:춤 dance|🕺:춤 dance man`),
  },
  {
    id: 'nature', label: '동물 & 자연', icon: '🐱',
    items: parse(`🐶:강아지 dog|🐱:고양이 cat|🐭:쥐 mouse|🐹:햄스터 hamster|🐰:토끼 rabbit|🦊:여우 fox|🐻:곰 bear|🐼:판다 panda|🐨:코알라 koala|🐯:호랑이 tiger|🦁:사자 lion|🐮:소 cow|🐷:돼지 pig|🐸:개구리 frog|🐵:원숭이 monkey|🙈:안봐 see no evil|🐔:닭 chicken|🐧:펭귄 penguin|🐦:새 bird|🦄:유니콘 unicorn|🐝:벌 bee|🦋:나비 butterfly|🐢:거북이 turtle slow|🐍:뱀 snake python|🐙:문어 octopus github|🦀:게 crab rust|🐳:고래 whale docker|🐬:돌고래 dolphin|🦈:상어 shark|🌵:선인장 cactus|🌲:나무 tree|🌱:새싹 seedling grow|🍀:네잎클로버 luck|🍁:단풍 maple autumn|🍂:낙엽 fall|🌸:벚꽃 cherry blossom|🌹:장미 rose|🌻:해바라기 sunflower|🌈:무지개 rainbow|☀️:해 sun|🌤️:맑음 sunny|⛅:구름 cloud|🌧️:비 rain|⛈️:천둥 storm|❄️:눈 snow|🔥:불 fire hot lit|💧:물 drop|🌊:파도 wave|⚡:번개 빠름 zap lightning fast|🌙:달 moon night|⭐:별 star|🌟:반짝 glowing star|✨:반짝반짝 sparkles|☄️:혜성 comet|🌍:지구 earth globe|🪐:행성 planet`),
  },
  {
    id: 'food', label: '음식', icon: '🍔',
    items: parse(`🍎:사과 apple|🍊:귤 orange|🍋:레몬 lemon|🍌:바나나 banana|🍉:수박 watermelon|🍇:포도 grape|🍓:딸기 strawberry|🍑:복숭아 peach|🥑:아보카도 avocado|🌶️:고추 pepper spicy|🌽:옥수수 corn|🥕:당근 carrot|🍞:빵 bread|🥐:크루아상 croissant|🧀:치즈 cheese|🥚:계란 egg|🍳:요리 cooking|🥓:베이컨 bacon|🍔:햄버거 burger|🍟:감자튀김 fries|🍕:피자 pizza|🌭:핫도그 hotdog|🌮:타코 taco|🥗:샐러드 salad|🍝:파스타 pasta|🍜:라면 쌀국수 ramen noodle|🍲:찌개 국밥 stew|🍛:카레 curry|🍣:초밥 sushi|🍱:도시락 bento lunch|🥟:만두 dumpling|🍤:새우튀김 tempura|🍙:주먹밥 rice ball|🍚:밥 rice|🥩:고기 meat steak|🍗:치킨 chicken|🍰:케이크 cake|🎂:생일케이크 birthday|🧁:컵케이크 cupcake|🍩:도넛 donut|🍪:쿠키 cookie|🍫:초콜릿 chocolate|🍦:아이스크림 ice cream|☕:커피 coffee|🍵:차 tea|🧋:버블티 boba|🥤:음료 drink|🍺:맥주 beer|🍻:건배 cheers|🥂:샴페인 toast|🍷:와인 wine|🍾:샴페인 champagne celebrate|🍶:소주 sake soju`),
  },
  {
    id: 'activity', label: '활동', icon: '⚽',
    items: parse(`⚽:축구 soccer|🏀:농구 basketball|🏈:미식축구 football|⚾:야구 baseball|🎾:테니스 tennis|🏐:배구 volleyball|🏓:탁구 ping pong|🏸:배드민턴 badminton|⛳:골프 golf|🎯:목표 다트 target goal|🎳:볼링 bowling|🏆:트로피 우승 trophy win|🥇:금메달 gold first|🥈:은메달 silver|🥉:동메달 bronze|🏅:메달 medal|🎖️:훈장 military medal|🎮:게임 game|🕹️:조이스틱 joystick|🎲:주사위 dice random|🧩:퍼즐 puzzle|♟️:체스 chess|🎨:그림 디자인 art design palette|🎬:영화 촬영 movie clapper|🎤:마이크 mic|🎧:헤드폰 허들 headphones|🎸:기타 guitar|🎹:피아노 piano|🥁:드럼 drum|🎉:축하 파티 tada party congrats|🎊:컨페티 confetti|🎈:풍선 balloon|🎁:선물 gift|🎄:크리스마스 christmas|🎃:할로윈 halloween|🎆:불꽃놀이 fireworks|🧘:요가 명상 yoga|🏋️:운동 weight|🚴:자전거 bike|🏊:수영 swim|⛷️:스키 ski|🏄:서핑 surf`),
  },
  {
    id: 'travel', label: '여행 & 장소', icon: '✈️',
    items: parse(`🚗:자동차 car|🚕:택시 taxi|🚌:버스 bus|🚇:지하철 metro|🚄:기차 ktx train|✈️:비행기 출장 plane travel|🛫:출발 departure|🛬:도착 arrival|🚀:로켓 출시 rocket launch ship|🛸:UFO ufo|🚁:헬기 helicopter|⛵:요트 sailboat|🚢:배 ship|🏠:집 재택 home house|🏢:사무실 빌딩 office building|🏥:병원 hospital|🏦:은행 bank|🏫:학교 school|🏰:성 castle|🗼:타워 tower|🗽:자유의여신상 liberty|🗻:후지산 mountain|⛰️:산 mountain|🏖️:해변 beach|🏝️:섬 island|🏕️:캠핑 camping|🌋:화산 volcano|🌅:일출 sunrise|🌇:노을 sunset city|🌃:야경 night|🌉:다리 bridge|🎡:관람차 ferris|🎢:롤러코스터 rollercoaster|🗺️:지도 map|🧭:나침반 compass|⛽:주유 fuel|🚦:신호등 traffic|🚧:공사중 construction wip`),
  },
  {
    id: 'objects', label: '사물', icon: '💡',
    items: parse(`💡:아이디어 전구 idea bulb|🔦:손전등 flashlight|💻:노트북 laptop|🖥️:모니터 desktop|⌨️:키보드 keyboard|🖱️:마우스 mouse|📱:휴대폰 phone|☎️:전화 telephone|📷:카메라 camera|🎥:비디오 video|📺:TV tv|⏰:알람 alarm|⏳:모래시계 hourglass wait|⌛:시간 time|📅:달력 calendar|🗓️:일정 schedule|📆:캘린더 calendar|📌:핀 고정 pin|📍:위치 location|📎:클립 첨부 clip|✂️:가위 scissors|📝:메모 memo note|✏️:연필 pencil edit|🖊️:펜 pen|📖:책 book|📚:책들 books|📓:노트 notebook|📒:장부 ledger|📊:차트 chart bar|📈:상승 chart up growth|📉:하락 chart down|📋:클립보드 clipboard|📁:폴더 folder|🗂️:파일 files|🗑️:휴지통 trash|🔒:잠금 lock private|🔓:열림 unlock|🔑:열쇠 key|🔨:망치 hammer|🛠️:도구 tools|⚙️:설정 gear settings|🧪:실험 test lab|🔬:현미경 microscope|🔭:망원경 telescope|💊:약 pill|💰:돈 money|💸:돈날개 money wings|💳:카드 card|💎:보석 gem|📦:패키지 배송 package box|✉️:편지 메일 mail|📣:확성기 megaphone|📢:공지 loudspeaker|🔔:알림 bell|🔕:음소거 mute|🧯:소화기 extinguisher|🪄:마법봉 magic`),
  },
  {
    id: 'symbols', label: '기호', icon: '❤️',
    items: parse(`❤️:하트 사랑 heart love red|🧡:주황하트 orange heart|💛:노랑하트 yellow heart|💚:초록하트 green heart|💙:파랑하트 blue heart|💜:보라하트 purple heart|🖤:검정하트 black heart|🤍:흰하트 white heart|💔:상처 broken heart|💕:두하트 hearts|💖:반짝하트 sparkling heart|💯:백점 100 perfect|💢:화남 anger|💥:쾅 boom|💫:어지러움 dizzy|💬:말풍선 speech|💭:생각풍선 thought|💤:졸림 zzz|✅:완료 체크 done check yes|☑️:체크박스 checkbox|✔️:체크 check|❌:취소 x no|❎:엑스 cross|➕:더하기 plus|➖:빼기 minus|❓:질문 question|❗:느낌표 exclamation|‼️:중요 bangbang|⚠️:경고 warning|🚫:금지 forbidden|⛔:진입금지 no entry|🔴:빨강 red|🟠:주황 orange|🟡:노랑 yellow|🟢:초록 green|🔵:파랑 blue|🟣:보라 purple|⚫:검정 black|⚪:흰색 white|🔺:삼각 up|🔻:역삼각 down|➡️:오른쪽 right arrow|⬅️:왼쪽 left arrow|⬆️:위 up arrow|⬇️:아래 down arrow|🔄:새로고침 refresh|🔁:반복 repeat|🆕:새로운 new|🆗:오케이 ok|🆒:쿨 cool|🆙:업 up|🔝:탑 top|🔜:곧 soon|♻️:재활용 recycle|ℹ️:정보 info|🏁:완주 finish|🚩:깃발 flag|🇰🇷:한국 korea|🇺🇸:미국 usa|🇯🇵:일본 japan|🏳️‍🌈:무지개깃발 pride`),
  },
]

export const ALL_EMOJI: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((c) => c.items)

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉']

export function searchEmoji(q: string, limit = 60): EmojiEntry[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return ALL_EMOJI.filter((x) => x.k.toLowerCase().includes(s) || x.e === s).slice(0, limit)
}

/** First keyword as a display name */
export function emojiName(e: string) {
  const hit = ALL_EMOJI.find((x) => x.e === e)
  return hit ? hit.k.split(' ')[0] : ''
}
