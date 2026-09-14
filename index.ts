import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import eventRouter from "./routes/events";
import userRouter from "./routes/users";
import chatRouter from "./routes/chat";
import dotenv from "dotenv";
import { buildMongoUrl } from "./config/mongo";
dotenv.config();
const mongoose = require("mongoose");
const APP_URL = process.env.APP_URL;
const PORT = process.env.PORT;
const app = express();

function logger(req: Request, res: Response, next: NextFunction) {
  console.log(`${req.method} ${req.url}`);
  next();
}

app.use(logger);

app.use(cors({ origin: APP_URL }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//mongo db connection
main().catch((err) => console.error("Error in MongoDB connection", err));

async function main() {
  // Credentials from MONGODB_USERNAME / MONGODB_PASSWORD are URL-encoded into MONGODB_URL
  await mongoose.connect(buildMongoUrl());
  console.log("DB connected!");
}

// api routes
app.get("/", async (req: any, res: any) => {
  res.send(`
    <div style="height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
    <h1>Task Tracker API Server</h1>
    <p>API is working fine</p>
    </div>`);
});
app.use("/events", eventRouter);
app.use("/users", userRouter);
app.use("/chat", chatRouter);

app.listen(PORT, () => {
  console.log("Server listening on port 5001");
});
