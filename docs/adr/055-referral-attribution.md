---
status: accepted
date: 2026-11-10
---

# ADR-055: Referral Attribution and Invite Badges

## Context and Problem Statement

OpenRift grows by people sharing decks, lists, profiles and group links. Nothing records which share brought a new account, and a sharer gets nothing for it. Everything in the app is free, so there is no feature or quota to hand out as a reward, and gating features behind referrals would conflict with the free model. How do we give users a reason to share and credit the person who brought someone in?

## Decision Drivers

- Rewards are recognition only. No feature, limit or content depends on referrals.
- Anonymous share pages are cached at the edge by full URL (ADR-016). A per-sharer query parameter would split that cache.
- A user must not be able to set or change their own referrer.
- Throwaway accounts must not raise anyone's standing.
- The profile shows a standing, never who was referred.

## Considered Options

1. **Opaque per-user code in the URL fragment, claimed by the client after signup.**
2. **Code in a query parameter, recorded in the better-auth `user.create` hook from a cookie.**
3. **Reuse `users.share_token` as the referral code.**

## Decision Outcome

We implement option 1.

**Code.** `users.referral_code` is a 12-character base62 token from `generateShareToken()`, created on the first `GET /api/v1/referral`. It is separate from `share_token` so a shared deck link never exposes the owner's profile link.

**Carrying it.** When the sharer is signed in, `useReferralUrl` adds `#r=<code>` to the links in the share dialogs (`SharePanel`: decks, lists, collections, tier lists, the profile bundle), the native card share, the list and collection "Copy link" menu items, the owner's own profile link and the group join link. Tournament, board-state and stream-overlay links stay bare. The fragment never reaches the server, so edge caching and canonical URLs are unchanged. The account page offers a plain invite link to the landing page.

**Capture.** The root route reads `#r=` on load, keeps the first unexpired code in `localStorage` for 30 days, and strips the fragment from the address bar. Once a session exists, the client posts the code to `POST /api/v1/referral/claim` and forgets it unless the request failed.

**Claim.** The server sets `users.referred_by` only when it is null, the account is less than 24 hours old, the code resolves, and the referrer is someone else. A refused claim is final. `referred_by` is not a better-auth input field and is `ON DELETE SET NULL`.

**Counting.** A referral counts once the referred account has a verified email and either a copy in a collection or a deck. Counts are computed live from `referred_by`.

**Badge.** One referral earns tier 1, five tier 2, twenty-five tier 3 (`REFERRAL_TIER_THRESHOLDS`). The public profile shows the tier as a badge next to the contributor badge, controlled by `users.profile_show_referral_tier`, which defaults to on. The account page shows the owner's counted and not-yet-counted totals.

Option 2 would put the code in the query string and fragment the edge cache, and the creation hook would have to rely on a cookie reaching the OTP and OAuth callback requests. Option 3 would leak the profile link on every shared deck.

### Consequences

- Good, because share pages stay cacheable and SEO is untouched.
- Good, because a referrer is set at most once, by the server, inside a short window after signup.
- Good, because idle and unverified accounts do not count.
- Bad, because attribution is client-side: a visitor with storage blocked, or who signs up on another device, is not credited.
- Bad, because pasting a link into a tool that drops the fragment loses the credit.
- Neutral, because a group join link that brings in a new account credits whoever copied the link, typically the group admin.

### Confirmation

- `packages/shared/src/referral.test.ts` covers tiers, thresholds and fragment handling.
- `apps/api/src/modules/users/repositories/referrals.integration.test.ts` covers the claim window, self-referral, repeat claims and counting.
- `apps/web/src/features/account/hooks/use-referral.test.ts` covers capture, fragment stripping and the claim.
