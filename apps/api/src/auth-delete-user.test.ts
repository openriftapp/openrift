import { describe, expect, it, vi } from "vitest";

const dropLiveSpotsOfUser = vi.fn(() => Promise.resolve());

vi.mock("better-auth", () => ({ betterAuth: (options: unknown) => options }));
vi.mock("./deps.js", () => ({ createRepos: () => ({}), createTransact: () => vi.fn() }));
vi.mock("./modules/tournaments/services/participant-drops.js", () => ({ dropLiveSpotsOfUser }));

const { createAuth } = await import("./auth.js");

interface DeleteUserOptions {
  user: { deleteUser: { beforeDelete: (user: { id: string }) => Promise<void> } };
}

describe("createAuth account deletion", () => {
  it("drops the deleted account's live tournament spots first", async () => {
    const options = createAuth({
      config: {
        isDev: true,
        corsOrigin: undefined,
        auth: { secret: "test-secret", adminEmail: undefined },
        smtp: { configured: false },
      },
      db: {},
      dialect: {},
      sendEmail: vi.fn(),
    } as never) as unknown as DeleteUserOptions;

    await options.user.deleteUser.beforeDelete({ id: "user-1" });

    expect(dropLiveSpotsOfUser).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "user-1",
    );
  });
});
