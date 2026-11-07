// 文言・手口・判定表。仕様の正本は ~/Desktop/claudecode/ideas/okan-door.md
// v2: 手口は4つで、守り方と1対1。手口はドアに出る大きな印（tell）1つで必ず分かる。台詞はうそをつくことがあるが、印はうそをつかない
window.OD = (function () {
  // 本当にやること → ドアに出る印 → 正しい守り方
  // RUSH 押し入る: ノブがガチャガチャ → 押さえる（連打）
  // PEEK のぞく: ドアがそーっと少し開いて目 → 寝たふり
  // CALL 声をかける: ノックだけ、ノブは動かない → 返事
  // KEY 合鍵: 鍵穴に鍵が刺さる → 隠れる
  // GRANNY ばあちゃん: 何をしても入る。数えない
  const TELL = { RUSH: 'rattle', PEEK: 'peek', CALL: 'knock', KEY: 'key', GRANNY: 'granny' }
  const ANSWER = { RUSH: 'hold', PEEK: 'sleep', CALL: 'reply', KEY: 'hide' }
  // 手口。lines は ja/en の組。pose は入ってきた時・見えた時の切り絵
  const TACTICS = {
    knock:   { intent: 'CALL', pose: 'm_knock', lines: [['おーい、起きてるー？', 'Hey, you awake?'], ['返事だけしてやー', 'Just answer me!'], ['ちょっとええかー？', 'Got a sec?']] },
    tray:    { intent: 'CALL', pose: 'm_tray', snd: 'dish', lines: [['ご飯できたよー', "Dinner's ready!"]] },
    phone:   { intent: 'CALL', pose: 'm_phone', snd: 'ring', lines: [['おばちゃんから電話やでー', "Auntie's on the phone!"]] },
    vacuum:  { intent: 'RUSH', pose: 'm_vacuum', snd: 'vacuum', taps: 12, lines: [['掃除機かけるでー！', 'Vacuum time!'], ['ホコリが呼んでるわー！', 'The dust is calling!']] },
    dad:     { intent: 'RUSH', pose: 'dad', snd: 'grunt', taps: 16, dad: true, lines: [['父さんは味方やで', "Dad's on your side."]] },
    peek:    { intent: 'PEEK', pose: 'm_peek', lines: [['寝てるかなー…', 'Asleep, maybe...?']] },
    laundry: { intent: 'PEEK', pose: 'm_laundry', snd: 'cloth', lines: [['洗濯物置いとくでー', 'Leaving your laundry!']] },
    cat:     { intent: 'PEEK', pose: 'm_cat', snd: 'meow', cat: true, lines: [['猫ちゃん迎えに来たでー', 'Just getting the cat!']] },
    key:     { intent: 'KEY', pose: 'm_key', lines: [['あ、鍵あったわ', 'Oh, found the key.'], ['合鍵って便利やなー', 'Spare keys are great.']] },
    parcel:  { intent: 'KEY', pose: 'm_delivery', lines: [['宅配便でーす', 'Delivery!']] },
    granny:  { intent: 'GRANNY', pose: 'grandma', lines: [['ばあちゃんやでー', "It's Grandma!"]] },
  }
  // 夕方からの「うその台詞」。印と食い違う。だんだん雑になる
  const FAKES = [
    ['ご飯できたよー', "Dinner's ready!"],
    ['返事だけしてやー', 'Just answer me!'],
    ['ガチャ当たってたでー', 'You won a gacha!'],
    ['外にパンダおるで', "There's a panda outside."],
    ['UFO来てるで', 'A UFO is here.'],
  ]
  const DEF = ['hold', 'sleep', 'reply', 'hide']
  // 結果の台詞。正しい守り方は perfect、それ以外と何もしないは入られる。押し入りを押さえると押し合い（連打）
  const RES = {
    CALL: { reply: ['ほな置いとくでー', "Okay, leaving it here."], hold: ['押さえてるの丸わかりや', "I can tell you're holding it!"], sleep: ['返事ないやん！大丈夫！？', 'No answer? You okay?!'], hide: ['おらん！？どこ行った！', "Where'd he go?!"], none: ['返事くらいしー！', 'At least answer me!'] },
    RUSH: { sleep: ['寝てても掃除はするで', 'Asleep? Still vacuuming.'], reply: ['ええとこ悪いなー！', 'Sorry to interrupt!'], hide: ['ベッドの下も掃除や！', 'Under the bed too!'], none: ['おじゃましまーす！', 'Coming in!'] },
    PEEK: { sleep: ['寝てるわ…', "He's asleep..."], hold: ['押さえてる！起きてるな', "Holding it? You're up!"], reply: ['起きてるやん！入るで', "You're up! Coming in."], hide: ['おらん！？えらいこっちゃ', 'Gone?! Oh no!'], none: ['ゲームしてるやん！', "You're gaming!"] },
    KEY:  { hide: ['あれ？おらん…', 'Huh? Not here...'], hold: ['鍵開いたら押せへんで', "It's unlocked now!"], sleep: ['寝顔見に来たでー', 'Came to see you sleep!'], reply: ['起きてるやん！', "You're awake!"], none: ['開いたー！', "It's open!"] },
  }
  const PUSH_WIN = ['くっ…硬い！', "Ugh... it won't budge!"]
  const PUSH_LOSE = ['勝ったでー！', 'I win!']
  const DAD_WIN = ['…ばれたか', '...Busted.']
  const GRANNY_IN = ['みかん持ってきたでー', 'Brought you a mikan!']
  const REPLY = ['今いい所！', 'Not now!']
  const NIGHT = ['おやすみ。置いとくで', 'Night. Left you something.']
  const MEMO = ['冷めても\n食べなさい', 'Eat it\neven if cold.']
  // 毎回の付箋: 印の名前と、正しい守り方（勝っても負けても出す）
  const STICKY = {
    RUSH: [['ノブがガチャガチャ', 'Handle rattling'], ['＝押し入り。押さえる', '= Barging in. Hold!']],
    PEEK: [['すき間から目', 'Eyes in the gap'], ['＝のぞき。寝たふり', '= Peeking. Fake sleep']],
    CALL: [['ノックだけ', 'Knock, handle still'], ['＝声かけ。返事', '= Just calling. Answer']],
    KEY:  [['鍵穴に鍵', 'Key in the lock'], ['＝合鍵。隠れる', '= Spare key. Hide']],
    GRANNY: [['ばあちゃん', 'Grandma'], ['止められない。数えない', "Unstoppable. Doesn't count"]],
  }
  // ドアの印に重ねる書き文字
  const ONO = { rattle: ['ガチャガチャ', 'RATTLE'], peek: ['じーっ', 'STARE'], knock: ['コンコン', 'KNOCK'], key: ['カチャ', 'CLICK'], granny: ['よっこいしょ', 'OOF'] }
  // 称号（点の高い順。1回3点、11回）
  const TITLES = [
    [30, ['鉄壁の部屋の主', 'Master of the Room']],
    [24, ['ドアの番人', 'Door Guardian']],
    [15, ['なかなかの籠城', 'Decent Siege']],
    [6, ['わりと開けっぱなし', 'Kinda Wide Open']],
    [0, ['おかんの完勝', "Mom's Total Win"]],
  ]
  // おかんの一言（連絡ノート）。守られるほど悔しがるが、どれも心配している
  const NOTE = [
    [30, ['今日は一回も顔見られへんかった。\n手ごわい', "Didn't see your face once today. Tough one."]],
    [24, ['ドアが強なってる。\n明日は作戦変えるわ', 'That door got stronger. New plan tomorrow.']],
    [15, ['ちょっとだけ顔見れて\n安心した', 'Saw your face a little. Good enough.']],
    [0, ['今日はよう顔見れたわ。\nありがとう', 'Saw you a lot today. Thanks.']],
  ]
  const T = {
    title1: ['おかんを', 'Keep Mom'], title2: ['部屋に入れるな', 'Out of My Room'],
    sub: ['ドアを見て、守り方を選べ', 'Watch the door. Pick the defense.'],
    start: ['はじめる', 'Start'], how: ['遊び方', 'How to play'], lang: ['English', '日本語'],
    boot: ['おかんが階段を上がってくる', 'Mom is coming upstairs'],
    hold: ['押さえる', 'Hold'], sleep: ['寝たふり', 'Fake sleep'], reply: ['返事', 'Answer'], hide: ['隠れる', 'Hide'],
    mash: ['連打！', 'Mash!'],
    perfect: ['守った', 'BLOCKED'], breach: ['入られた', "SHE'S IN"], granny: ['ノーカン', 'NO COUNT'], late: ['間に合わず', 'TOO LATE'],
    tutCALL: ['ノックだけなら返事', 'Just a knock: Answer'],
    tutRUSH: ['ガチャガチャは押さえる', 'Rattling: Hold'],
    tutPEEK: ['のぞかれたら寝たふり', 'Peeking: Fake sleep'],
    tutKEY: ['鍵が刺さったら隠れる', 'Key in lock: Hide'],
    tutMash: ['連打して押し返せ', 'Mash to push back'],
    tutGo: ['台詞よりドアを見ろ', 'Trust the door, not her'],
    skip: ['とばす', 'Skip'],
    again: ['もう一回', 'Play again'], save: ['画像を保存', 'Save image'], post: ['Xでポスト', 'Post on X'],
    close: ['閉じる', 'Close'], privacy: ['プライバシーについて', 'Privacy'],
    noteHead: ['家族の連絡ノート', 'Family Notebook'],
    held: ['守り切った', 'Held'], got: ['入られた', 'Got in'], gran: ['ばあちゃん', 'Grandma'], title: ['称号', 'Title'],
    mom: ['おかんより', 'From Mom'],
    shareTail: ['#おかんを部屋に入れるな #バカゲー', '#KeepMomOut #bakage'],
  }
  // 遊び方の絵の表（印の絵 → ボタンの絵）
  const HOWTO = {
    rows: [
      ['rattle', 'hold', ['ガチャガチャ', 'Handle rattles'], ['押さえて連打', 'Hold + mash']],
      ['peek', 'sleep', ['すき間から目', 'Eyes in the gap'], ['寝たふり', 'Fake sleep']],
      ['knock', 'reply', ['ノックだけ', 'Just a knock'], ['返事', 'Answer']],
      ['key', 'hide', ['鍵穴に鍵', 'Key in the lock'], ['隠れる', 'Hide']],
    ],
    lead: ['おかんの手口は4つ。ドアに出る印で分かる\n台詞はうそをつく。ドアを見ろ', 'Mom has 4 tricks. The door shows which.\nHer words lie. Watch the door.'],
    warn: ['時計の赤が消える前に選ぶ。夕方から速くなる\nばあちゃんは止められないが、数えない', 'Pick before the red on the clock runs out.\nGrandma is unstoppable but doesn\'t count.'],
  }
  return { TELL, ANSWER, TACTICS, FAKES, DEF, RES, PUSH_WIN, PUSH_LOSE, DAD_WIN, GRANNY_IN, REPLY, NIGHT, MEMO, STICKY, ONO, TITLES, NOTE, T, HOWTO }
})()
