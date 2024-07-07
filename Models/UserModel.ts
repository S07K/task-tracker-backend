const mongoose = require('mongoose');
const Schema = mongoose.Schema;

export interface User {
    id: string;
    name: string;
    email: string;
    password: string;
    verified: boolean;
    events?: any[];
}

const userSchema = new Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    verified: { type: Boolean, default: false },
    events: { type: [Object], default: [] }
});

export const UserSchema = mongoose.model('User', userSchema);