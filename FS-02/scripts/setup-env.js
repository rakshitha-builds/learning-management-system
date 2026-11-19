#!/usr/bin/env node
// Creates .env from .env.example with freshly generated random secrets (never overwrites an existing .env).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const target = path.join(root, ".env");
if (fs.existsSync(target)) {
  console.log(".env already exists - leaving it untouched.");
  process.exit(0);
}
const dbPassword = crypto.randomBytes(18).toString("hex");
const jwt = crypto.randomBytes(48).toString("hex");
let text = fs.readFileSync(path.join(root, ".env.example"), "utf8");
text = text
  .split("change-me-db-password").join(dbPassword)
  .replace("change-me-to-a-long-random-string", jwt);
fs.writeFileSync(target, text);
console.log("Created .env with generated secrets. Review it, then continue with the README steps.");
