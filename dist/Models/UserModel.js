"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSchema = void 0;
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const userSchema = new Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    verified: { type: Boolean, default: false },
    events: { type: [Object], default: [] }
});
exports.UserSchema = mongoose.model('User', userSchema);
//# sourceMappingURL=UserModel.js.map