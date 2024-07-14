import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import eventRouter from "./routes/events";
import userRouter from "./routes/users";
import dotenv from "dotenv";
dotenv.config();
const mongoose = require("mongoose");
const MONGODB_URL = process.env.MONGODB_URL;
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
  await mongoose.connect(MONGODB_URL);
  console.log("DB connected!");
  // use `await mongoose.connect('mongodb://user:password@127.0.0.1:27017/test');` if your database has auth enabled
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

app.listen(PORT, () => {
  console.log("Server listening on port 5001");
});
