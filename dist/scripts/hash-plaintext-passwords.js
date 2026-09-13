"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// One-off migration: hashes any passwords still stored as plain text.
// Usage: npm run migrate:hash-passwords -- [--dry-run]
const dotenv_1 = __importDefault(require("dotenv"));
const UserModel_1 = require("../Models/UserModel");
const passwords_1 = require("../routes/passwords");
const mongo_1 = require("../config/mongo");
dotenv_1.default.config();
const mongoose = require("mongoose");
const dryRun = process.argv.includes("--dry-run");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose.connect((0, mongo_1.buildMongoUrl)());
        const users = yield UserModel_1.UserSchema.find({}, { _id: 1, password: 1 });
        const plaintext = users.filter((user) => !(0, passwords_1.isBcryptHash)(user.password));
        console.log(`${users.length} users, ${plaintext.length} with plain-text passwords`);
        if (dryRun) {
            console.log("Dry run: no changes made");
            return;
        }
        let updated = 0;
        for (const user of plaintext) {
            if (typeof user.password !== "string" || !user.password)
                continue;
            yield UserModel_1.UserSchema.updateOne({ _id: user._id, password: user.password }, { password: yield (0, passwords_1.hashPassword)(user.password) });
            updated++;
        }
        console.log(`Hashed ${updated} passwords`);
    });
}
main()
    .catch((error) => {
    console.error("Password migration failed", error);
    process.exitCode = 1;
})
    .finally(() => mongoose.disconnect());
//# sourceMappingURL=hash-plaintext-passwords.js.map