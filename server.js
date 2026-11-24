const express = require("express");
const cors = require("cors");
const { connection } = require("./database");
const { userRouter } = require("./routes/user.route");
const { noteRouter } = require("./routes/note.route");
const { categoryRouter } = require("./routes/category.route");
const { auth } = require("./middlewere/auth.middlewere");

const app = express();

const allowedOrigins = new Set([
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS origin not allowed"));
  },
}));

app.use(express.json());

app.use("/user", userRouter);

app.get("/", (req, res) => {
  res.send("HOME Page");
});

// Middlewere

app.use(auth);
app.use("/api/notes", noteRouter);
app.use("/api/categories", categoryRouter);

app.get("/dashboard", (req, res) => {
  res.send({ msg: "Private Route", user: req.user });
});

async function startServer() {
  try {
    await connection;
    console.log("DB Connected");
    app.listen(8080, () => {
      console.log("Server started on http://localhost:8080");
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exitCode = 1;
  }
}

startServer();
