import type { connectToDb } from "./db.js";

type Sql = ReturnType<typeof connectToDb>;

type OtpType = "email-verification" | "sign-in" | "forget-password" | "change-email";

/**
 * An email holds codes of several types (sign-up verification, then a reset), and
 * created_at follows the wall clock, which can step back: match the type's identifier.
 */
function latestOtpRows(sql: Sql, type: OtpType, email: string) {
  if (type === "change-email") {
    const suffix = `:${email}`;
    return sql<{ value: string }[]>`
      SELECT value FROM verifications
      WHERE starts_with(identifier, 'change-email-otp-')
        AND right(identifier, ${suffix.length}) = ${suffix}
      ORDER BY created_at DESC
      LIMIT 1
    `;
  }
  return sql<{ value: string }[]>`
    SELECT value FROM verifications
    WHERE identifier = ${`${type}-otp-${email}`}
    ORDER BY created_at DESC
    LIMIT 1
  `;
}

export async function fetchLatestOtp(sql: Sql, type: OtpType, email: string): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < 10_000) {
    const [row] = await latestOtpRows(sql, type, email);
    if (row) {
      return row.value;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`OTP not found for ${email}`);
}
