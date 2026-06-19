import { Request, Response } from "express";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import User from "../models/users";
import Team from "../models/teams";

const SALT_ROUNDS = 10;

const generatePasskey = async (): Promise<string> => {
  const { default: randomWords } = await import("random-words");
  return randomWords.generate({ exactly: 2, join: "-" }) as string;
};

const generateUniquePasskey = async (simulationId: string): Promise<string> => {
  let passkey: string;
  let exists: boolean;

  do {
    passkey = await generatePasskey();
    exists  = !!(await User.findOne({ simulationId, passkey }));
  } while (exists);

  return passkey;
};

// POST /users
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password, role, teamId } = req.body;

    if (!password || !role) {
      res.status(400).json({ message: "password and role are required." });
      return;
    }

    let simulationId: string | undefined;
    let passkey:      string | undefined;

    if (teamId) {
      const team = await Team.findById(teamId);
      if (!team) {
        res.status(404).json({ message: "Team not found." });
        return;
      }
      simulationId = team.simulationId.toString();
      passkey      = await generateUniquePasskey(simulationId);
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      password: hashedPassword,
      role,
      teamId:       teamId      ?? null,
      simulationId: simulationId ?? null,
      passkey:      passkey      ?? null,
    });

    res.status(201).json(user);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to create user." });
  }
};

// GET /users
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, teamId } = req.query;

    const filter: Record<string, any> = {};
    if (simulationId) filter.simulationId = simulationId;
    if (teamId)       filter.teamId       = teamId;

    const users = await User.find(filter).select("-password");
    res.status(200).json(users);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch users." });
  }
};

// GET /users/:id
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    res.status(200).json(user);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch user." });
  }
};

// PATCH /users/:id
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password, ...rest } = req.body;

    const updates: Record<string, any> = { ...rest };

    if (password) {
      updates.password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    res.status(200).json(user);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update user." });
  }
};

// PATCH /users/:id/regenerate-passkey — admin only
export const regeneratePasskey = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    if (!user.simulationId) {
      res.status(400).json({ message: "User is not bound to a simulation." });
      return;
    }

    const passkey = await generateUniquePasskey(user.simulationId.toString());
    user.passkey  = passkey;
    await user.save();

    res.status(200).json({ passkey });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to regenerate passkey." });
  }
};

// DELETE /users/:id
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    res.status(200).json({ message: "User deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete user." });
  }
};