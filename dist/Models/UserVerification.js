"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserVerificationSchema = void 0;
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const userVerificationSchema = new Schema({
    id: { type: String, required: true },
    uniqueString: { type: String, required: true },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true }
});
exports.UserVerificationSchema = mongoose.model('UserVerification', userVerificationSchema);
//# sourceMappingURL=UserVerification.js.map