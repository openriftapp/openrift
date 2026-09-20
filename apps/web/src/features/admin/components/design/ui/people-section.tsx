import { Medal, Podium } from "@/components/ui/podium";
import type { PodiumSeat } from "@/components/ui/podium";
import { RankBand } from "@/components/ui/rank-band";
import { UserAvatar } from "@/components/user-avatar";
import { UserAvatarStack } from "@/components/user-avatar-stack";
import {
  DemoGroup,
  DemoRow,
  DemoSection,
  Swatch,
  SwatchRow,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";

// Static sample members for the avatar-stack demos. The empty gravatar hash
// keeps the fallback on initials, so the design page makes no network calls.
const STACK_MEMBERS = [
  { userId: "u1", userName: "Poro Herder", userImage: null, gravatarHash: "" },
  { userId: "u2", userName: "Hex Tinkerer", userImage: null, gravatarHash: "" },
  { userId: "u3", userName: "Void Binder", userImage: null, gravatarHash: "" },
  { userId: "u4", userName: "Glacial Mina", userImage: null, gravatarHash: "" },
  { userId: "u5", userName: "Stacked Sam", userImage: null, gravatarHash: "" },
];

const PODIUM_SEATS: PodiumSeat[] = [
  { key: "p1", rank: 1, name: "Poro Herder", score: 12, hint: "3 wins · opp 1.75" },
  { key: "p2", rank: 2, name: "Hex Tinkerer", score: 10, hint: "2 wins · opp 1.71" },
  { key: "p3", rank: 3, name: "Void Binder", score: 9, hint: "2 wins · opp 1.62" },
];

const RANK_BAND_DEMOS = [
  { rank: 1, text: "1", label: "Winner", filled: true },
  { rank: 2, text: "2", label: "Finalist", filled: true },
  { rank: 3, text: "3", label: "Top 4", filled: true },
  { rank: 6, text: "6th", label: "Top 8", filled: true },
  { rank: 12, text: "12th", label: null, filled: false },
];

const GROUPS = {
  avatar: { id: "people-avatar", title: "Avatar" },
  podium: { id: "people-podium", title: "Podium" },
  medal: { id: "people-medal", title: "Medal" },
  rankBand: { id: "people-rank-band", title: "Rank band" },
} as const;

export const PEOPLE_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

export function PeopleSection() {
  return (
    <DemoSection
      id="people"
      title="People & standings"
      note="Who is here, and how a field of players finished."
    >
      <DemoGroup {...GROUPS.avatar} hint="Initials carry the fallback when a member has no image.">
        <SwatchRow label="UserAvatar">
          <Swatch label="sm">
            <UserAvatar name="Vi Piltover" size="sm" />
          </Swatch>
          <Swatch label="default">
            <UserAvatar name="Vi Piltover" />
          </Swatch>
          <Swatch label="lg">
            <UserAvatar name="Vi Piltover" size="lg" />
          </Swatch>
        </SwatchRow>
        <DemoRow label="UserAvatarStack" hint="totalCount adds the +N overflow bubble.">
          <div className="flex flex-wrap items-center gap-6">
            <UserAvatarStack members={STACK_MEMBERS.slice(0, 3)} size="sm" />
            <UserAvatarStack members={STACK_MEMBERS} totalCount={17} />
            <UserAvatarStack members={STACK_MEMBERS} totalCount={8} size="lg" />
          </div>
        </DemoRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.podium}
        hint="Ranks render as given, so a tie hands two seats rank 1 and both get gold, while the raised seat is the caller's tie-break winner."
      >
        <DemoRow label="Seats" className="items-start gap-6">
          <div className="w-full max-w-sm">
            <Podium seats={PODIUM_SEATS} />
          </div>
          <div className="w-full max-w-sm">
            <Podium seats={PODIUM_SEATS.slice(0, 2)} />
          </div>
          <div className="w-full max-w-sm">
            <Podium seats={[]} emptyLabel="The throne fills after round 1 is finalized." />
          </div>
        </DemoRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.medal}
        hint="The onArt variant keeps an opaque plate and fixed colors in both themes."
      >
        <SwatchRow label="Ranks">
          {[1, 2, 3, 9].map((rank) => (
            <Swatch key={`flat-${rank}`} label={`flat ${rank}`} colors>
              <Medal rank={rank} />
            </Swatch>
          ))}
          {[1, 2, 3, 9].map((rank) => (
            <Swatch key={`on-art-${rank}`} label={`onArt ${rank}`} colors>
              <span className="flex items-center justify-center rounded-md bg-[linear-gradient(120deg,#5b3f8f,#2b6f6a)] p-2">
                <Medal rank={rank} variant="onArt" />
              </span>
            </Swatch>
          ))}
        </SwatchRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.rankBand}
        hint="Denser lists pass filled={false} and print every finish outside the cut as a bare numeral."
      >
        <SwatchRow label="Finishes">
          {RANK_BAND_DEMOS.map((demo) => (
            <Swatch key={demo.text} label={demo.label ?? "below the cut"} colors>
              <RankBand
                rank={demo.rank}
                text={demo.text}
                label={demo.label}
                filled={demo.filled}
                className="w-24 rounded-md"
              />
            </Swatch>
          ))}
          <Swatch label="inline" colors>
            <RankBand
              rank={1}
              text="1"
              label="Winner"
              layout="inline"
              className="w-52 rounded-md"
            />
          </Swatch>
        </SwatchRow>
      </DemoGroup>
    </DemoSection>
  );
}
