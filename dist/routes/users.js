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
const UserModel_1 = require("../Models/UserModel");
const UserVerification_1 = require("../Models/UserVerification");
const utils_1 = __importDefault(require("./utils"));
const { apiResponse, sendVerificationEmail } = utils_1.default;
const jwt = require("jsonwebtoken");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express = require("express");
const bcrypt = require("bcrypt");
const app = express.Router();
const APP_URL = process.env.APP_URL;
const JWT_TOKEN_SECRET = process.env.JWT_TOKEN_SECRET;
const ifUserExists = (parameters) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield UserModel_1.UserSchema.findOne(parameters);
    if (user) {
        return true;
    }
    else {
        return false;
    }
});
function generateUserId() {
    // Get current timestamp in milliseconds
    const timestamp = Date.now();
    // Generate a random number between 1000 and 9999
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    // Combine timestamp and random number to form the user ID
    const userId = `user_${timestamp}${randomNum}`;
    return userId;
}
// register user route
app.post("/registerUser", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (yield ifUserExists({ email: req.body.email })) {
            res.send(apiResponse({
                message: "User already exists",
                error: {
                    message: "User already exists",
                    code: "409",
                },
            }));
            return;
        }
        const NewUser = new UserModel_1.UserSchema({
            id: generateUserId(),
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            verified: false,
        });
        NewUser.save()
            .then(() => __awaiter(void 0, void 0, void 0, function* () {
            // handle email verification here
            yield sendVerificationEmail(NewUser, res);
        }))
            .catch((error) => {
            console.error("Error in adding user", error);
        });
    }
    catch (error) {
        res.send(apiResponse({
            message: "Error in adding user",
            error: {
                message: error.message,
                code: "500",
            },
        }));
    }
}));
const getTemplate = (template) => {
    const verifiedEmailPageTemplate = `
  <div
        style="
          height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: 'Lucida Sans', sans-serif;
          box-shadow: 0 0 4px 4px #efefef;
        "
      >
        <div
          style="
            width: 50%;
            max-width: 500px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            border-radius: 10px;
          "
        >
          <div
            style="
              display: flex;
              justify-content: center;
              width: 100%;
              padding: 10px;
              border-radius: 10px 10px 0 0;
              background-color: #1e1e1e;
              color: #fff;
              font-size: 30px;
              font-weight: 600;
              letter-spacing: 2px;
            "
          >
            <p style="margin: 10px 0">Task tracker</p>
          </div>
          ${template}
        </div>
      </div>
  `;
    return verifiedEmailPageTemplate;
};
// verify user route
app.get("/verify/:id/:uniqueString", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, uniqueString } = req.params;
        UserVerification_1.UserVerificationSchema.findOne({ id })
            .then((result) => {
            if (result.id) {
                const expiresAt = result.expiresAt;
                const hashedUniqueString = result.uniqueString;
                if (expiresAt < new Date()) {
                    UserVerification_1.UserVerificationSchema.deleteOne({ id })
                        .then(() => {
                        console.log("Verification link deleted");
                        UserModel_1.UserSchema.deleteOne({ _id: id })
                            .then(() => {
                            const template = `<div
                                        style="
                                          width: 100%;
                                          padding: 10px;
                                          background-color: #efefef;
                                          color: #1e7e34;
                                          border-radius: 0 0 10px 10px;
                                        "
                                      >
                                        <div style="text-align: center">
                                          <p style="font-size: 20px">Verification link has expired.</p>
                                          <p style="margin-top: 20px">
                                            <a
                                              href="${APP_URL}/register"
                                              style="color: #333; text-decoration: none"
                                              onmouseover="this.style.color='#1e7e34';"
                                              onmouseout="this.style.color='#333';"
                                            >
                                              Go to registration page &rarr;
                                            </a>
                                          </p>
                                        </div>
                                      </div>`;
                            res.send(getTemplate(template));
                        })
                            .catch((error) => {
                            console.error("Error in deleting user with expired unique string", error);
                        });
                    })
                        .catch((error) => {
                        console.error("Error in deleting verification instance with expired unique string", error);
                    });
                }
                else {
                    bcrypt
                        .compare(uniqueString, hashedUniqueString)
                        .then((result) => __awaiter(void 0, void 0, void 0, function* () {
                        if (result) {
                            UserModel_1.UserSchema.updateOne({ _id: id }, { verified: true })
                                .then((result) => {
                                console.log("User verification status updated", result);
                                UserVerification_1.UserVerificationSchema.deleteOne({ id })
                                    .then(() => {
                                    console.log("Verification link deleted");
                                    const template = `<div
                                              style="
                                                width: 100%;
                                                padding: 10px;
                                                background-color: #efefef;
                                                color: #1e7e34;
                                                border-radius: 0 0 10px 10px;
                                              "
                                            >
                                              <div style="text-align: center">
                                                <p style="font-size: 20px">Email verified successfully</p>
                                                <p style="margin-top: 20px">
                                                  <a
                                                    href="${APP_URL}/login"
                                                    style="color: #333; text-decoration: none"
                                                    onmouseover="this.style.color='#1e7e34';"
                                                    onmouseout="this.style.color='#333';"
                                                  >
                                                    Go to login page &rarr;
                                                  </a>
                                                </p>
                                              </div>
                                            </div>`;
                                    res.send(getTemplate(template));
                                })
                                    .catch((error) => {
                                    console.error("Error in deleting verification link", error);
                                });
                            })
                                .catch((error) => {
                                console.error("Error in updating user verification status", error);
                            });
                        }
                        else {
                            res.send("<h1>Wrong verification details passed</h1>");
                        }
                    }))
                        .catch((error) => {
                        console.error("Error in comparing unique strings", error);
                    });
                }
            }
            else {
                res.send("<h1>Account does not exist</h1>");
            }
        })
            .catch((error) => {
            res.send("<h1>Invalid verification link</h1>");
        });
    }
    catch (error) { }
}));
// login user route
const generateToken = (user) => {
    try {
        return jwt.sign({ id: user._id.toString(), email: user.email }, JWT_TOKEN_SECRET, { expiresIn: "1h" });
    }
    catch (error) {
        console.error("Error in generating token", error);
    }
};
app.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield UserModel_1.UserSchema.findOne({
            email: req.body.email,
            password: req.body.password,
        });
        if (user) {
            if (user.verified) {
                const token = yield generateToken(user);
                if (token) {
                    res.status(200).json({
                        message: "User logged in successfully",
                        token: token || null,
                        userId: user._id.toString(),
                    });
                }
                else {
                    throw { message: "Can't login user at the moment", code: "500" };
                }
            }
            else {
                res.send(apiResponse({
                    message: "not verified",
                    error: {
                        message: "User not verified",
                        code: "401",
                    },
                }));
            }
        }
        else {
            res.send(apiResponse({
                message: "User not found",
                error: {
                    message: "User not found",
                    code: "401",
                },
            }));
        }
    }
    catch (error) {
        console.error("Error in logging in user", error);
        res.send(apiResponse({
            message: "Error in logging in user",
            error: {
                message: error.message,
                code: "500",
            },
        }));
    }
}));
const userRouter = app;
exports.default = userRouter;
//# sourceMappingURL=users.js.map