# COREBREAK
## 2D Pixel Art Action-Incremental Game
## Simple Rules · Huge Reactions · Autonomous One-Shot Development Prompt

완성된 브라우저 기반 2D Pixel Art 게임 **「COREBREAK」**를 처음부터 끝까지 제작하라.

이 게임의 가장 중요한 목표는 다음 한 문장이다.

> **규칙은 어린아이도 화면만 보고 이해할 만큼 단순하지만, 버튼 한 번을 누를 때 일어나는 반응은 과장될 정도로 크고 만족스러워야 한다.**

단순 Clicker, Idle Counter, Slot Simulator, Prototype을 만들지 않는다.

플레이어가 반복해서 마우스를 연타하는 대신,

**보고 → 하나를 선택하고 → 한 번 실행하고 → 거대한 결과를 구경하고 → 다음 선택을 한다.**

라는 리듬으로 플레이하는 **Action Incremental Game**을 만든다.

게임의 깊이는 복잡한 규칙에서 만들지 않는다.

**단순한 규칙끼리 충돌하면서 생기는 연쇄 반응**에서 만든다.

---

# 1. 게임을 5초 안에 설명할 수 있어야 한다

게임 전체의 기본 규칙은 이것뿐이다.

> **부술 곳을 고른다.**
>
> **레버를 당긴다.**
>
> **기계가 부순다.**
>
> **보물을 얻는다.**
>
> **더 멋진 기계를 만든다.**

처음 플레이하는 사람이 설명서를 읽지 않아도 화면만 보고 이 흐름을 이해할 수 있어야 한다.

게임의 모든 고급 시스템도 이 기본 규칙을 깨뜨리지 않는다.

---

# 2. 핵심 판타지

플레이어는 행성 중심부를 향해 내려가는 거대한 굴착 기계를 운영한다.

화면 위에는 거대한 지층이 있다.

화면 아래에는 세 개의 그림이 돌아가는 **굴착 Action Reel Machine**이 있다.

플레이어는 뚫고 싶은 암석을 선택하고 커다란 레버를 당긴다.

릴에는 단 세 종류의 기본 그림이 있다.

# DRILL

뚫는다.

# BOMB

터뜨린다.

# MAGNET

끌어당긴다.

이 세 행동만으로 게임 대부분을 설명할 수 있어야 한다.

---

# 3. 가장 중요한 단순화

기본 Reel은 **3개만 사용한다.**

5개 이상으로 늘리지 않는다.

기본적으로 플레이어가 기억해야 하는 Symbol 역시 세 개뿐이다.

🔩 DRILL

💣 BOMB

🧲 MAGNET

게임 안에서는 실제 Pixel Art Icon을 사용한다.

Emoji를 최종 Asset으로 사용하지 않는다.

---

# 4. 한 번의 Spin이 하나의 작은 쇼가 되어야 한다

플레이어가 레버를 당기면:

릴 3개가 매우 빠르게 회전한다.

첫 번째 릴 정지.

두 번째 릴 정지.

세 번째 릴 정지.

그리고 결과가 **왼쪽 → 오른쪽** 순서대로 즉시 실행된다.

예:

`DRILL → BOMB → MAGNET`

화면에서는:

드릴이 암석을 뚫는다.

↓

안쪽의 Gas가 드러난다.

↓

Bomb이 안쪽에서 폭발한다.

↓

Gas가 연쇄 폭발한다.

↓

암석 수십 개가 무너진다.

↓

광석과 금화가 화면 전체로 튄다.

↓

Magnet이 그것들을 빨아들인다.

↓

자원 Counter가 빠르게 상승한다.

플레이어 입력은 한 번이지만 결과는 여러 단계로 이어진다.

이것이 게임의 기본 재미다.

---

# 5. 절대 Clicker로 만들지 않는다

다음을 핵심 플레이로 만들지 않는다.

- 계속 클릭해서 Damage 주기
- 초당 클릭 수 증가
- 마우스 연타
- 버튼 Mash
- 기다리기만 하는 Idle Progression
- 똑같은 행동 수백 번 반복
- 숫자만 증가하는 Upgrade
- 의미 없는 Prestige 반복

레버를 빠르게 여러 번 클릭해도 이득이 없게 만든다.

한 번의 행동이 끝난 뒤 다음 판단을 하면 된다.

플레이어의 손가락보다 **선택과 연쇄 반응**이 중요하다.

