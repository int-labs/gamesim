import "dotenv/config";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in your environment.");
}

const token = jwt.sign(
  { role: "admin" },
  JWT_SECRET,
  { expiresIn: "30d" }
);

console.log(token);