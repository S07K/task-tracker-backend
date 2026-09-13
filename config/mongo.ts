/**
 * Builds the MongoDB connection string.
 *
 * Credentials come from MONGODB_USERNAME and MONGODB_PASSWORD and are percent-encoded,
 * so characters like @ : / ? # % in a password don't break the URL. MONGODB_URL then
 * holds everything except the credentials, e.g.
 *   mongodb+srv://cluster0.example.mongodb.net/tasktracker?retryWrites=true
 *
 * If neither credential is set, MONGODB_URL is used as-is (e.g. a local database).
 */
export function buildMongoUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.MONGODB_URL;
  const username = env.MONGODB_USERNAME;
  const password = env.MONGODB_PASSWORD;

  if (!url) {
    throw new Error("MONGODB_URL is not set");
  }
  if (!username && !password) {
    return url;
  }
  if (!username || !password) {
    throw new Error("Set both MONGODB_USERNAME and MONGODB_PASSWORD, or neither");
  }

  const match = url.match(/^(mongodb(?:\+srv)?:\/\/)(.+)$/);
  if (!match) {
    throw new Error("MONGODB_URL must start with mongodb:// or mongodb+srv://");
  }
  const [, scheme, rest] = match;
  if (rest.split("/")[0].includes("@")) {
    throw new Error(
      "MONGODB_URL must not contain credentials when MONGODB_USERNAME and MONGODB_PASSWORD are set"
    );
  }

  return `${scheme}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${rest}`;
}
