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
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPassword = exports.hashPassword = exports.isBcryptHash = void 0;
const bcrypt = require("bcrypt");
const SALT_ROUNDS = 10;
// bcrypt hashes look like "$2b$10$" followed by 53 characters of salt + hash.
const isBcryptHash = (value) => typeof value === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
exports.isBcryptHash = isBcryptHash;
const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
exports.hashPassword = hashPassword;
/**
 * Checks a password against what's stored for the user. Accounts created before
 * hashing was introduced still hold plain text, so those are compared directly.
 */
const verifyPassword = (password, stored) => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof password !== "string" || typeof stored !== "string")
        return false;
    if ((0, exports.isBcryptHash)(stored))
        return bcrypt.compare(password, stored);
    return password === stored;
});
exports.verifyPassword = verifyPassword;
//# sourceMappingURL=passwords.js.map