---

# 6. 가장 중요한 조작은 두 개뿐이다

기본 플레이에 필요한 행동은:

**① 부술 곳 선택**

**② 레버 당기기**

뿐이다.

Mouse:

암석 클릭 → Target 선택

큰 Lever 클릭 → Machine 실행

Keyboard:

`Space` → Lever 실행

키보드를 몰라도 모든 플레이가 가능해야 한다.

게임 시작 직후 복잡한 단축키를 알려주지 않는다.

---

# 7. 세 가지 Symbol

## DRILL

선택한 위치를 직선으로 뚫는다.

느낌:

빠르고 강하다.

단단한 암석에 좋다.

시각적으로 암석을 관통하며 깊게 들어가는 느낌이 강해야 한다.

---

## BOMB

선택한 위치 주변을 넓게 터뜨린다.

느낌:

크고 시끄럽다.

여러 암석을 한꺼번에 부순다.

Gas와 만나면 거대한 연쇄 폭발이 시작된다.

---

## MAGNET

주변의 광석과 보물을 한꺼번에 끌어온다.

느낌:

화면에 흩어진 수많은 물체가 플레이어에게 쏟아져 들어온다.

이미 부순 지역에서 특히 강하다.

---

# 8. 조합 규칙도 설명 없이 이해되어야 한다

복잡한 Recipe Table을 외우게 하지 않는다.

같은 그림이 많으면 더 강해진다는 단순 규칙을 사용한다.

예:

`DRILL + DRILL`

강한 Drill.

`DRILL + DRILL + DRILL`

**MEGA DRILL**

---

`BOMB + BOMB`

큰 폭발.

`BOMB + BOMB + BOMB`

**MEGA BOMB**

---

`MAGNET + MAGNET`

강한 흡입.

`MAGNET + MAGNET + MAGNET`

**MAGNET STORM**

---

다른 그림이 섞이면 순서대로 행동한다.

예:

`DRILL → BOMB`

먼저 구멍을 만든 뒤 안쪽에서 폭발한다.

---

`BOMB → MAGNET`

폭발시킨 뒤 나온 보상을 바로 빨아들인다.

---

`DRILL → BOMB → MAGNET`

대표적인 완전한 Chain이다.

이 정도만 알면 게임 전체를 플레이할 수 있어야 한다.

---

# 9. Jackpot의 의미

세 Reel이 모두 같은 Symbol이면 Jackpot이다.

하지만 돈을 거는 Casino Jackpot처럼 표현하지 않는다.

**기계가 한계 출력을 내는 순간**으로 표현한다.

예:

`DRILL ×3`

MEGA DRILL

거대한 Drill이 화면을 가르며 지층 여러 칸을 관통한다.

---

`BOMB ×3`

MEGA BOMB

짧은 정적.

점화.

거대한 폭발.

충격파.

연쇄 붕괴.

---

`MAGNET ×3`

MAGNET STORM

화면 전체 광석이 공중으로 들린 뒤 Machine으로 폭포처럼 쏟아진다.

Jackpot이 나오지 않아도 항상 진행된다.

Jackpot은 Progression Gate가 아니라 **놀라운 보너스 사건**이다.

---

# 10. 플레이어에게 확률 계산을 요구하지 않는다

복잡한 확률표를 보여주지 않는다.

Upgrade 화면에서도

`Bomb Probability +7.35%`

같은 표현을 중심으로 사용하지 않는다.

대신 Machine Reel을 실제 그림으로 보여준다.

예:

현재 Reel:

`DRILL DRILL DRILL BOMB BOMB MAGNET`

플레이어가 Upgrade를 선택하면 실제 Reel에서 그림 하나가 바뀌는 Animation을 보여준다.

예:

`MAGNET → BOMB`

그러면 플레이어는 직관적으로

> "이제 폭탄이 더 자주 나오겠구나."

라고 이해할 수 있다.

---

# 11. Upgrade도 세 선택지 정도만 보여준다

레벨업 또는 Workshop에 들어가면 한 번에 너무 많은 선택지를 보여주지 않는다.

큰 카드 3개를 보여준다.

예:

## 더 큰 드릴

DRILL이 암석 하나를 더 관통합니다.

[짧은 Animation Preview]

---

## 연쇄 폭탄

BOMB이 Gas를 만나면 더 멀리 폭발합니다.

[짧은 Animation Preview]

