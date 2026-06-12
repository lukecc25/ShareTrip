require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const authRouter = require("./routes/auth");
const ridesRouter = require("./routes/rides");
const usersRouter = require("./routes/users");
const notificationsRouter = require("./routes/notifications");

const HTML_PAGES = [
  "index.html",
  "sign-in.html",
  "sign-up.html",
  "dashboard.html",
  "my-profile.html",
  "profile.html",
  "ride-details.html",
];

const isProduction = process.env.NODE_ENV === "production";

const sessionCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

function resolveClientRoot() {
  const candidates = [
    path.join(__dirname, "..", "..", "client"),
    path.join(process.cwd(), "client"),
    path.join(process.cwd(), "..", "client"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  return candidates[0];
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sendClientPage(res, clientRoot, page) {
  const filePath = path.join(clientRoot, page);
  if (!fs.existsSync(filePath)) {
    res.status(404).send("Not Found");
    return;
  }
  res.sendFile(filePath);
}

const app = express();
const port = process.env.PORT || 3000;
const clientRoot = resolveClientRoot();
const dataDir = path.join(__dirname, "..", "data");
const sessionsDir = path.join(dataDir, "sessions");

ensureDir(dataDir);
ensureDir(sessionsDir);

if (!process.env.SESSION_SECRET) {
  console.warn(
    "Warning: SESSION_SECRET is not set. Copy server/.env.example to server/.env."
  );
}

if (!fs.existsSync(path.join(clientRoot, "sign-in.html"))) {
  console.warn(`Warning: client pages not found at ${clientRoot}`);
}

app.set("trust proxy", 1);
app.use(express.json());
app.use(
  session({
    store: new FileStore({
      path: sessionsDir,
      ttl: 7 * 24 * 60 * 60,
    }),
    name: "connect.sid",
    secret: process.env.SESSION_SECRET || "dev-only-change-in-production",
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: sessionCookieOptions,
  })
);

app.set("sessionCookieOptions", sessionCookieOptions);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/rides", ridesRouter);
app.use("/api/users", usersRouter);
app.use("/api/notifications", notificationsRouter);

app.get("/", (_req, res) => {
  sendClientPage(res, clientRoot, "index.html");
});

for (const page of HTML_PAGES) {
  if (page === "index.html") {
    continue;
  }

  const slug = page.replace(/\.html$/, "");
  app.get(`/${page}`, (_req, res) => {
    sendClientPage(res, clientRoot, page);
  });
  app.get(`/${slug}`, (_req, res) => {
    sendClientPage(res, clientRoot, page);
  });
}

app.use(express.static(clientRoot));

app.listen(port, () => {
  console.log(`ShareTrip server running on port ${port}`);
  console.log(`Live site: http://localhost:${port}`);
  console.log(`Serving client from ${clientRoot}`);
  console.log(`Supabase URL: ${process.env.SUPABASE_URL || "(not set)"}`);
});
