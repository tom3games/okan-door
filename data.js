// 文言・手口・判定表。仕様の正本は ~/Desktop/claudecode/ideas/okan-door.md
// 手口（tactic）は「見た目の言い訳」と「本当にやること（intent）」を分けて持つ。同じ台詞でも intent が違えば正解が違う。
// 正解は乱数でなく、足音・ドアの下の影・ドアノブの動きで読める（tells）。
window.OD = (function () {
  // 本当にやること
  // CALL 声をかけたいだけ / RUSH 押し入る / PEEK そっとのぞく / LURE 出てこさせる / KEY 合鍵 / LADDER 窓から / GRANNY ばあちゃん
  // tells: steps 足音, shadow 影, knob ドアノブ, snd 2つ目の音
  const TELLS = {
    CALL:   { steps: 'normal', shadow: 'center', knob: 'still' },
    RUSH:   { steps: 'heavy',  shadow: 'big',    knob: 'rattle' },
    PEEK:   { steps: 'tiptoe', shadow: 'center', knob: 'slow' },
    LURE:   { steps: 'normal', shadow: 'aside',  knob: 'still' },
    KEY:    { steps: 'normal', shadow: 'low',    knob: 'key' },
    LADDER: { steps: null,     shadow: null,     knob: 'still', window: true },
    GRANNY: { steps: 'shuffle', shadow: 'small', knob: 'slow' },
  }
  // 手口。line は ja/en の組。pose は入ってきた時・見えた時の切り絵
  const TACTICS = {
    knock:       { intent: 'CALL', pose: 'm_knock', snd: 'knock', lines: [['おーい、起きてるー？', 'Hey, you awake?'], ['返事だけしてやー', 'Just answer me!'], ['ちょっとええかー？', 'Got a sec?']] },
    gohan_call:  { intent: 'CALL', pose: 'm_tray', snd: 'dish', lines: [['ご飯できたよー', "Dinner's ready!"]] },
    laundry_call:{ intent: 'CALL', pose: 'm_laundry', snd: 'cloth', lines: [['洗濯物置いとくでー', "Leaving your laundry!"]] },
    teacher:     { intent: 'CALL', pose: 'm_phone', snd: 'ring', lines: [['先生から電話やでー', "Your teacher's on the phone!"]] },
    gohan_peek:  { intent: 'PEEK', pose: 'm_peek', snd: 'dish', lines: [['ご飯できたよー', "Dinner's ready!"]] },
    laundry_peek:{ intent: 'PEEK', pose: 'm_laundry', snd: 'cloth', lines: [['洗濯物置いとくでー', "Leaving your laundry!"]] },
    knock_peek:  { intent: 'PEEK', pose: 'm_peek', snd: null, lines: [['おーい、起きてるー？', 'Hey, you awake?']] },
    cat:         { intent: 'PEEK', pose: 'm_cat', snd: 'meow', cat: true, lines: [['猫ちゃん迎えに入るでー', "Just getting the cat!"]] },
    vacuum:      { intent: 'RUSH', pose: 'm_vacuum', snd: 'vacuum', taps: 12, lines: [['掃除機かけるでー！', 'Vacuum time!'], ['ホコリが呼んでるわー！', 'The dust is calling!']] },
    vacuum_lie:  { intent: 'RUSH', pose: 'm_vacuum', snd: 'vacuum', taps: 12, lines: [['ご飯できたよー', "Dinner's ready!"]] },
    dad:         { intent: 'RUSH', pose: 'dad', snd: 'grunt', taps: 17, dad: true, lines: [['父さんは味方やで', "Dad's on your side."]] },
    lure:        { intent: 'LURE', pose: 'm_delivery', snd: null, lines: null },
    key:         { intent: 'KEY', pose: 'm_key', snd: 'jingle', taps: 6, lines: [['あ、鍵あったわ', 'Oh, found the key.'], ['合鍵って便利やなー', 'Spare keys are great.']] },
    ladder:      { intent: 'LADDER', pose: 'm_ladder', snd: 'clank', lines: [['ベランダから失礼', 'Coming via balcony!']] },
    granny:      { intent: 'GRANNY', pose: 'grandma', snd: null, lines: [['ばあちゃんやでー', "It's Grandma!"]] },
  }
  // 出てこさせる言い訳。時間がたつほど雑になる
  const LURES = [
    ['宅配便でーす', 'Delivery!'],
    ['ガチャ当たってたでー', 'You won a gacha!'],
    ['なんか焦げ臭くない？', 'Smell something burning?'],
    ['外にパンダおるで', "There's a panda outside."],
    ['UFO来てるで', 'A UFO is here.'],
  ]
  // 守り方と結果。kind: perfect 完璧 / ok しのいだ / breach 入られた / push 押し合い
  const DEF = ['hold', 'sleep', 'reply', 'hide']
  const RES = {
    CALL:   { reply: ['perfect', ['ほな置いとくでー', "Okay, leaving it here."]], hold: ['ok', ['押さえんでも入らんて', "I'm not coming in!"]], sleep: ['breach', ['返事ないやん！大丈夫！？', 'No answer? You okay?!']], hide: ['breach', ['おらん！？どこ行った！', "Where'd he go?!"]], none: ['breach', ['返事くらいしー！', 'At least answer me!']] },
    RUSH:   { hold: ['push', null], sleep: ['breach', ['寝てても掃除はするで', "Asleep? Still vacuuming."]], reply: ['breach', ['ええとこ悪いなー！', 'Sorry to interrupt!']], hide: ['breach', ['ベッドの下におった！', 'Found you under the bed!']], none: ['breach', ['おじゃましまーす！', 'Coming in!']] },
    PEEK:   { sleep: ['perfect', ['寝てるわ…', "He's asleep..."]], hold: ['ok', ['…開かへん', "...It won't open."]], reply: ['breach', ['起きてるやん！入るで', "You're up! Coming in."]], hide: ['breach', ['おらん！？えらいこっちゃ', "Gone?! Oh no!"]], none: ['breach', ['ゲームしてるやん！', "You're gaming!"]] },
    LURE:   { sleep: ['perfect', ['…寝てるんかい', '...Asleep, huh.']], hold: ['ok', ['…出てこーへん', "...He won't come out."]], hide: ['ok', ['…出てこーへん', "...He won't come out."]], none: ['ok', ['…出てこーへん', "...He won't come out."]], reply: ['breach', ['起きてるやん！開けて！', "You're up! Open up!"]] },
    KEY:    { hide: ['perfect', ['あれ？おらん…', 'Huh? Not here...']], hold: ['push', null], sleep: ['breach', ['寝顔見に来たでー', 'Came to see you sleep!']], reply: ['breach', ['起きてるやん！', "You're awake!"]], none: ['breach', ['開いたー！', "It's open!"]] },
    LADDER: { hide: ['perfect', ['…おらんな', '...Not here.']], hold: ['breach', ['窓は押さえてへんやろ', "Didn't hold the window!"]], sleep: ['breach', ['窓から失礼するで', 'Pardon the window!']], reply: ['breach', ['窓から失礼するで', 'Pardon the window!']], none: ['breach', ['窓から失礼するで', 'Pardon the window!']] },
  }
  const PUSH_WIN = { RUSH: ['くっ…硬い！', "Ugh... it won't budge!"], KEY: ['鍵開けたのに！', 'I unlocked it!'] }
  const PUSH_LOSE = { RUSH: ['勝ったでー！', 'I win!'], KEY: ['ほら開いた', 'See? Open.'] }
  const DAD_WIN = ['…ばれたか', '...Busted.']
  const TIRED = ['腕が限界…', 'Arms... gone...']
  const SLEEP3 = ['ずっと寝てるやん！熱ある？', 'Always asleep?! Fever?']
  const GRANNY_IN = ['ばあちゃんに鍵は関係ないで', 'Locks mean nothing to Grandma.']
  const REPLY = ['今いい所！', 'Not now!']
  const SNORE = ['ぐー…', 'Zzz...']
  const NIGHT = ['おやすみ。置いとくで', 'Night. Left you something.']
  const MEMO = ['冷めても\n食べなさい', 'Eat it\neven if cold.']
  // 称号（点の高い順）
  const TITLES = [
    [28, ['鉄壁の部屋の主', 'Master of the Room']],
    [22, ['ドアの番人', 'Door Guardian']],
    [15, ['なかなかの籠城', 'Decent Siege']],
    [8, ['わりと開けっぱなし', 'Kinda Wide Open']],
    [0, ['おかんの完勝', "Mom's Total Win"]],
  ]
  // おかんの一言（連絡ノート）。守られるほど悔しがるが、どれも心配している
  const NOTE = [
    [28, ['今日は一回も顔見られへんかった。\n手ごわい', "Didn't see your face once today. Tough one."]],
    [22, ['ドアが強なってる。\n明日は作戦変えるわ', 'That door got stronger. New plan tomorrow.']],
    [15, ['ちょっとだけ顔見れて\n安心した', 'Saw your face a little. Good enough.']],
    [0, ['今日はよう顔見れたわ。\nありがとう', 'Saw you a lot today. Thanks.']],
  ]
  const T = {
    title1: ['おかんを', 'Keep Mom'], title2: ['部屋に入れるな', 'Out of My Room'],
    sub: ['朝7時から夜10時まで、ドアを守れ', 'Guard the door from 7am to 10pm'],
    start: ['はじめる', 'Start'], how: ['遊び方', 'How to play'], lang: ['English', '日本語'],
    boot: ['おかんが階段を上がってくる', 'Mom is coming upstairs'],
    hold: ['押さえる', 'Hold'], sleep: ['寝たふり', 'Fake sleep'], reply: ['返事', 'Answer'], hide: ['隠れる', 'Hide'],
    mash: ['連打！', 'Mash!'],
    perfect: ['完璧', 'PERFECT'], ok: ['しのいだ', 'HELD'], breach: ['入られた', "SHE'S IN"], granny: ['ノーカン', 'NO COUNT'],
    tut1: ['ノックだけ。返事しとこ', 'Just a knock. Answer.'],
    tut2: ['ガチャガチャ！押さえて', 'Rattling! Hold it.'],
    tut3: ['そーっと回る。寝たふり', 'Slow handle. Fake sleep.'],
    tutGo: ['あとは自分で読め', "You're on your own now"],
    skip: ['とばす', 'Skip'],
    again: ['もう一回', 'Play again'], save: ['画像を保存', 'Save image'], post: ['Xでポスト', 'Post on X'],
    close: ['閉じる', 'Close'], privacy: ['プライバシーについて', 'Privacy'],
    noteHead: ['家族の連絡ノート', 'Family Notebook'],
    held: ['守り切った', 'Held'], got: ['入られた', 'Got in'], gran: ['ばあちゃん', 'Grandma'], title: ['称号', 'Title'],
    mom: ['おかんより', 'From Mom'],
    shareTail: ['#おかんを部屋に入れるな #バカゲー', '#KeepMomOut #bakage'],
  }
  const HOWTO = {
    ja: [
      ['ノックだけ・影がじっと', '返事'],
      ['ノブがガチャガチャ', '押さえて連打'],
      ['忍び足・ノブがゆっくり', '寝たふり'],
      ['影がドアの横へ消える', '寝たふり（無視）'],
      ['鍵の音・影が低い', '隠れる'],
      ['窓の外で物音', '隠れる'],
    ],
    en: [
      ['Knock, shadow stays still', 'Answer'],
      ['Handle rattles', 'Hold + mash'],
      ['Tiptoes, handle turns slowly', 'Fake sleep'],
      ['Shadow slips aside', 'Fake sleep (ignore)'],
      ['Keys jingle, shadow low', 'Hide'],
      ['Noise at the window', 'Hide'],
    ],
    lead: ['台詞はうそをつく。見るのは足元の影とドアノブ', 'Mom lies. Watch the shadow under the door and the handle.'],
    warn: ['押さえすぎると腕が限界。寝たふりを続けると心配される', 'Hold too often and your arms give out. Sleep too much and Mom worries.'],
  }
  return { TELLS, TACTICS, LURES, DEF, RES, PUSH_WIN, PUSH_LOSE, DAD_WIN, TIRED, SLEEP3, GRANNY_IN, REPLY, SNORE, NIGHT, MEMO, TITLES, NOTE, T, HOWTO }
})()
