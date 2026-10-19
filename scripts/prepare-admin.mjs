import { randomBytes, pbkdf2Sync } from "node:crypto";
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
const hash = pbkdf2Sync(password, Buffer.from(salt, "hex"), 210000, 32, "sha256").toString("hex");
const secret = randomBytes(48).toString("hex");
console.log(JSON.stringify({
  username: "admin", password,
  ADMIN_USERNAME: "admin", ADMIN_PASSWORD_SALT: salt,
  ADMIN_PASSWORD_HASH: hash, ADMIN_SESSION_SECRET: secret
}));
