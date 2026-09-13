import { UserSchema, User } from "../Models/UserModel";
import { UserVerificationSchema } from "../Models/UserVerification";
import utils from "./utils";
import { hashPassword, isBcryptHash, verifyPassword } from "./passwords";
const { apiResponse, sendVerificationEmail } = utils;
const authMiddleware = require("../middleware/auth");
const jwt = require("jsonwebtoken");
import dotenv from "dotenv";
dotenv.config();

const express = require("express");
const bcrypt = require("bcrypt");
const app = express.Router();
const APP_URL = process.env.APP_URL;
const JWT_TOKEN_SECRET = process.env.JWT_TOKEN_SECRET;

const ifUserExists = async (parameters: any) => {
  const user = await UserSchema.findOne(parameters);
  if (user) {
    return true;
  } else {
    return false;
  }
};

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
app.post("/registerUser", async (req: any, res: any) => {
  try {
    if (await ifUserExists({ email: req.body.email })) {
      res.send(
        apiResponse({
          message: "User already exists",
          error: {
            message: "User already exists",
            code: "409",
          },
        })
      );
      return;
    }
    if (typeof req.body.password !== "string" || !req.body.password) {
      res.send(
        apiResponse({
          message: "Password is required",
          error: {
            message: "Password is required",
            code: "400",
          },
        })
      );
      return;
    }
    const NewUser = new UserSchema({
      id: generateUserId(),
      name: req.body.name,
      email: req.body.email,
      password: await hashPassword(req.body.password),
      verified: false,
    });
    NewUser.save()
      .then(async () => {
        // handle email verification here
        await sendVerificationEmail(NewUser, res);
      })
      .catch((error: any) => {
        console.error("Error in adding user", error);
      });
  } catch (error: any) {
    res.send(
      apiResponse({
        message: "Error in adding user",
        error: {
          message: error.message,
          code: "500",
        },
      })
    );
  }
});

const getTemplate = (template: any) => {
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
app.get("/verify/:id/:uniqueString", async (req: any, res: any) => {
  try {
    const { id, uniqueString } = req.params;
    UserVerificationSchema.findOne({ id })
      .then((result: any) => {
        if (result.id) {
          const expiresAt = result.expiresAt;
          const hashedUniqueString = result.uniqueString;

          if (expiresAt < new Date()) {
            UserVerificationSchema.deleteOne({ id })
              .then(() => {
                console.log("Verification link deleted");
                UserSchema.deleteOne({ _id: id })
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
                  .catch((error: any) => {
                    console.error(
                      "Error in deleting user with expired unique string",
                      error
                    );
                  });
              })
              .catch((error: any) => {
                console.error(
                  "Error in deleting verification instance with expired unique string",
                  error
                );
              });
          } else {
            bcrypt
              .compare(uniqueString, hashedUniqueString)
              .then(async (result: any) => {
                if (result) {
                  UserSchema.updateOne({ _id: id }, { verified: true })
                    .then((result: any) => {
                      console.log("User verification status updated", result);
                      UserVerificationSchema.deleteOne({ id })
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
                        .catch((error: any) => {
                          console.error(
                            "Error in deleting verification link",
                            error
                          );
                        });
                    })
                    .catch((error: any) => {
                      console.error(
                        "Error in updating user verification status",
                        error
                      );
                    });
                } else {
                  res.send("<h1>Wrong verification details passed</h1>");
                }
              })
              .catch((error: any) => {
                console.error("Error in comparing unique strings", error);
              });
          }
        } else {
          res.send("<h1>Account does not exist</h1>");
        }
      })
      .catch((error: any) => {
        res.send("<h1>Invalid verification link</h1>");
      });
  } catch (error: any) {}
});

// login user route
const generateToken = (user: any) => {
  try {
    return jwt.sign(
      { id: user._id.toString(), email: user.email },
      JWT_TOKEN_SECRET,
      { expiresIn: "1h" }
    );
  } catch (error) {
    console.error("Error in generating token", error);
  }
};
app.post("/login", async (req: any, res: any) => {
  try {
    const user = await UserSchema.findOne({ email: req.body.email });
    const passwordMatches = user
      ? await verifyPassword(req.body.password, user.password)
      : false;
    if (user && passwordMatches) {
      // Upgrade accounts that still hold a plain-text password.
      if (!isBcryptHash(user.password)) {
        await UserSchema.updateOne(
          { _id: user._id },
          { password: await hashPassword(req.body.password) }
        );
      }
      if (user.verified) {
        const token = await generateToken(user);
        if (token) {
          res.status(200).json({
            message: "User logged in successfully",
            token: token || null,
            userId: user._id.toString(),
          });
        } else {
          throw { message: "Can't login user at the moment", code: "500" };
        }
      } else {
        res.send(
          apiResponse({
            message: "not verified",
            error: {
              message: "User not verified",
              code: "401",
            },
          })
        );
      }
    } else {
      res.send(
        apiResponse({
          message: "User not found",
          error: {
            message: "User not found",
            code: "401",
          },
        })
      );
    }
  } catch (error: any) {
    console.error("Error in logging in user", error);
    res.send(
      apiResponse({
        message: "Error in logging in user",
        error: {
          message: error.message,
          code: "500",
        },
      })
    );
  }
});

// account routes (authenticated)
const MIN_PASSWORD_LENGTH = 8;

const toPublicUser = (user: any) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  verified: user.verified,
});