---

## 강한 자석

MAGNET이 더 먼 보물까지 끌어옵니다.

[짧은 Animation Preview]

플레이어는 셋 중 하나를 고른다.

텍스트를 읽지 않아도 Animation과 Icon만으로 대략적인 효과를 이해할 수 있어야 한다.

---

# 12. 숫자가 아니라 행동이 성장해야 한다

가능하면 다음 Upgrade를 우선한다.

Drill:

관통

↓

두 갈래 Drill

↓

벽을 부수고 계속 진행

↓

충돌 지점에서 작은 폭발

---

Bomb:

폭발 범위 확대

↓

작은 Bomb 추가 생성

↓

Gas Chain 강화

↓

폭발이 다음 Bomb을 깨움

---

Magnet:

범위 증가

↓

광석끼리 충돌

↓

보물을 지나가며 추가 광석 회수

↓

화면 전체 Storm

단순히:

`Damage +10%`

`Income +15%`

만 반복하지 않는다.

숫자 Upgrade는 보조적으로만 사용한다.

---

# 13. Incremental 성장의 핵심

처음에는:

작은 Drill 하나가 돌 하나를 부순다.

조금 뒤에는:

Drill이 여러 칸을 뚫는다.

Bomb이 주변을 터뜨린다.

Magnet이 광석 몇 개를 가져온다.

중반에는:

Drill이 Gas를 노출한다.

Bomb이 Gas를 터뜨린다.

폭발이 다른 폭발을 만든다.

Magnet이 광석 수십 개를 빨아들인다.

후반에는:

Machine 한 번 실행으로 화면 절반에서 사건이 연쇄적으로 발생한다.

게임의 성장 그래프를 **숫자가 아니라 화면에서 볼 수 있어야 한다.**

---

# 14. 환경 규칙도 매우 단순하게 유지한다

특수 지형은 한눈에 기능이 보여야 한다.

## GAS

노란 거품 또는 불안정한 Gas 형태.

Bomb을 맞으면:

**연쇄 폭발.**

---

## CRYSTAL

밝게 빛나는 결정.

Drill을 맞으면:

**Drill이 튕긴다.**

---

## GOLD

명확한 금빛 광석.

Magnet을 사용하면:

**한꺼번에 끌려온다.**

---

## HARD ROCK

크고 어두운 암석.

Drill에 약하다.

Bomb에는 잘 버틴다.

---

## BOMB ROCK

붉게 깜박이는 돌.

무언가에 의해 깨지면:

**자동 폭발.**

복잡한 속성표를 만들지 않는다.

각 지형은

> 생김새 → 예상 → 결과

가 바로 연결되어야 한다.

---

# 15. 지형 자체가 장난감이어야 한다

플레이어는 최적의 Damage 숫자를 계산하기보다

> "저 Bomb Rock을 터뜨리면 옆 Gas까지 전부 터지는 것 아닌가?"

라고 생각해야 한다.

그리고 실제로 그렇게 되어야 한다.

좋은 플레이는 복잡한 계산보다 **화면을 보고 재미있는 연쇄를 발견하는 것**이다.

---

# 16. FEVER

기존 Heat / Capacitor / Hold / Overdrive 같은 여러 시스템은 제거한다.

대신 **FEVER Meter 하나만 사용한다.**

암석을 부수면 FEVER Gauge가 찬다.

Gauge가 가득 차면 화면 아래에 커다란 버튼이 나타난다.

# FEVER!

누르면 짧은 시간 동안 Machine이 폭주한다.

약 8~12초 정도:

- Reel이 자동으로 빠르게 회전
- 모든 Symbol 강화
- 연쇄 반응 증가
- 배경 음악 Layer 추가
- Machine 속도 증가
- 광석 획득량 증가
- 조명 변화
- 화면 전체가 활발해짐

플레이어는 이동안 새로운 Target을 계속 선택할 수 있다.

반복 클릭할 필요는 없다.

FEVER는 게임의 대표적인 도파민 폭발 구간이다.

---

# 17. FEVER의 연출

Gauge가 80% 이상이면 Machine 조명이 조금씩 켜진다.

90%:

음악에 추가 Beat.

95%:

Reel 주변이 빛난다.

100%:

짧은

`DING!`

화면 중앙:

**FEVER READY**

버튼을 누르면:

짧은 0.2~0.4초 anticipation

Machine 변형

