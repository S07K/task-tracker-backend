import { UserSchema, User } from "../Models/UserModel";
import { UserVerificationSchema } from "../Models/UserVerification";
import utils from "./utils";
const { apiResponse, sendVerificationEmail } = utils;
import dotenv from "dotenv";
dotenv.config();

const express = require("express");
const bcrypt = require("bcrypt");
const app = express.Router();
const APP_URL = process.env.APP_URL;

const ifUserExists = async (parameters: any) => {
  const user = await UserSchema.findOne(parameters);
  if (user) {
    // console.log('User exists', user);
    return true;
  } else {
    // console.log('User does not exist');
    return false;
  }
};

// register user route
function generateUserId() {
  // Get current timestamp in milliseconds
  const timestamp = Date.now();

  // Generate a random number between 1000 and 9999
  const randomNum = Math.floor(1000 + Math.random() * 9000);

  // Combine timestamp and random number to form the user ID
  const userId = `user_${timestamp}${randomNum}`;

  return userId;
}
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
    const NewUser = new UserSchema({
      id: generateUserId(),
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      verified: false,
    });
    NewUser.save()
      .then(async () => {
        // handle email verification here
        await sendVerificationEmail(NewUser, res);
      })
      .catch((error: any) => {
        console.log("Error in adding user", error);
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

// verify user route
app.get("/verify/:id/:uniqueString", async (req: any, res: any) => {
  try {
    const { id, uniqueString } = req.params;
    UserVerificationSchema.findOne({ id })
      .then((result: any) => {
        // console.log("Verification user", result);
        if (result.id) {
          // console.log("User exists", result);
          const expiresAt = result.expiresAt;
          const hashedUniqueString = result.uniqueString;
          // console.log("Expires at", expiresAt);

          if (expiresAt < new Date()) {
            UserVerificationSchema.deleteOne({ id })
              .then(() => {
                console.log("Verification link deleted");
              })
              .catch((error: any) => {
                console.log(
                  "Error in deleting verification instance with expired unique string",
                  error
                );
              });
            res.send(
              `<h1>Verification link has expired. Please <a href="${APP_URL}/register"></a> again</h1>`
            );
          } else {
            bcrypt
              .compare(uniqueString, hashedUniqueString)
              .then(async (result: any) => {
                if (result) {
                  // console.log("User verified", result);
                  UserSchema.updateOne({ _id: id }, { verified: true })
                    .then((result: any) => {
                      console.log("User verification status updated", result);
                      UserVerificationSchema.deleteOne({ id })
                        .then(() => {
                          console.log("Verification link deleted");
                          res.send(
                            `<h1>Verification Completed. Please login <a href="${APP_URL}/login">here</a></h1>`
                          );
                        })
                        .catch((error: any) => {
                          console.log(
                            "Error in deleting verification link",
                            error
                          );
                        });
                    })
                    .catch((error: any) => {
                      console.log(
                        "Error in updating user verification status",
                        error
                      );
                    });
                } else {
                  res.send("<h1>Wrong verification details passed</h1>");
                }
              })
              .catch((error: any) => {
                console.log("Error in comparing unique strings", error);
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

// get all Users route
app.get("/getAllUsers", async (req: any, res: any) => {
  try {
    const AllUsers: User[] = await UserSchema.find();

    res.send(
      apiResponse({
        message: "All users fetched successfully",
        users: AllUsers,
      })
    );
  } catch (error: any) {
    res.send(
      apiResponse({
        message: "Error in fetching users",
        error: {
          message: error.message,
          code: "500",
        },
      })
    );
  }
});

// delete user route
app.delete("/deleteUser/:id", async (req: any, res: any) => {
  try {
    if (await ifUserExists(req.params.id)) {
      await UserSchema.deleteOne({
        id: req.params.id,
      });
      const allUsers = await UserSchema.find();
      res.send(
        apiResponse({
          message: "User deleted successfully",
          users: allUsers,
        })
      );
    } else {
      res.send(
        apiResponse({
          message: "User does not exist",
          error: {
            message: "User does not exist",
            code: "404",
          },
        })
      );
    }
  } catch (error: any) {
    res.send(
      apiResponse({
        message: "Error in deleting user",
        error: {
          message: error.message,
          code: "500",
        },
      })
    );
  }
});

//search user by id
app.get("/searchUser/:id", async (req: any, res: any) => {
  try {
    const user = await UserSchema.findOne({
      id: req.params.id,
    });
    if (user) {
      res.send(
        apiResponse({
          message: "User found",
          user: user,
        })
      );
    } else {
      res.send(
        apiResponse({
          message: "User not found",
          error: {
            message: "User not found",
            code: "404",
          },
        })
      );
    }
  } catch (error: any) {
    res.send(
      apiResponse({
        message: "Error in searching user",
        error: {
          message: error.message,
          code: "500",
        },
      })
    );
  }
});

//Update user by id
app.patch("/updateUser/:id", async (req: any, res: any) => {
  try {
    const user = await UserSchema.updateOne(
      {
        id: req.params.id,
      },
      req.body
    );
    if (user) {
      res.send(
        apiResponse({
          message: "User Updated successfully",
          user: user,
        })
      );
    } else {
      res.send(
        apiResponse({
          message: "User not found",
          error: {
            message: "User not found",
            code: "404",
          },
        })
      );
    }
  } catch (error: any) {
    res.send(
      apiResponse({
        message: "Error in searching user",
        error: {
          message: error.message,
          code: "500",
        },
      })
    );
  }
});

// search user
app.post("/searchUser/", async (req: any, res: any) => {
  try {
    const users = await UserSchema.find(req.body);
    if (users) {
      res.send(
        apiResponse({
          message: "Users found",
          users: users,
        })
      );
    } else {
      res.send(
        apiResponse({
          message: "Users not found",
          error: {
            message: "Users not found",
            code: "404",
          },
        })
      );
    }
  } catch (error: any) {
    res.send(
      apiResponse({
        message: "Error in searching users",
        error: {
          message: error.message,
          code: "500",
        },
      })
    );
  }
});

const userRouter = app;
export default userRouter;