// get current user's account details
app.get("/me", authMiddleware, async (req: any, res: any) => {
  try {
    const user = await UserSchema.findById(req.user.id);
    if (!user) {
      res.send(
        apiResponse({
          message: "User not found",
          error: { message: "User not found", code: "404" },
        })
      );
      return;
    }
    res.status(200).json({
      message: "User fetched successfully",
      user: toPublicUser(user),
    });
  } catch (error: any) {
    res.send(
      apiResponse({
        message: "Error in fetching user",
        error: { message: error.message, code: "500" },
      })
    );
  }
});

// update current user's profile details
app.patch("/me", authMiddleware, async (req: any, res: any) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 100) {
      res.send(
        apiResponse({
          message: "Invalid name",
          error: {
            message: "Name is required and must be 100 characters or fewer",
            code: "400",
          },
        })
      );
      return;
    }
    const user = await UserSchema.findByIdAndUpdate(
      req.user.id,
      { name },
      { new: true }
    );
    if (!user) {
      res.send(
        apiResponse({
          message: "User not found",
          error: { message: "User not found", code: "404" },
        })
      );
      return;
    }
    res.status(200).json({
      message: "User updated successfully",
      user: toPublicUser(user),
    });
  } catch (error: any) {
    res.send(
      apiResponse({
        message: "Error in updating user",
        error: { message: error.message, code: "500" },
      })
    );
  }
});

// change current user's password
app.patch("/me/password", authMiddleware, async (req: any, res: any) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== "string" || typeof newPassword !== "string" || !currentPassword) {
      res.send(
        apiResponse({
          message: "Invalid password details",
          error: { message: "Current and new password are required", code: "400" },
        })
      );
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      res.send(
        apiResponse({
          message: "Invalid new password",
          error: {
            message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
            code: "400",
          },
        })
      );
      return;
    }
    const user = await UserSchema.findById(req.user.id);
    if (!user) {
      res.send(
        apiResponse({
          message: "User not found",
          error: { message: "User not found", code: "404" },
        })
      );
      return;
    }
    if (!(await verifyPassword(currentPassword, user.password))) {
      res.send(
        apiResponse({
          message: "Incorrect password",
          error: { message: "Current password is incorrect", code: "401" },
        })
      );
      return;
    }
    if (newPassword === currentPassword) {
      res.send(
        apiResponse({
          message: "Invalid new password",
          error: {
            message: "New password must be different from the current one",
            code: "400",
          },
        })
      );
      return;
    }
    await UserSchema.updateOne(
      { _id: user._id },
      { password: await hashPassword(newPassword) }
    );
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error: any) {
    res.send(
      apiResponse({
        message: "Error in updating password",
        error: { message: error.message, code: "500" },
      })
    );
  }
});

const userRouter = app;
export default userRouter;
