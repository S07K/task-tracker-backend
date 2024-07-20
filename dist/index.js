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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const events_1 = __importDefault(require("./routes/events"));
const users_1 = __importDefault(require("./routes/users"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mongoose = require("mongoose");
const MONGODB_URL = process.env.MONGODB_URL;
const APP_URL = process.env.APP_URL;
const PORT = process.env.PORT;
const app = (0, express_1.default)();
function logger(req, res, next) {
    console.log(`${req.method} ${req.url}`);
    next();
}
app.use(logger);
app.use((0, cors_1.default)({ origin: APP_URL }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
//mongo db connection
main().catch((err) => console.error("Error in MongoDB connection", err));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose.connect(MONGODB_URL);
        console.log("DB connected!");
        // use `await mongoose.connect('mongodb://user:password@127.0.0.1:27017/test');` if your database has auth enabled
    });
}
// api routes
app.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.send(`
    <div style="height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
    <h1>Task Tracker API Server</h1>
    <p>API is working fine</p>
    </div>`);
}));
app.use("/events", events_1.default);
app.use("/users", users_1.default);
app.listen(PORT, () => {
    console.log("Server listening on port 5001");
});
//# sourceMappingURL=index.js.map