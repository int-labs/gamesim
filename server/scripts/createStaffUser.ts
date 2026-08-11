/**
 * Create (or re-password) a staff account for the operator console.
 *
 * `POST /users` requires an admin token, so the very first admin cannot be
 * created over the API — that is the chicken-and-egg this script breaks. It is
 * also the supported way to reset a forgotten password.
 *
 *   npm run create-admin -- --email you@intlabs.io --password 'secret'
 *   npm run create-admin -- --email ops@intlabs.io --password 'secret' --role operator
 *
 * Omit --password and one is generated and printed once.
 */
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

import connectToDatabase from "../src/db/db";
import User from "../src/models/users";
import { ROLES } from "../src/constants/roles";

const SALT_ROUNDS = 10;
const STAFF_ROLES = [ROLES.ADMIN, ROLES.OPERATOR, ROLES.CLIENT] as const;

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
};

async function main() {
  const email = (opt("email") ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const role = (opt("role") ?? ROLES.ADMIN) as (typeof STAFF_ROLES)[number];
  // Generated passwords are URL-safe and long enough that they don't need to be
  // memorable — they're meant to be pasted once and then changed.
  const password = opt("password") ?? process.env.ADMIN_PASSWORD ?? randomBytes(12).toString("base64url");
  const generated = !opt("password") && !process.env.ADMIN_PASSWORD;

  if (!email || !email.includes("@")) {
    console.error("A valid --email is required.\n" + "  npm run create-admin -- --email you@intlabs.io --password 'secret'");
    process.exit(2);
  }
  if (!STAFF_ROLES.includes(role)) {
    console.error(`--role must be one of: ${STAFF_ROLES.join(", ")} (teams sign in with a passkey).`);
    process.exit(2);
  }
  if (password.length < 10) {
    console.error("--password must be at least 10 characters.");
    process.exit(2);
  }

  await connectToDatabase();

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const existing = await User.findOne({ email });

  if (existing) {
    if (existing.role === ROLES.TEAM) {
      console.error(`"${email}" is a team account. Teams sign in with a passkey, not a password.`);
      await mongoose.connection.close();
      process.exit(1);
    }
    existing.password = hashed;
    existing.role = role;
    await existing.save();
    console.log(`Updated ${role} "${email}".`);
  } else {
    await User.create({ email, password: hashed, role });
    console.log(`Created ${role} "${email}".`);
  }

  if (generated) {
    console.log(`\n  password: ${password}\n\nThis is shown once — store it now.`);
  }

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error(err?.message ?? err);
  await mongoose.connection.close().catch(() => undefined);
  process.exit(1);
});
