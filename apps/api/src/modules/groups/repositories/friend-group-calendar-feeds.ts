import type { FriendGroupCalendarFeedKind } from "@openrift/shared/types/api/friend-group";
import type { Kysely } from "kysely";

import type { Database } from "../../../db/tables.js";

export interface CalendarFeedTokenRow {
  kind: FriendGroupCalendarFeedKind;
  token: string;
}

export interface CalendarFeedLookupRow {
  groupId: string;
  groupName: string;
  kind: FriendGroupCalendarFeedKind;
}

export function friendGroupCalendarFeedsRepo(db: Kysely<Database>) {
  return {
    listForMember(groupId: string, userId: string): Promise<CalendarFeedTokenRow[]> {
      return db
        .selectFrom("friendGroupCalendarFeeds")
        .select(["kind", "token"])
        .where("groupId", "=", groupId)
        .where("userId", "=", userId)
        .orderBy("kind", "asc")
        .execute();
    },

    enable(values: {
      groupId: string;
      userId: string;
      kind: FriendGroupCalendarFeedKind;
      token: string;
    }): Promise<CalendarFeedTokenRow> {
      return db
        .insertInto("friendGroupCalendarFeeds")
        .values(values)
        .onConflict((oc) =>
          oc
            .columns(["groupId", "userId", "kind"])
            .doUpdateSet((eb) => ({ kind: eb.ref("excluded.kind") })),
        )
        .returning(["kind", "token"])
        .executeTakeFirstOrThrow();
    },

    async disable(
      groupId: string,
      userId: string,
      kind: FriendGroupCalendarFeedKind,
    ): Promise<void> {
      await db
        .deleteFrom("friendGroupCalendarFeeds")
        .where("groupId", "=", groupId)
        .where("userId", "=", userId)
        .where("kind", "=", kind)
        .execute();
    },

    findByToken(token: string): Promise<CalendarFeedLookupRow | undefined> {
      return db
        .selectFrom("friendGroupCalendarFeeds as f")
        .innerJoin("friendGroups as g", "g.id", "f.groupId")
        .select(["f.groupId as groupId", "g.name as groupName", "f.kind as kind"])
        .where("f.token", "=", token)
        .executeTakeFirst();
    },
  };
}