조명 점등

음악 전환

Reel 고속 회전

연쇄 파괴

FEVER 종료 직전에는 효과를 약간 압축해 피로감을 줄인다.

---

# 18. 자동화는 Programming이 아니다

복잡한 Automation Rule Editor를 만들지 않는다.

대신 플레이가 진행되면 귀여운 보조 기계가 실제 화면에 추가된다.

## Drill Bot

가끔 가까운 약한 돌을 자동으로 뚫는다.

---

## Bomb Bot

가끔 Bomb Rock이나 Gas를 공격한다.

---

## Magnet Bot

떨어진 광석을 자동으로 주워온다.

플레이어는 Bot을 켜고 끌 수 있다.

Bot이 늘어날수록 광산 전체가 살아 움직이는 느낌이 난다.

하지만 Main Reel은 여전히 플레이어가 직접 Target을 고르고 작동시키는 가장 강력한 행동이다.

Automation은 게임을 없애지 않고 **화면을 더 풍성하게 만든다.**

---

# 19. 새로운 기능은 하나씩만 소개한다

초반 30초:

Target

+

Lever

만 사용한다.

---

첫 2분:

DRILL / BOMB / MAGNET 이해.

---

그 이후:

같은 Symbol 3개 = MEGA.

---

조금 뒤:

Gas.

---

그 다음:

첫 Upgrade 선택.

---

그 이후:

FEVER.

---

중반:

Bot.

---

후반:

Crystal, Bomb Rock 등.

처음부터 모든 UI와 기능을 보여주지 않는다.

---

# 20. Tutorial은 말이 아니라 사건으로 가르친다

첫 화면에서 밝게 빛나는 약한 암석 하나만 클릭 가능하게 한다.

클릭하면 Machine이 Target을 바라본다.

Lever가 크게 흔들린다.

작은 문구:

**레버를 당겨!**

플레이어가 누르면 Drill이 암석을 박살낸다.

광석이 튀어나온다.

광석이 Counter로 날아간다.

다음에는 Gas 옆에 Bomb Target을 배치한다.

Bomb이 나오면 자연스럽게 Gas Chain을 보게 한다.

긴 설명창을 띄우지 않는다.

---

# 21. Game Feel은 최우선 시스템이다

게임에서 다음 행동들은 기능 구현만 되어 있으면 완료된 것이 아니다.

각 행동은 **눌렀을 때 손맛이 좋아야 한다.**

좋은 입력은:

입력

→ 기대

→ 충돌

→ 반응

→ 보상

의 흐름을 가진다.

---

# 22. 기본 타격 Feedback

DRILL이 암석에 충돌하면:

- Drill이 빠르게 전진
- 충돌 직전 아주 짧은 anticipation
- 순간적인 접촉 Flash
- 암석 Sprite의 짧은 Squash 또는 Shock
- 방향성 Debris
- Dust
- Crack
- 저음 Impact SFX
- 짧은 Machine recoil
- 아주 작은 Camera impulse

가 발생한다.

모든 효과를 길게 지속하지 않는다.

강한 입력은 짧고 명확해야 한다.

---

# 23. Bomb Feedback

Bomb은 Drill과 완전히 다른 맛을 가져야 한다.

발사.

짧은 Fuse.

아주 짧은 정적.

중심 Flash.

폭발.

Shockwave.

암석 조각이 바깥쪽으로 날아감.

Camera impulse.

저음 Explosion.

뒤늦게 작은 파편이 떨어지는 소리.

Gas가 연결되어 있다면 약간의 시간차로 다음 폭발이 발생한다.

---

# 24. Magnet Feedback

Magnet을 누르면 바로 숫자가 증가하게 만들지 않는다.

광석이 실제 공간에서 반응한다.

잠깐 떨림.

공중으로 상승.

Machine 방향으로 가속.

곡선을 그리며 빨려 들어감.

흡수 순간 작은 Spark.

Resource Counter가 Bounce.

여러 개가 들어오면 음높이가 조금씩 상승한다.

수십 개의 광석이 한꺼번에 빨려오는 모습을 **보상 자체**로 만든다.

---

# 25. Impact Hierarchy

모든 사건을 같은 강도로 연출하지 않는다.

## 작은 암석

작은 파편.

작은 소리.

거의 없는 Camera Shake.

---

## 일반 Combo

조금 더 큰 Flash.

강한 Impact.

Combo 표시.

