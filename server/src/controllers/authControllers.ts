import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/users";
import RefreshToken from "../models/refreshTokens";

const ACCESS_TOKEN_EXPIRY  = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_MS     = 7 * 24 * 60 * 60 * 1000;

function generateAccessToken(userId: string, role: string): string {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { id: userId },
    process.env.REFRESH_TOKEN_SECRET as string,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

// POST /auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required." });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(401).json({ message: "Invalid credentials." });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid credentials." });
      return;
    }

    const accessToken  = generateAccessToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken(user._id.toString());

    await RefreshToken.create({
      userId:    user._id,
      token:     refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_MS),
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   REFRESH_TOKEN_MS,
    });

    res.status(200).json({
      accessToken,
      user: {
        _id:    user._id,
        email:  user.email,
        role:   user.role,
        teamId: user.teamId ?? null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Login failed." });
  }
};

// POST /auth/logout
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      await RefreshToken.findOneAndDelete({ token });
    }

    res.clearCookie("refreshToken", { httpOnly: true, sameSite: "strict" });
    res.status(200).json({ message: "Logged out successfully." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Logout failed." });
  }
};

// POST /auth/refresh
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      res.status(401).json({ message: "No refresh token provided." });
      return;
    }

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET as string);
    } catch {
      res.status(401).json({ message: "Invalid or expired refresh token." });
      return;
    }

    const stored = await RefreshToken.findOne({ token });
    if (!stored) {
      res.status(401).json({ message: "Refresh token revoked." });
      return;
    }

    const user = await User.findById(payload.id);
    if (!user) {
      res.status(401).json({ message: "User not found." });
      return;
    }

    await RefreshToken.findOneAndDelete({ token });

    const newAccessToken  = generateAccessToken(user._id.toString(), user.role);
    const newRefreshToken = generateRefreshToken(user._id.toString());

    await RefreshToken.create({
      userId:    user._id,
      token:     newRefreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_MS),
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   REFRESH_TOKEN_MS,
    });

    res.status(200).json({ accessToken: newAccessToken });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Token refresh failed." });
  }
};

// GET /auth/me
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById((req as any).user.id).select("-password");
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    res.status(200).json(user);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch user." });
  }
};
