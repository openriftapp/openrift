import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useTradeCancelConsentStore,
  withTradeCancelConsent,
} from "@/features/groups/stores/trade-cancel-consent-store";
import { UserDeclinedError } from "@/lib/user-declined-error";

const TRADE = {
  id: "trade-1",
  cardId: "card-1",
  printingId: "printing-1",
  quantity: 2,
  counterpartyName: "Mara",
};

function conflict(trades = [TRADE]) {
  return new ORPCError("CONFLICT", { defined: true, status: 409, data: { trades } });
}

async function nextRequest() {
  await vi.waitFor(() => expect(useTradeCancelConsentStore.getState().request).not.toBeNull());
  return useTradeCancelConsentStore.getState().request!;
}

describe("withTradeCancelConsent", () => {
  beforeEach(() => {
    useTradeCancelConsentStore.setState({ request: null });
  });

  it("returns the result without asking when the server accepts the edit", async () => {
    const call = vi.fn().mockResolvedValue("ok");

    await expect(withTradeCancelConsent(call)).resolves.toBe("ok");
    expect(call).toHaveBeenCalledWith(undefined);
    expect(useTradeCancelConsentStore.getState().request).toBeNull();
  });

  it("retries with the trade ids the user confirmed", async () => {
    const call = vi.fn().mockRejectedValueOnce(conflict()).mockResolvedValueOnce("ok");

    const result = withTradeCancelConsent(call);
    const request = await nextRequest();
    expect(request.trades).toEqual([TRADE]);
    useTradeCancelConsentStore.getState().answer(true);

    await expect(result).resolves.toBe("ok");
    expect(call).toHaveBeenLastCalledWith(["trade-1"]);
    expect(useTradeCancelConsentStore.getState().request).toBeNull();
  });

  it("asks again when the retry names a trade the user has not seen", async () => {
    const later = { ...TRADE, id: "trade-2" };
    const call = vi
      .fn()
      .mockRejectedValueOnce(conflict())
      .mockRejectedValueOnce(conflict([TRADE, later]))
      .mockResolvedValueOnce("ok");

    const result = withTradeCancelConsent(call);
    await nextRequest();
    useTradeCancelConsentStore.getState().answer(true);
    await vi.waitFor(() =>
      expect(useTradeCancelConsentStore.getState().request?.trades).toHaveLength(2),
    );
    useTradeCancelConsentStore.getState().answer(true);

    await expect(result).resolves.toBe("ok");
    expect(call).toHaveBeenLastCalledWith(["trade-1", "trade-2"]);
  });

  it("rejects with UserDeclinedError and sends nothing more when the user declines", async () => {
    const call = vi.fn().mockRejectedValueOnce(conflict());

    const result = withTradeCancelConsent(call);
    await nextRequest();
    useTradeCancelConsentStore.getState().answer(false);

    await expect(result).rejects.toBeInstanceOf(UserDeclinedError);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("rethrows a refusal of trades the user already confirmed instead of asking again", async () => {
    const repeat = conflict();
    const call = vi.fn().mockRejectedValueOnce(conflict()).mockRejectedValueOnce(repeat);

    const result = withTradeCancelConsent(call);
    await nextRequest();
    useTradeCancelConsentStore.getState().answer(true);

    await expect(result).rejects.toBe(repeat);
    expect(call).toHaveBeenCalledTimes(2);
    expect(useTradeCancelConsentStore.getState().request).toBeNull();
  });

  it("passes any other error through untouched", async () => {
    const other = new ORPCError("CONFLICT", { defined: true, status: 409 });
    const call = vi.fn().mockRejectedValueOnce(other);

    await expect(withTradeCancelConsent(call)).rejects.toBe(other);
    expect(useTradeCancelConsentStore.getState().request).toBeNull();
  });

  it("declines an open question when a second one arrives", async () => {
    const first = useTradeCancelConsentStore.getState().ask([TRADE]);
    const second = useTradeCancelConsentStore.getState().ask([{ ...TRADE, id: "trade-2" }]);

    await expect(first).resolves.toBe(false);
    useTradeCancelConsentStore.getState().answer(true);
    await expect(second).resolves.toBe(true);
  });
});
