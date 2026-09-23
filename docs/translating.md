# Translating OpenRift

OpenRift's interface strings live in this repository and are edited through pull requests. If you do not want to work with the repository, post corrections on [Discord](https://discord.gg/Qb6RcjXq6z) and they get applied for you. Everything you write is reviewed before it goes live.

## What is in scope

In scope are the interface strings only: buttons, labels, headings, help text, emails. They live in `apps/web/messages/{locale}.json` and are compiled into the app at build time, so an approved translation appears on the site with the next deploy.

Card data is not here. Card names, rules text, and keyword labels come from the catalogue database and follow the printed cards. Corrections to those go through [/contribute](https://openrift.app/contribute) instead.

English is the source language. If an English string is wrong or unclear, do not fix it in your translation: open an issue or say so on Discord, and it gets fixed at the source for every language at once.

## License

Translations are contributed under the [AGPL-3.0](../LICENSE), the same license as the rest of OpenRift. By submitting a translation you agree it can be published under those terms.

## Voice

OpenRift talks to one person who is organising their own cards. Sentences are short, plain, and say what happens. No marketing language, no exclamation marks, no jokes that only work in English.

German uses informal address throughout: `du`, `dein`, lowercase mid-sentence. French uses formal address: `vous`, `votre`. Both conventions are already established across the existing strings, so follow the one for your language.

Simplified Chinese follows the official Simplified Chinese cards for every game term and uses full-width punctuation. Traditional Chinese uses Taiwan conventions (設定, 資料, 帳號, 登入, 搜尋) and the official Traditional Chinese card terms, which differ from the Simplified ones. Korean uses the polite 해요체/합쇼체 register with noun labels and the official Korean card terms.

Keep the register of the source. An error message stays factual and never blames the reader. A short label stays short: interface space is fixed, and a label three times longer than the English wraps or truncates. If your language genuinely cannot be that terse, leave a comment so the layout can be adjusted.

Capitalisation follows your language, not the source. Where English capitalises a product noun (Wishlist, Tradelist), German capitalises nouns as German does, and French does not.

## Placeholders

Strings contain placeholders in curly braces: `{count}`, `{name}`, `{deck}`. Every placeholder in the source must appear in your translation, spelled exactly the same. Do not translate the name inside the braces, do not add spaces inside them, and do not invent new ones. Reordering them within the sentence is fine and often necessary.

Some strings wrap part of the sentence in a tag pair, `{#strong}…{/strong}` or `{#link}…{/link}`. The tag marks text the interface renders as a link, emphasis, a keyboard key, or code. Translate the words between the tags, keep the tags themselves unchanged, and move the whole tagged span to wherever your sentence needs it.

## Plural forms

A string that changes with a number is stored as a list of variants, selected by the plural rule of your language:

```json
"nav_badge_trades": [
  {
    "declarations": ["input count", "local countPlural = count: plural"],
    "selectors": ["countPlural"],
    "match": {
      "countPlural=one": "{count} person is waiting on you to trade",
      "countPlural=*": "{count} people are waiting on you to trade"
    }
  }
]
```

Translate only the texts inside `match`. The `declarations` and `selectors` lines stay as they are. The categories follow [CLDR plural rules](https://cldr.unicode.org/index/cldr-spec/plural-rules): English, German, and French use `one` for a single item and `*` for everything else. If your language needs more categories (`few`, `many`, `two`, `zero`), add them as further `match` entries before the `*` line; `*` must stay last because it catches every number no other entry matches.

## Terminology

These are the product's own words. Use the table, not a synonym, and use the same word every time.

| English          | German      | French            |
| ---------------- | ----------- | ----------------- |
| Card             | Karte       | Carte             |
| Printing         | Druck       | Impression        |
| Set              | Set         | Set               |
| Variant          | Variante    | Variante          |
| Finish           | Veredelung  | Finition          |
| Condition        | Zustand     | État              |
| Grade            | Note        | Note              |
| Rarity           | Seltenheit  | Rareté            |
| Domain           | Domäne      | Domaine           |
| Copy (of a card) | Exemplar    | Exemplaire        |
| Collection       | Sammlung    | Collection        |
| Deck             | Deck        | Deck              |
| List             | Liste       | Liste             |
| Wishlist         | Wunschliste | Liste de souhaits |
| Tradelist        | Tauschliste | Liste d'échange   |
| Trade            | Tausch      | Échange           |
| Group            | Gruppe      | Groupe            |
| Tournament       | Turnier     | Tournoi           |
| Owned            | Im Besitz   | Possédées         |
| Wanted           | Gesucht     | Recherchées       |
| Missing          | Fehlend     | Manquantes        |

Riftbound's game vocabulary (Legend, Battlefield, Rune, Unit, Spell, Gear) follows Riot's official terms in every language the cards are printed in. Brand and product names are never translated: OpenRift, Riftbound, Riot Games, TCGplayer, CardTrader, Cardmarket, Discord.

### Korean game terms

Riot released Riftbound in Korean on 2026-09-18, so Korean uses the official Korean terms. The sources are the Korean cards, the Korean core rules (리프트바운드 핵심 규칙) and the Korean tournament rules (리프트바운드 대회 규정). Fix the particle after a swapped word: 힘을, 영역이, 목록으로.

| English                                | Korean                             |
| -------------------------------------- | ---------------------------------- |
| Legend, Chosen Champion, Signature     | 전설, 선발 챔피언, 시그니처        |
| Battlefield, Base, Board               | 전장, 기지, 게임판                 |
| Unit, Spell, Gear, Equipment, Rune     | 유닛, 주문, 도구, 장비, 룬         |
| Supertype, Tag, Token, Basic rune      | 상위 유형, 태그, 토큰, 기본 룬     |
| Main Deck, Rune Deck, Sideboard        | 주 덱, 룬 덱, 보조 덱              |
| Hand, Trash, Rune Pool                 | 손, 폐기장, 룬 구성                |
| Domain, Colorless                      | 영역, 무색                         |
| Fury, Calm, Mind, Body, Chaos, Order   | 분노, 평정, 정신, 신체, 혼돈, 질서 |
| Energy, Power, Might, Might Bonus      | 에너지, 힘, 위력, 추가 위력        |
| Common, Uncommon, Rare, Epic           | 일반, 특별, 희귀, 서사             |
| Ability, Rules text, Keyword           | 스킬, 규칙 텍스트, 키워드          |
| Play, Exhaust, Ready, Channel, Recycle | 사용, 탈진, 준비, 전개, 재활용     |
| Showdown, Combat, Conquer, Hold        | 결전, 전투, 정복, 점거             |
| Victory Score, XP                      | 승리 점수, 경험치                  |
| Core Rules, Tournament Rules           | 핵심 규칙, 대회 규정               |
| Tournament, Match, Judge, Tiebreaker   | 대회, 경기, 심판, 타이브레이커     |
| Decklist, Deck check, Proxy            | 덱 목록, 덱 점검, 대용 카드        |

Keywords use the bracketed names on the Korean cards: 가속, 행동, 맹공, 죽음의 종소리, 굴절, 개입, 숨겨짐, 군단, 반응, 보호막, 탱커, 일시적, 통찰, 장착, 빨리 뽑기, 반복, 무기의 대가, 매복, 사냥, 레벨, 고유, 후방, 강화, 흐름. The Standard printing flag is 표준, because 일반 is the Common rarity. Showcase has no Korean label yet and stays 쇼케이스.

### Simplified Chinese game terms

Simplified Chinese uses the terms on the Simplified Chinese cards and in Riot China's 《符文战场》核心规则 and 《符文战场》赛事规则 (playloltcg.com).

| English                                      | Simplified Chinese                 |
| -------------------------------------------- | ---------------------------------- |
| Legend, Chosen Champion, Signature           | 传奇, 选定英雄, 专属               |
| Battlefield, Base, Board                     | 战场, 基地, 场地                   |
| Unit, Spell, Gear, Equipment, Rune           | 单位, 法术, 装备, 武装, 符文       |
| Supertype, Tag, Token, Basic rune            | 超类型, 标签, 指示物, 基础符文     |
| Main Deck, Rune Deck, Sideboard              | 主牌堆, 符文牌堆, 备牌             |
| Hand, Trash, Rune Pool, Chain                | 手牌, 废牌堆, 符文池, 结算链       |
| Domain                                       | 特性                               |
| Fury, Calm, Mind, Body, Chaos, Order         | 炽烈, 翠意, 灵光, 摧破, 混沌, 序理 |
| Energy, Power, Might, Might Bonus            | 法力, 符能, 战力, 战力加成         |
| Common, Uncommon, Rare, Epic, Showcase       | 普通, 不凡, 稀有, 史诗, 异画       |
| Overnumbered, signed overnumbered            | 超编, 签名超编                     |
| Ability, Rules text, Flavor text, Keyword    | 技能, 规则文本, 趣味性文本, 关键词 |
| Play, Exhaust, Ready, Channel, Recycle, Kill | 打出, 休眠, 活跃, 召出, 回收, 摧毁 |
| Showdown, Combat, Conquer, Hold              | 法术对决, 战斗, 征服, 据守         |
| Victory Score, XP, Mulligan                  | 胜利得分, 经验, 手牌调度           |
| Core Rules, Tournament Rules                 | 核心规则, 赛事规则                 |
| Tournament, Match, Game, Round               | 赛事, 比赛, 对局, 轮               |
| Organizer, Judge, Tiebreaker, Top cut        | 主办方, 裁判, 排名决胜, 淘汰赛     |
| Decklist, Deck check, Proxy                  | 卡组表, 卡组检查, 替代卡           |

Keywords use the bracketed names on the Simplified Chinese cards: 急速, 迅捷, 强攻, 绝念, 法盾, 游走, 待命, 鼓舞, 反应, 坚守, 壁垒, 瞬息, 预知, 装配, 灵便, 回响, 百炼, 伏击, 狩猎, 等级, 唯我, 后排, 强化, 流转, 强力, 洞察. Exhausting is never 横置, the Chinese Magic word for tapping.

### Traditional Chinese game terms

Traditional Chinese uses the terms on the Traditional Chinese cards (the collector line ends in TC) and in 《符文戰場》核心規則 and 《符文戰場》賽事規則 (playriftbound.com/zh-tw). Never carry a term over from Simplified Chinese.

| English                                              | Traditional Chinese                          |
| ---------------------------------------------------- | -------------------------------------------- |
| Energy, Power, Might                                 | 能量, 符能, 戰力                             |
| Domain                                               | 流派                                         |
| Fury, Calm, Mind, Body, Chaos, Order                 | 狂怒, 止靜, 心智, 身軀, 渾沌, 秩序           |
| Chosen Champion, Signature, Token                    | 指定英雄, 專屬, 衍生物                       |
| Main Deck, Rune Deck, Trash, Sideboard               | 主牌堆, 符文牌堆, 棄牌堆, 備牌               |
| Exhaust, Ready, Channel, Recycle                     | 休眠, 活化, 召喚, 回收                       |
| Showdown, Conquer, Hold                              | 法術對決, 征服, 據守                         |
| Common, Uncommon, Rare, Showcase, Foil               | 普通, 非凡, 稀有, 展示卡, 閃卡               |
| Set                                                  | 套組                                         |
| Tournament, Match, Game, Decklist, Deck check, Proxy | 賽事, 比賽, 對戰, 牌組清單, 牌堆檢查, 替代牌 |

Keywords follow the bracketed names on the Traditional Chinese cards, for example 加速, 行動, 強襲, 喪鐘, 坦克, 潛伏. Epic has no Traditional Chinese label yet and stays English.

Never borrow Magic: The Gathering vocabulary. No mana, no tapping, no Commander, no Planeswalker, in any language. If you need a flavourful example or placeholder, take it from League of Legends and Riftbound.

Internal names do not belong in translated text. If an English string contains a schema word (kind, slug, intent, entity), translate the meaning a player would understand and leave a comment so the English gets fixed.

## The catalogue is one person's work

The card data is maintained by a single person with help from contributors. Where a string talks about gaps in the data, keep that framing: honest about what is missing, inviting about filling it in. Do not turn it into a claim that the catalogue is community-built or complete.

## Review

Translations arrive as pull requests with `chore(l10n)` commits, or as Discord corrections that get committed for you. A reviewer for your language approves them, and the strings ship with the next deploy. Interface punctuation uses the ellipsis character (…) and never an em dash. If you want to review for a language you speak natively, ask on [Discord](https://discord.gg/Qb6RcjXq6z).

Machine translation is fine as a starting point. It is a starting point. A suggestion that is visibly untouched machine output gets rejected, because the whole reason for a human translator is the part the machine gets wrong.
