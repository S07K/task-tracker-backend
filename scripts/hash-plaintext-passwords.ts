// One-off migration: hashes any passwords still stored as plain text.
// Usage: npm run migrate:hash-passwords -- [--dry-run]
import dotenv from "dotenv";
import { UserSchema } from "../Models/UserModel";
import { hashPassword, isBcryptHash } from "../routes/passwords";
dotenv.config();

const mongoose = require("mongoose");
const MONGODB_URL = process.env.MONGODB_URL;
const dryRun = process.argv.includes("--dry-run");

async function main() {
  if (!MONGODB_URL) {
    throw new Error("MONGODB_URL is not set");
  }
  await mongoose.connect(MONGODB_URL);

  const users = await UserSchema.find({}, { _id: 1, password: 1 });
  const plaintext = users.filter((user: any) => !isBcryptHash(user.password));
  console.log(`${users.length} users, ${plaintext.length} with plain-text passwords`);

  if (dryRun) {
    console.log("Dry run: no changes made");
    return;
  }

  let updated = 0;
  for (const user of plaintext) {
    if (typeof user.password !== "string" || !user.password) continue;
    await UserSchema.updateOne(
      { _id: user._id, password: user.password },
      { password: await hashPassword(user.password) }
    );
    updated++;
  }
  console.log(`Hashed ${updated} passwords`);
}

main()
  .catch((error) => {
    console.error("Password migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