---

## MEGA Symbol

명확한 Anticipation.

큰 Machine Animation.

강한 Sound.

Shockwave.

짧은 Camera Shake.

---

## 거대한 Chain

음악 Layer 변화.

화면 여러 위치에서 순차 폭발.

Combo Counter 폭증.

광석 비.

---

## FEVER

게임 전체 분위기가 변한다.

---

## Final Core

게임에서 가장 큰 Feedback.

항상 중요도에 따라 Feedback의 크기를 달리한다.

그래야 큰 사건이 실제로 크게 느껴진다.

---

# 26. Hit Stop / Slow Moment

매우 강한 충돌에서는 필요할 경우 짧은 Hit Stop 또는 Time Scale 변화를 사용할 수 있다.

예:

MEGA DRILL 충돌:

약 40~70ms 수준의 짧은 정지.

Final Core 파괴:

조금 더 긴 anticipation 후 폭발.

일반 암석마다 Hit Stop을 사용하지 않는다.

과도한 정지로 플레이 흐름을 망치지 않는다.

---

# 27. Camera

카메라는 게임의 물리감을 전달한다.

작은 충돌:

거의 느껴지지 않는 impulse.

Bomb:

짧은 Shake.

MEGA Bomb:

강하지만 매우 짧은 Shake.

FEVER:

지속 Shake가 아니라 사건마다 짧은 impulse.

Screen Shake 강도는 설정에서 조절하거나 끌 수 있어야 한다.

---

# 28. 화면에 계속 움직임이 있어야 한다

아무 입력이 없을 때도 세계가 완전히 정지한 그림처럼 보이지 않는다.

예:

Machine 작은 진동.

Gear 회전.

Steam.

광석 반짝임.

Gas Bubble.

Bot 이동.

떨어지는 Dust.

멀리서 작동하는 작은 Machine.

하지만 중요한 Target보다 Background Animation이 눈에 띄어서는 안 된다.

---

# 29. 연쇄 반응은 읽을 수 있어야 한다

모든 폭발을 동시에 처리해 화면을 하얗게 만들지 않는다.

예:

Bomb

→ 80ms

Bomb Rock

→ 70ms

Gas

→ 60ms

두 번째 Gas

→ Crystal 파괴

→ Gold 노출

→ Magnet

처럼 빠른 파동으로 전달한다.

Player가

> "내 Bomb 때문에 저것까지 터졌다."

는 것을 이해할 수 있어야 한다.

긴 Chain에서는 후반 Delay를 점점 짧게 만들어 전체 진행이 느려지지 않게 한다.

---

# 30. Combo Counter

Chain이 이어질 때 화면 한쪽에:

`CHAIN ×3`

`CHAIN ×8`

`CHAIN ×17`

처럼 표시한다.

숫자가 커질수록:

Text Bounce

Sound Pitch

Glow

가 조금씩 증가한다.

Combo 숫자 자체보다 화면에서 실제 Chain이 먼저 보여야 한다.

---

# 31. 게임은 항상 무언가를 보여줘야 한다

Progression 도중 다음 Upgrade를 사기 위해 아무것도 하지 않고 기다리는 시간이 없어야 한다.

플레이어는 항상 다음 중 하나를 하고 있어야 한다.

- 재미있는 Target 찾기
- Machine 실행
- Chain 관찰
- Upgrade 선택
- 새로운 지형 발견
- FEVER 준비
- Bot 성장
- 새로운 Layer 진입

의미 없는 대기 시간이 발생하면 Economy를 수정한다.

---

# 32. Progression Pace

첫 엔딩은 약 **40~60분**을 목표로 한다.

실제 Playtest를 통해 조정한다.

초반에는 매우 빠르게 변화한다.

첫 Upgrade:

약 1분 이내.

첫 MEGA:

몇 분 이내 자연스럽게 경험.

첫 FEVER:

약 3~5분.

첫 Bot:

약 8~12분.

새 Layer:

약 8~12분 간격.

새로운 시각적 또는 Gameplay 변화 없이 긴 시간이 지나지 않게 한다.

---

# 33. 5개 Layer

각 Layer의 규칙은 하나의 새로운 장난감을 추가하는 정도로 단순해야 한다.

## 1. RUST CRUST

DRILL / BOMB / MAGNET 학습.

---

## 2. GOLD CAVERN

많은 Gold.

Magnet의 즐거움 강조.

