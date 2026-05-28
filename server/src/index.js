require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const authRouter = require("./routes/auth");
const ridesRouter = require("./routes/rides");
const usersRouter = require("./routes/users");
const notificationsRouter = require("./routes/notifications");

const app = express();
const port = process.env.PORT || 3000;
const clientRoot = path.join(__dirname, "..", "..", "client");
const dataDir = path.join(__dirname, "..", "data");
const sessionsDir = path.join(dataDir, "sessions");

if (!process.env.SESSION_SECRET) {
  console.warn(
    "Warning: SESSION_SECRET is not set. Copy server/.env.example to server/.env."
  );
}

app.use(express.json());
app.use(
  session({
    store: new FileStore({
      path: sessionsDir,
      ttl: 7 * 24 * 60 * 60,
    }),
    secret: process.env.SESSION_SECRET || "dev-only-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use("/api/auth", authRouter);
app.use("/api/rides", ridesRouter);
app.use("/api/users", usersRouter);
app.use("/api/notifications", notificationsRouter);

app.use(express.static(clientRoot));

app.listen(port, () => {
  console.log(`ShareTrip server running at http://localhost:${port}`);
  console.log(`Local data: ${path.join(dataDir, "local-store.json")}`);
});
