import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/users";
import RefreshToken from "../models/refreshToken";
import { Types } from "mongoose";

const ACCESS_TOKEN_EXPIRY  = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_MS     = 7 * 24 * 60 * 60 * 1000;

function generateAccessToken(userId: string, role: string, teamId?: string): string {
  return jwt.sign(
    { id: userId, role, ...(teamId && { teamId }) },
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

    const userId      = (user._id as Types.ObjectId).toString();
    const accessToken  = generateAccessToken(userId, user.role);
    const refreshToken = generateRefreshToken(userId);

    await RefreshToken.create({
      userId:    user._id as Types.ObjectId,
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
        _id:    user._id as Types.ObjectId,
        email:  user.email,
        role:   user.role,
        teamId: user.teamId ?? null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Login failed." });
  }
};

// POST /auth/login/passkey
export const passkeyLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { passkey } = req.body;

    if (!passkey) {
      res.status(400).json({ message: "Passkey is required." });
      return;
    }

    const user = await User.findOne({ passkey });
    if (!user) {
      res.status(401).json({ message: "Invalid passkey." });
      return;
    }

    const userId      = (user._id as Types.ObjectId).toString();
    const accessToken  = generateAccessToken(
      userId,
      user.role,
      user.teamId?.toString()
    );
    const refreshToken = generateRefreshToken(userId);

    await RefreshToken.create({
      userId:    user._id as Types.ObjectId,
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
        _id:          user._id as Types.ObjectId,
        role:         user.role,
        teamId:       user.teamId       ?? null,
        simulationId: user.simulationId ?? null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Passkey login failed." });
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

    const userId          = (user._id as Types.ObjectId).toString();
    const newAccessToken  = generateAccessToken(
      userId,
      user.role,
      user.teamId?.toString()
    );
    const newRefreshToken = generateRefreshToken(userId);

    await RefreshToken.create({
      userId:    user._id as Types.ObjectId,
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