---

## 3. GAS DEPTHS

Gas 등장.

Bomb Chain 중심.

---

## 4. CRYSTAL RUINS

Crystal 등장.

Drill이 튕기며 예상 밖 Chain 생성.

---

## 5. CORE

지금까지 배운 요소가 함께 등장.

Final Heart Core 존재.

각 Layer는 색과 배경만 바뀌는 것이 아니라 플레이 화면에서 행동이 달라져야 한다.

---

# 34. 실패로 진행을 뺏지 않는다

기본 Campaign에서는 복잡한 HP나 Rig Integrity를 사용하지 않아도 된다.

이 게임의 재미는 Survival보다 파괴와 성장이다.

잘못된 선택 때문에 수십 분 진행을 잃게 만들지 않는다.

좋지 않은 Target을 선택했다면 단지 Chain이 작게 끝나는 정도로 충분하다.

즉시 다음 선택으로 넘어간다.

---

# 35. Economy

기본 Currency는 하나만 사용한다.

# ORE

암석과 광맥에서 얻는다.

모든 일반 Upgrade에 사용한다.

특수 Upgrade는 Layer 완료 보상으로 직접 해금해도 된다.

불필요한 Currency를 추가하지 않는다.

---

# 36. Build 깊이

규칙은 단순하지만 Upgrade 선택에 따라 자연스럽게 Build가 만들어진다.

예:

## DRILL BUILD

더 깊게.

더 멀리.

더 많이 관통.

---

## EXPLOSION BUILD

Bomb이 Bomb을 만든다.

Gas가 더 멀리 연결된다.

---

## MAGNET BUILD

화면 전체 광석 수집.

광석이 다른 암석과 충돌.

---

## HYBRID

Drill로 안쪽을 연다.

Bomb으로 터뜨린다.

Magnet으로 모두 가져온다.

별도의 Class 선택 화면은 필요하지 않다.

플레이어가 고른 Upgrade의 결과가 Build가 된다.

---

# 37. Final Heart Core

마지막에는 거대한 Heart Core가 화면 중앙에 존재한다.

복잡한 Boss Pattern을 만들 필요는 없다.

Core는 세 겹으로 표현한다.

외벽:

DRILL로 깨기 좋음.

↓

불안정층:

BOMB으로 크게 파괴.

↓

노출된 Core Fragment:

MAGNET으로 끌어냄.

플레이어는 지금까지 배운 세 행동을 자연스럽게 모두 사용한다.

마지막 Fragment를 꺼내면:

잠깐 정적.

Machine 멈춤.

Core Crack.

빛이 새어나옴.

거대한 폭발.

화면 전체 Shockwave.

광석과 Fragment가 비처럼 쏟아짐.

Bot들이 뛰어다님.

음악 climax.

결과 화면.

이 순간이 게임 전체에서 가장 강력한 연출이어야 한다.

---

# 38. Pixel Art

Pixel Art는 단순 Pixelation Filter가 아니다.

명확한 Silhouette.

의도적인 Pixel Cluster.

제한적이고 조화로운 Palette.

재질 차이.

읽기 쉬운 형태.

안정적인 Animation을 사용한다.

게임 플레이 크기에서:

Drill

Bomb

Magnet

Gas

Gold

Crystal

Target

을 즉시 구별할 수 있어야 한다.

---

# 39. Animation 품질

금지:

- Anchor 흔들림
- 부품이 Frame마다 사라짐
- 색 Noise
- Texture Flicker
- White Halo
- 불규칙한 Outline
- Fractional Pixel Jitter
- 의도하지 않은 Blur

정지된 Asset이 아니라 실제 Gameplay Animation으로 판단한다.

---

# 40. UI

UI는 최대한 적게 유지한다.

항상 보여야 하는 것은:

ORE

FEVER Gauge

현재 Depth

Reel 3개

Lever

정도다.

작은 숫자와 복잡한 Stat Table을 화면에 계속 노출하지 않는다.

Upgrade UI에서는 큰 Icon과 짧은 문장을 사용한다.

---

# 41. 읽지 않아도 플레이 가능해야 한다

텍스트는 보조 수단이다.

DRILL은 Drill 모양으로 보여준다.

BOMB은 Bomb 모양.

MAGNET은 Magnet 모양.

Gas는 위험하게 흔들린다.

Target은 테두리로 강조한다.

