const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { userModel } = require("../model/user.model");

const userRouter = express.Router();

userRouter.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).send({ msg: "Name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).send({ msg: "Password must be at least 6 characters" });
    }
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await userModel.findOne({
      $or: [{ name: normalizedName }, { email: normalizedEmail }],
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        return res.status(409).send({ msg: "Email is already registered" });
      }
      return res.status(409).send({ msg: "Name is already registered" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await userModel.create({ name: normalizedName, email: normalizedEmail, password: hash });
    res.status(201).send({ msg: "User Registered successfully", user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];
      return res.status(409).send({
        msg: duplicateField === "email" ? "Email is already registered" : "Name is already registered",
      });
    }
    res.status(500).send({ msg: "Can't register user" });
  }
});

userRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email: email?.trim().toLowerCase() });
    if (!user) return res.status(401).send({ msg: "Invalid email or password" });
    const validPassword = await bcrypt.compare(password || "", user.password);
    if (!validPassword) return res.status(401).send({ msg: "Invalid email or password" });

    const token = jwt.sign(
      { id: user._id.toString(), name: user.name, email: user.email },
      process.env.JWT_SECRET || "coding",
      { expiresIn: "7d" }
    );
    res.send({ msg: "Login Successfully", token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).send({ msg: "Unable to login" });
  }
});

userRouter.post("/logout", (req, res) => {
  res.send({ msg: "Logout Successfully" });
});

module.exports = { userRouter };
