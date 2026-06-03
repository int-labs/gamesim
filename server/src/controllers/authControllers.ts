import * as bcrypt from "bcrypt";
import { Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import * as uuid from "uuid";

import RefreshToken from "../models/refreshTokens";
import Segment from "../models/segments";
import { SimulationInterface } from "../models/simulations";
import Team from "../models/teams";
import User from "../models/users";

export const issueTokens = async (user: any, team?: any, segment?: any) => {
  const accessToken = jwt.sign(
    {
      userId: user._id,
      role: user.role,
      email: user.email,
      teamId: user.teamId,
      teamName: team?.teamName,
      teamLeader: team?.teamLeader,
      avatarUrl: team?.avatarUrl,
      simulationId: team?.simulationId,
      segmentId: segment?._id,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "1d" } // Token valid for 1 day
    // for testing
    // { expiresIn: "1m" } // Token valid for 1 min
  );

  const refreshTokenId = uuid.v4();
  const refreshToken = jwt.sign(
    { userId: user._id, jti: refreshTokenId },
    process.env.REFRESH_TOKEN_SECRET as string,
    { expiresIn: "7d" }
  );

  await new RefreshToken({
    userId: user._id,
    token: refreshTokenId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  }).save();

  return { accessToken, refreshToken };
};

export const loginAsAdmin = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({
    email,
    role: { $in: ["admin", "operator", "client"] },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: "Invalid credentials." });

    return;
  }

  // Check if user is suspended
  if (user.status === "suspended") {
    res.status(403).json({
      error:
        "Your account has been suspended. Please contact an administrator.",
    });

    return;
  }

  const { accessToken: token, refreshToken } = await issueTokens(user);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.CUSTOM_ENV === "production", // Disable secure in dev
    sameSite: "none", // Keep for cross-domain cookies
    domain:
      process.env.CUSTOM_ENV === "production" ? ".int-labs.com" : undefined,
    path: "/",
  });

  // Generate a JWT or session
  res
    .status(200)
    .json({ message: "Login successful", userId: user._id, token });
};

export const loginAsTeam = async (req: Request, res: Response) => {
  const { passkey } = req.body;

  const user = await User.findOne({ passkey, role: "team" });
  const team = await Team.findById(user?.teamId).populate<{
    simulation: SimulationInterface;
  }>({
    path: "simulation",
    populate: {
      path: "activeSegmentsDetailed",
    },
  });

  const segment = await Segment.findOne({
    simulationTypeId: team?.simulation.simulationTypeId,
    active: true,
  })
    .sort({ createdAt: 1 })
    .limit(1);

  if (!user || !team) {
    res.status(401).json({ error: "Invalid or expired passkey." });

    return;
  }

  // Check if user is suspended
  if (user.status === "suspended") {
    res.status(403).json({
      error:
        "Your account has been suspended. Please contact an administrator.",
    });

    return;
  }

  if (team.simulation.status !== "Active") {
    res.status(401).json({ error: "Simulation is already ended." });

    return;
  }

  const { accessToken: jwtToken, refreshToken } = await issueTokens(
    user,
    team,
    segment?._id
  );

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.CUSTOM_ENV === "production", // Disable secure in dev
    sameSite: "none", // Keep for cross-domain cookies
    domain:
      process.env.CUSTOM_ENV === "production" ? ".int-labs.com" : undefined,
    path: "/",
  });

  res.status(200).json({
    message: "Login successful",
    teamId: user.teamId,
    token: jwtToken,
  });
};

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies || {};

  try {
    if (!refreshToken) {
      res.status(401).json({ message: "Refresh token not provided" });

      return;
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET as string
    ) as JwtPayload;
    (req as any).user = decoded; // Attach user data to request

    if (!decoded) {
      res.status(401).json({ message: "Invalid or expired refresh token" });

      return;
    }

    const dbToken = await RefreshToken.findOne({
      token: decoded.jti,
      userId: decoded.userId,
    });

    if (!dbToken || dbToken.expiresAt < new Date()) {
      res.status(401).json({ message: "Refresh token is invalid or expired" });

      return;
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json({ error: "Invalid or expired token." });

      return;
    }

    const team =
      user.role === "team" ? await Team.findById(user?.teamId) : null;

    // Rotate the refresh token
    await RefreshToken.deleteOne({ token: decoded.jti });

    const { accessToken, refreshToken: newRefreshToken } = await issueTokens(
      user,
      team
    );

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.CUSTOM_ENV === "production", // Disable secure in dev
      sameSite: "none", // Keep for cross-domain cookies
      domain:
        process.env.CUSTOM_ENV === "production" ? ".int-labs.com" : undefined,
      path: "/",
    });

    res.json({ accessToken });
  } catch (err) {
    res.status(500).json({ message: "Error refreshing token", error: err });
  }
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies || {};

  try {
    if (refreshToken) {
      const payload = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET as string
      ) as JwtPayload;

      if (payload) {
        await RefreshToken.deleteOne({ token: payload.jti });
      }
    }

    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error logging out", error: err });
  }
};