좋은 Upgrade는 Animation Preview로 보여준다.

게임 핵심 진행이 긴 설명문을 읽어야만 가능해서는 안 된다.

---

# 42. Audio

효과음은 Game Feel의 핵심이다.

최소 다음 소리를 명확히 구분한다.

Reel Spin

Reel Stop

Drill Spin-up

Drill Hit

Rock Crack

Rock Break

Bomb Fuse

Explosion

Gas Chain

Magnet Hum

Ore Pickup

MEGA Result

FEVER Ready

FEVER Start

Layer Clear

Core Break

소리는 입력과 정확하게 Sync되어야 한다.

---

# 43. Music

평상시에는 반복을 방해하지 않는 간단한 산업/굴착 Rhythm.

Chain이 커지면 작은 Layer 추가.

FEVER:

Beat와 Bass 강화.

Core:

Climax Layer.

게임의 상태 변화가 음악에도 반영되게 한다.

---

# 44. 기술 Stack

기존 프로젝트가 없다면:

- TypeScript
- Phaser 3
- Vite
- HTML/CSS
- Web Audio
- LocalStorage

기반으로 제작한다.

Desktop Browser 우선.

Simulation과 Visual Presentation을 가능한 한 분리한다.

Balance와 Upgrade 정의는 Data Driven으로 관리한다.

---

# 45. Save

자동 저장한다.

저장 항목:

- Depth
- Ore
- Upgrade
- Reel 상태
- Bot
- Unlock
- Settings
- Statistics

Save Version을 둔다.

Reload 후 정상적으로 이어서 플레이 가능해야 한다.

---

# 46. 반드시 실제 Playtest한다

Build 성공만 확인하고 완료하지 않는다.

실제로 Browser에서 처음부터 플레이한다.

최소 다음 흐름을 확인한다.

게임 시작

→ Target 선택

→ Lever

→ Reel

→ Drill/Bomb/Magnet 작동

→ Ore

→ Upgrade

→ MEGA

→ Gas Chain

→ FEVER

→ Bot

→ Layer 진행

→ Crystal

→ Core

→ Ending

→ Reload

각 단계에서 막힘이나 설명 부족이 있으면 수정한다.

---

# 47. 가장 중요한 사용성 테스트

처음 보는 사람이 30초 내에 다음을 알아야 한다.

**어디를 누르는가?**

밝게 표시된 암석.

**그 다음 무엇을 하는가?**

커다란 Lever.

**왜 누르는가?**

암석이 멋지게 파괴되고 보물이 나온다.

**다음 목표는 무엇인가?**

더 깊이 간다.

이것을 이해하기 위해 Tutorial 설명서를 읽어야 한다면 디자인을 다시 단순화한다.

---

# 48. 가장 중요한 재미 테스트

개발 중 다음 테스트를 반복한다.

## Lever Test

아무 Upgrade가 없는 첫 1분에도 Lever 한 번 누르는 것이 만족스러운가?

아니라면 Progression을 추가하기 전에 기본 Impact를 개선한다.

---

## Watch Test

큰 Chain이 발생했을 때 결과를 그냥 Skip하고 싶은가?

그렇다면 Animation이 너무 길거나 재미없다.

보고 싶은 장면이어야 한다.

---

## Surprise Test

10분 플레이 안에:

> "어? 이것도 터져?"

라는 순간이 발생하는가?

없다면 Environment Interaction을 개선한다.

---

## Growth Test

첫 5분 영상과 30분 영상을 나란히 두었을 때 성장 정도를 음소거 상태에서도 알아볼 수 있는가?

알 수 없다면 Incremental 표현이 부족하다.

---

# 49. Juice 완료 기준

최종 게임은 최소 다음 감각을 제공해야 한다.

작은 Drill도 맞는 느낌이 있다.

Bomb은 Drill과 완전히 다른 무게감을 가진다.

Magnet은 보상이 실제로 쏟아지는 느낌이 있다.

MEGA가 나오면 즉시 특별하다고 느껴진다.

Chain이 어디서 시작되어 어디로 퍼졌는지 보인다.

FEVER가 시작되면 게임 분위기가 명확히 변한다.

후반에는 Machine 하나가 광산 전체를 움직이는 느낌이 난다.

하지만 효과 때문에 Target과 게임 상태를 못 읽는 상황은 없어야 한다.

---

# 50. Reduced Effects

