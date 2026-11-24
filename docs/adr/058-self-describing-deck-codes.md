---
status: proposed
date: 2026-11-23
---

# ADR-058: Self-Describing Deck Codes

## Context and Problem Statement

A deck code is a short string that holds a whole decklist. People paste it into chat, a tournament form or another deck builder, and the receiving app rebuilds the deck from it.

OpenRift has no deck code of its own. It imports and exports the [Piltover Archive deck code format](https://github.com/Piltover-Archive/RiftboundDeckCodes). That format stores every card as a set number, a variant number and a card number, and looks the set and variant numbers up in tables inside its library (0 is Origins, 1 is Proving Grounds, and so on). Every new set, art variant or number prefix (`R` for runes, `SP` for specials) needs a release of that library, and an OpenRift upgrade, before a deck containing it can be shared. New deck parts (sideboard, chosen champion, extra legends) each needed a new version that older readers reject.

Of a sample of 3,000 constructed decks from the OpenRift dev database, 409 (14%) cannot be encoded by the library version OpenRift ships, because they contain cards from sets the library does not know (`KDA`, `SGN`, `T1A`).

How can OpenRift's own deck code stay short without any table that needs updating when the game grows?

## Decision Drivers

- A new set, art variant or number prefix must work without a software update on either side.
- A new kind of deck section must not break readers that do not know it.
- Codes must survive being typed, read aloud, lowercased or split by a chat app.
- Codes should be shorter than the Piltover Archive format's.
- One app always produces the same code for the same deck.

## Considered Options

1. **Use the Piltover Archive format as OpenRift's deck code.**
2. **A Protocol Buffers message.**
3. **A self-describing, bit-packed format.**
4. **A plain-text decklist, compressed.**

## Decision Outcome

We specify option 3 as OpenRift deck codes.

Measured on the 2,591 sample decks both formats can encode, the median code is 87 characters, against 165 in the Piltover Archive format (47% shorter). Almost all entries in the sample are "any printing", which is the cheapest kind. It also encodes the 409 decks the Piltover Archive library rejects.

### The idea in plain words

Take this deck:

| Zone     | Copies | Card                                                              | Printed code       | Stored as      |
| -------- | ------ | ----------------------------------------------------------------- | ------------------ | -------------- |
| Legend   | 1      | Pridestalker (promo)                                              | `UNL-183/219-P`    | `UNL-183-P`    |
| Champion | 1      | Rengar, Trophy Hunter (alternate art)                             | `UNL-120a/219`     | `UNL-120a`     |
| Main     | 3      | Inferna                                                           | `UNL-002/219`      | `UNL-002`      |
| Main     | 3      | Grim Apothecary                                                   | `UNL-021/219`      | `UNL-021`      |
| Main     | 3      | Pyke, Dockside Butcher                                            | `UNL-028/219`      | `UNL-028`      |
| Main     | 2      | War Scout (English promo)                                         | `RAD-008/167-P-EN` | `RAD-008-P-EN` |
| Main     | 1      | Starry-Eyed Songstress (signed alternate art, Simplified Chinese) | `RAD-174a*/167-SC` | `RAD-174a*-SC` |
| Runes    | 4      | Fury Rune                                                         | `OGN-007/298`      | `OGN-007`      |

The number after `/` counts the cards in the set. A receiver can look it up in its own card data, so the code leaves it out. A deck code writes the rest down in five steps.

1. **A short dictionary.** The deck uses three sets, `OGN`, `RAD` and `UNL`. Their names are spelled out once at the start, and the code refers to them by position after that. The same happens for everything after the number, called the ending. This deck has five: none, `-P` (promo), `-P-EN` (English promo), `a` (alternate art) and `a*-SC` (signed alternate art, Simplified Chinese). The letters before a number (`R` in `UNL-R02`) and how many digits the number has form the number style, which is listed the same way. The spec has no list of sets, letters or endings. Each code spells out the ones its deck uses.
2. **Zones in a fixed order.** Seven yes/no bits say which of the seven zones (legend, champion, main, …) have cards. Those zones then follow in that order. Empty zones cost one bit. Each zone starts with one yes/no bit per set, saying whether it has cards from that set. Number styles and endings get the same yes/no bits, but only when the code has more than one.
3. **Gaps instead of numbers.** Inside a zone, the cards of each set are sorted by number. Inferna (`UNL-002`), Grim Apothecary (`UNL-021`) and Pyke (`UNL-028`) are written as 2, then "skip 18", then "skip 6": after 2, skip the 18 numbers 3 to 20 and land on 21. Small numbers take few bits.

   Cards whose codes differ in anything besides the number get their own sorted list, called a group. `VEN-SP1` and `VEN-SP3` have the letters `SP` before the number, so they form a list of their own, written as 1, then "skip 1". The same happens for `R`, `T` or any letters Riot uses in future, and for each ending.

4. **A checksum.** Steps 1 to 3 produce one long row of 0s and 1s (bits). Eight check bits are added at the end. They are computed from all other bits, so a mistyped character makes them disagree and the code is rejected.
5. **Letters at the end.** Five bits in a row can be arranged in 32 different ways, from `00000` to `11111`, and the alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ` has exactly 32 characters. The row is read five bits at a time and each block is replaced by its character: `00000` is `0`, `00001` is `1`, `00010` is `2`, `10010` is `J`. The example deck's row starts `00001 10010 00110`, so its code starts `1J6`.

The deck above becomes:

```
1J6R85VDJHNQJXANK4ZSJ6Z6FRWQ54397ZWW6BAA4CF4A48MQ1RA5YQ4T4XKR3E90S
```

### Telling codes apart

Every OpenRift deck code starts with `1`. Pasted text that is a single token starting with `1` is an OpenRift deck code. A text decklist such as `1 OGN-007` has spaces, so it is not. The Piltover Archive alphabet has no `0`, `1`, `8` or `9`, so a code starting with `1` can never be a Piltover Archive code, in any of its versions. Import fields, bots and scripts can accept both kinds of code and route them by the first character. Both checks run on the text as pasted, before a reader maps `I` and `L` to `1`, because the Piltover Archive alphabet uses both letters.

### What a code stores

A code is a list of **entries**. Each entry is a card reference, a number of copies and a zone.

**Card reference.** The code printed on the card: `OGN-039`, `OGN-039a`, `RAD-174a*/167-SC`, `VEN-SP1/006-EN`, `UNL-R02b-P`, `RAD-086a/167-P-EN`. It splits into these parts:

| Part        | Example        | Kept                         |
| ----------- | -------------- | ---------------------------- |
| Set         | `RAD`          | yes                          |
| Prefix      | `R`, `SP`, `T` | yes                          |
| Number      | `086`, `1`     | yes                          |
| Art letters | `a`, `b`, `*`  | yes, for exact printings     |
| Set size    | `/167`         | no, the receiver looks it up |
| Marks       | `-P`, `-EN`    | yes, for exact printings     |

**Art letters.** Riot often prints letters after the number to mark another version of a card: `a`, `b`, `c` for alternate art, `*` for special versions such as signed cards. Letters combine: `RAD-174a*` is the signed alternate art of Starry-Eyed Songstress. `OGN-039` is the standard Kai'Sa, Survivor and `OGN-039a` its alternate art.

**Marks** are the letter groups at the end, each after a dash: `P` for promo, `S` for signed, a language such as `EN` or `SC`, and any mark added in future. They keep their printed order.

**Ending.** The art letters and marks together form the card's ending: `a`, `a*-SC`, `-P-EN`, or nothing. Each distinct ending is spelled out once per code, like a set name, and cards point to it by position. A deck where every card is the standard version has one empty ending and pays nothing for it.

None of these parts is looked up in a list. The shape of the code says which part is which (see Grammar under Specification). A rune is not recognized by its `R`: Fury Rune `OGN-007` has no prefix and still goes in the runes zone. The zone says where a card sits in the deck. The prefix is only part of how its code is printed.

Each entry is one of two kinds:

- **Exact printing**: the receiver uses a printing with this printed code. `OGN-039a` means the alternate art of Kai'Sa, Survivor, and `RAD-086a-P-EN` the English promo alternate art of K'Sante, Courageous. Several printings can share one printed code (an English and a Chinese printing, a promo and the regular card), and the receiver picks among them.

  An encoder writes as much as it knows: an app that does not track languages writes `RAD-086a`. A receiver matches the full reference first. If it has no printing with those marks, it drops the marks and matches on set, prefix, number and art letters.

- **Any printing**: the receiver may use any printing of the card. Art letters and marks are dropped, so `OGN-039a` marked "any" is stored as `OGN-039`. Receivers match these on set, prefix and number only. Each such combination belongs to exactly one card. A reprinted card has several such codes (Agony's Embrace is `RAD-153` and `KDA-002`), and any of them is valid. Receivers accept all of them. Encoders should use the code from the card's earliest released set, because that choice never changes and is the most widely known.

Foil is not part of a deck code, because Riot does not print it in the code.

A code like the bare `OGN` printed on a token does not fit the grammar. It is stored as raw text, which can hold letters, digits, `-` and `*`. Raw entries of all zones share one list at the end of the deck.

**Copies.** A whole number from 1 to 999.

**Zone.** One of:

| Zone           | Section number |
| -------------- | -------------- |
| Legend         | 0              |
| Legend options | 1              |
| Champion       | 2              |
| Main           | 3              |
| Battlefield    | 4              |
| Runes          | 5              |
| Sideboard      | 6              |

The order of cards in a zone carries no meaning. The encoder sorts them.

**Not stored:** deck name, description, author, anything the receiver can look up from the card (type, domain, cost), and rules checks. A decoder accepts any deck.

### Examples

A full constructed deck across 3 sets (legend, champion, 39 main deck cards, 3 battlefields, 12 runes, 8 sideboard cards), all entries "any printing":

```
1J6R85VE3SNQJXANNQWRRYC8HWNBBDK8AXMD9RP496H7CSA7TW3HCNBY2CP6ZRWZ2Q423132593NM3NKXE65
```

84 characters. The Piltover Archive format needs 149 for the same deck.

The same deck with the main deck's three Kai'Sa, Survivor as the exact alternate art `OGN-039a` and the Fury Runes as the exact base printing `OGN-007` (94 characters):

```
1J6R85VE3SNQJXANJAA9FSJ67K48HVK12PHT5ET6NQEE5H29M9V6AHYQ0WB5AYCS16B3FWEFW8HR8VJCR4AJ7B87B7TW0S
```

Special codes:

| Zone     | Entry                                                      |
| -------- | ---------------------------------------------------------- |
| Champion | 1 × `UNL-120`, any printing                                |
| Main     | 1 × `VEN-SP1/006-EN`, exact (stored as `VEN-SP1-EN`)       |
| Main     | 3 × `RAD-086a/167-P-EN`, exact (stored as `RAD-086a-P-EN`) |
| Main     | 1 × `RAD-174a*/167-SC`, exact (stored as `RAD-174a*-SC`)   |
| Main     | 2 × `OGN`, any printing (stored as raw text)               |
| Runes    | 6 × `UNL-R02b-P`, exact                                    |

```
1J6V53BF5TNQSSE9D6TDRSK8KWEBHMKZYE30Y9YCZHSE4JZK4TQ048HSGJH2ZCSKRTGK4CK4C42YH0
```

### Specification

#### Building blocks

Bits are written most significant first. "Sorted" means ordered by ASCII code, character by character, with a shorter string before a longer one that starts with it.

- **Fixed(n)**: the value in exactly n bits.
- **Count**: the Elias gamma code of value + 1. Write value + 1 in binary, which has some length L, and put L − 1 zeros in front. 0 is `1`, 1 is `010`, 2 is `011`, 3 is `00100`.
- **Gap**: the order-4 exponential Golomb code. Write value + 16 in binary, length L, and put L − 5 zeros in front. 7 is `10111`, 18 is `0100010`, 183 is `00011000111`.
- **Text**: Count(length), then each character as Fixed(6), its position in `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-*`.
- **Name**: Text with Count(length − 1) in place of Count(length), for strings that are never empty.

#### Grammar

A card reference that matches

```
^([A-Z0-9]+)-([A-Z]*)([0-9]+)([a-z*]*)(/[0-9]+)?((-[A-Z]+)*)$
```

splits into set, prefix, number, art letters, set size and marks, in that order. Set names may contain digits (`T1A`). The ending is art letters followed by marks. A reference that does not match is raw text. Encoding fails on a character outside the Text alphabet.

#### Layout

1. Fixed(5) = 1, the marker. It makes the first character `1` in every version.
2. Count(version). This spec is version 0.
3. **Sets**: Count(n), then n × Name, sorted.
4. **Number styles**: Count(n), then n × (Text(prefix), Count(digits − 1)). `OGN-007` has prefix `""` and 3 digits, `UNL-R02` has prefix `R` and 2 digits, `VEN-SP1` has prefix `SP` and 1 digit. Sorted by prefix, then by digits as a number. Readers attach no meaning to a prefix.
5. **Endings**: Count(n), then n entries. Each is Fixed(1) = 1 for "any printing", or Fixed(1) = 0 followed by Text(art letters and marks), for example `a`, `a-P-EN`, or empty for the base art without marks. "Any printing" sorts first, the rest by text.
6. **Zones**: Fixed(1) for each section number 0 to 6 in order, 1 when that zone has entries. Then Count(m), the number of sections 7 and up.
7. **Zone bodies** of the present zones 0 to 6, in order. A group is the cards of one set, number style and ending. A zone body first says which groups it has: for each set in list order, Fixed(1) = 1 if the zone has cards of that set. For each set marked 1, and only when there are two or more number styles, Fixed(1) per style. For each style marked 1 (or the only style), and only when there are two or more endings, Fixed(1) per ending. Then each group the bits name, in that order: Count(cards − 1), and per card Gap(number − previous number − 1) and Count(copies − 1). For the first card in a group, previous number counts as −1. A zone that has only raw entries marks no set.
8. **Raw entries** of the whole deck: Count(n), then each as Fixed(3) section number, Text(code), Fixed(1) (1 = any printing), Count(copies − 1). Sorted by section number, then by code, exact before any printing.
9. **Sections 7 and up**, the m of them in ascending section number, each as Count(section number), Count(body length in bits), body. They are reserved for future deck parts. A reader skips any whose number it does not know.
10. Zero bits until the length plus 8 is a multiple of five.
11. Fixed(8) checksum: CRC-8/SMBUS (polynomial 0x07, start value 0, no reflection, no final XOR; check value 0xF4 for the ASCII text `123456789`). It is computed over all bits before it, with zero bits added in front up to a whole byte.
12. Each five bits as one character of the Crockford base32 alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`.

#### Reading

A reader uppercases the input, removes all whitespace and hyphens, reads `O` as `0` and `I` or `L` as `1`. The last 8 bits are the checksum, so the reader verifies it before parsing anything else. It rejects a code that has:

- a character outside the alphabet;
- a checksum that does not match, or more than four padding bits or a non-zero padding bit before it;
- a marker other than 1 or an unknown version;
- a Count or card number above 1,000,000, or more than 999 copies;
- sections 7 and up that are repeated or out of order, or a section length running past the checksum.

A reader accepts lists in any order. Only encoders must sort.

To rebuild a card reference, a reader writes the set, `-`, the prefix, the number padded with zeros to the style's digit count, and the ending. An "any printing" entry has no ending.

#### Same deck, same code

Before encoding, the encoder normalizes every card reference (drop the set size, and for "any printing" also the art letters and marks), merges entries with the same zone, reference and kind by adding their copies, and drops entries with zero copies. Every list above has a defined order, so one app writes one code per deck.

#### Adding things later

A new set, number prefix or art letter needs no change to this spec. A new kind of deck part gets a section number from 7 upwards, with a length, so older readers skip it and still read the rest. Zone bodies carry no length, so a new per-card field also goes in a section 7 and up that refers to cards by their position in the deck. A new version number is reserved for changes that older readers cannot skip. The marker stays, so every version keeps the leading `1`.

### Consequences

- Good, because sets, prefixes and art letters need no table and no software release.
- Good, because codes are 47% shorter at the median than the Piltover Archive format's.
- Good, because zones are explicit. A reader does not need a card database to find the legend, runes or battlefields.
- Good, because the checksum turns a mistyped code into an error.
- Good, because codes survive lowercasing, added hyphens and misread `O`/`0`, `I`/`1`.
- Bad, because no other app reads these codes yet. OpenRift keeps importing and exporting the Piltover Archive format for sharing with other tools.
- Bad, because the bits cannot be inspected by eye. Implementers rely on this spec and its test vectors.
- Bad, because two apps can write the same deck differently: different codes for an "any printing" entry of a reprinted card, or `RAD-086a` against `RAD-086a-P-EN` when only one of them tracks promos and languages. Same deck, same code holds only within one app.
- Bad, because each distinct ending is spelled out once per code. The full example deck grows from 84 to 88 characters with every card exact and marked `-EN`, and to 102 when Darius, Trifarian, Kai'Sa, Survivor and Challenge are English promos.
- Bad, because a deck in a new zone (section 7 and up) is unreadable for older readers in that zone, while the rest of the deck still loads.
- Neutral, because a deck from a single set pays 21 bits for spelling the set name, which the Piltover Archive format avoids.

### Confirmation

A reference encoder and decoder with the examples above as test vectors. The test suite round-trips every deck in the dev database and checks that lowercased, hyphenated and `O`-for-`0` inputs decode to the same deck, and that a changed character fails the checksum.

## Pros and Cons of the Options

### Use the Piltover Archive format as OpenRift's deck code

- Good, because other Riftbound deck tools already read it.
- Bad, because a deck with a new set or variant cannot be shared until the library's maintainers release support and OpenRift upgrades.
- Bad, because zones beyond the main deck and sideboard are inferred from card types, which needs a card database and broke once decks could hold several legends.

### A Protocol Buffers message

- Good, because generated readers exist for every language, and unknown fields are skipped by design.
- Bad, because every number takes at least a whole byte and every field a tag byte. By hand count, a 21-card main deck with a sideboard and champion comes to about 72 bytes, about as long as the Piltover Archive format's.

### A plain-text decklist, compressed

- Good, because anyone can read the format before compression.
- Bad, because the median deck needs 274 characters with deflate, almost three times OpenRift deck codes.
