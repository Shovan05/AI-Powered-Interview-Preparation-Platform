import { getPool } from "../config/postgres";

export interface DbUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
  created_at: Date;
}

export async function createUser(
  name: string,
  email: string,
  passwordHash: string
): Promise<DbUser> {
  const { rows } = await getPool().query<DbUser>(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, email.toLowerCase(), passwordHash]
  );
  return rows[0];
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const { rows } = await getPool().query<DbUser>(
    "SELECT * FROM users WHERE lower(email) = lower($1)",
    [email]
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<DbUser | null> {
  const { rows } = await getPool().query<DbUser>(
    "SELECT * FROM users WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}