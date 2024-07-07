const mongoose = require('mongoose');
const Schema = mongoose.Schema;

export interface UserVerification {
    id: string;
    uuniqueStringn: string;
    createdAt: Date;
    expiresAt: Date;
}

const userVerificationSchema = new Schema({
    id: { type: String, required: true },
    uniqueString: { type: String, required: true },
    createdAt: { type: Date, required: true},
    expiresAt: { type: Date, required: true}
});

export const UserVerificationSchema = mongoose.model('UserVerification', userVerificationSchema);