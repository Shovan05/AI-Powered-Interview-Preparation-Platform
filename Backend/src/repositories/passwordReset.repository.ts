import { getPool } from "../config/postgres";

export async function createResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  await getPool().query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

/**
 * Uses the token and sets the new password in ONE transaction.
 * Returns false if the token is unknown, expired or already used.
 */
export async function resetPasswordWithToken(
  tokenHash: string,
  newPasswordHash: string
): Promise<boolean> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    // Claim the token. Two requests with the same token cannot both succeed,
    // because only one UPDATE can change used_at from NULL.
    const { rows } = await client.query<{ user_id: string }>(
      `UPDATE password_reset_tokens
       SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [tokenHash]
    );

    if (!rows[0]) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      newPasswordHash,
      rows[0].user_id,
    ]);

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}