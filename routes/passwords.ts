const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

// bcrypt hashes look like "$2b$10$" followed by 53 characters of salt + hash.
export const isBcryptHash = (value: unknown): boolean =>
  typeof value === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, SALT_ROUNDS);

/**
 * Checks a password against what's stored for the user. Accounts created before
 * hashing was introduced still hold plain text, so those are compared directly.
 */
export const verifyPassword = async (
  password: unknown,
  stored: unknown
): Promise<boolean> => {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  if (isBcryptHash(stored)) return bcrypt.compare(password, stored);
  return password === stored;
};