Game Feel을 강하게 만들되 사용자 설정에서 다음을 조정 가능하게 한다.

- Screen Shake
- Flash 강도
- Particle 양
- Reduced Motion
- Master Volume
- Music
- SFX
- Fast Reel

효과를 줄여도 Gameplay 정보는 유지되어야 한다.

---

# 51. 개발 우선순위

가장 먼저 완성해야 하는 것은 콘텐츠 양이 아니다.

우선순위는:

1. Target 선택의 명확성
2. Lever의 손맛
3. Drill/Bomb/Magnet의 차별화
4. Chain Reaction
5. Reward Collection
6. Upgrade로 행동 변화
7. FEVER
8. Bot
9. Layer
10. Core
11. 추가 콘텐츠

Lever 한 번이 재미없다면 Layer를 추가하지 않는다.

기본 행동부터 개선한다.

---

# 52. 절대 피해야 할 결과

다음 상태로 완성 처리하지 않는다.

기능은 모두 있는데 손맛이 없다.

파티클은 많은데 무엇이 일어났는지 모른다.

숫자는 커지는데 화면은 똑같다.

Slot 결과를 기다리는 시간만 길다.

Jackpot만 기다리는 게임이 된다.

Auto 기능을 켜면 플레이어가 할 일이 없다.

Upgrade 설명이 숫자와 백분율뿐이다.

Tutorial Popup이 길다.

UI가 화면 대부분을 차지한다.

반복 클릭이 가장 효율적인 전략이다.

---

# 53. 핵심 감정 곡선

첫 30초:

> "돌 누르고 레버 당기면 되는구나."

첫 몇 분:

> "폭탄 나오니까 진짜 크게 터지네."

조금 뒤:

> "저 빨간 돌을 터뜨리면 옆 Gas까지 갈 것 같은데?"

Chain:

> "와, 계속 터진다."

첫 MEGA:

> "이번 건 완전히 다르네."

첫 FEVER:

> "갑자기 기계가 미쳐 날뛴다."

중반:

> "내가 고른 Upgrade 때문에 폭발 방식이 달라졌다."

후반:

> "이제 화면 전체가 내 기계 때문에 움직인다."

Final Core:

> **"한 번 당겼는데 지층 전체가 무너진다."**

이 감정 곡선이 실제 플레이에서 발생하도록 만든다.

---

# 54. 자율 제작 원칙

계획만 작성하고 멈추지 않는다.

실제로:

기획

→ 구현

→ Asset 제작

→ 실행

→ Playtest

→ Visual QA

→ Balance 수정

→ Game Feel 개선

→ 전체 Progression 검증

→ Production Build

까지 완료한다.

사용자에게 사소한 결정을 하나씩 묻지 않는다.

실제 실행 결과가 설계보다 재미없다면 설계를 고집하지 말고 수정한다.

새 기능 추가보다 핵심 행동을 더 재미있게 만드는 것을 우선한다.

---

# 최종 성공 조건

이 게임은 전략 게임처럼 설명이 길지 않아야 한다.

Clicker처럼 손가락 노동을 요구해서도 안 된다.

Slot Machine처럼 좋은 결과를 기다리기만 해서도 안 된다.

플레이어가 해야 할 생각은 기본적으로 이것뿐이다.

> **"어디를 터뜨리면 제일 재미있는 일이 생길까?"**

그리고 게임은 그 작은 판단 하나에 대해

**기계 운동, 타격, 폭발, 연쇄 반응, 보상 분출, 소리, 화면 반응, 성장**

으로 과감하게 보답해야 한다.

핵심 공식은 다음과 같다.

**VERY SIMPLE INPUT**

↓

**CLEAR EXPECTATION**

↓

**BIG PHYSICAL RESPONSE**

↓

**CHAIN REACTION**

↓

**VISIBLE REWARD**

↓

**MEANINGFUL UPGRADE**

↓

**BIGGER CHAIN**

규칙은 단순하게 유지한다.

결과는 갈수록 미쳐가게 만든다.

---

완료 후에는 다음만 간결하게 보고한다.

- 실행 방법
- 구현한 Core Loop
- 실제 플레이 가능한 Progression
- Game Feel / Juice 구현 사항
- 실제 수행한 Runtime Test
- Save/Reload 검증 결과
- Production Build 결과
- 남아 있는 제한

직접 확인하지 않은 항목을 검증 완료라고 주장하지 않는다.