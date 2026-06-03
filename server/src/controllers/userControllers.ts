import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";

import User from "../models/users";
import { getSocket, getUserSessions } from "../utils/socket";

export const updateUserPasskey = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { newPasskey } = req.body;

  const user = await User.findOne({ _id: userId, role: "team" });

  if (!user) {
    res.status(404).json({ message: "User not found" });

    return;
  }

  try {
    await User.findByIdAndUpdate(userId, { passkey: newPasskey });

    res.status(200).json({ message: "Success updating passkey for the user" });

    return;
  } catch (err: any) {
    // if unique constraint is not met
    if (err.code === "PASSKEY_IN_USE") {
      res
        .status(400)
        .json({ message: "The passkey has already been used for other user" });
    }

    return;
  }
};

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "operator", "client"]),
});

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({
      role: { $in: ["admin", "operator", "client"] },
    })
      .select("-password -passkey")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ users, data: users });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch users", error: err });
  }
};

export const createAdmin = async (req: Request, res: Response) => {
  const { email, password, role } = req.body;

  const currentUser = (req as any).user;

  if (!["admin", "operator"].includes(currentUser.role)) {
    res
      .status(403)
      .json({ message: "You are not authorized to create a user" });

    return;
  }

  const { success, data, error } = createAdminSchema.safeParse(req.body);

  if (!success) {
    res.status(400).json({ message: error.message });

    return;
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });

  if (existingUser) {
    res.status(400).json({ message: "User already exists" });

    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    role,
    passkey: hashedPassword,
  });

  res.status(201).json({ message: "Admin created successfully", user });
};

const updateUserStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUser = (req as any).user;

    // Only admin can update user status
    if (currentUser.role !== "admin") {
      res.status(403).json({ message: "Only admins can update user status" });
      return;
    }

    // Cannot update own status (compare as strings to handle ObjectId vs string)
    const currentUserId = String(currentUser.userId || currentUser._id || "");
    if (currentUserId && String(userId) === currentUserId) {
      res.status(400).json({ message: "You cannot update your own status" });
      return;
    }

    const { success, data, error } = updateUserStatusSchema.safeParse(req.body);

    if (!success) {
      res.status(400).json({ message: error.message });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Only allow updating status for admin, operator, and client roles
    if (!["admin", "operator", "client"].includes(user.role)) {
      res.status(400).json({ message: "Cannot update status for team users" });
      return;
    }

    const oldStatus = user.status;
    const newStatus = data.status;

    // Update user status
    user.status = newStatus;
    await user.save();

    // If status changed to suspended, emit force logout event
    if (oldStatus === "active" && newStatus === "suspended") {
      const io = getSocket();
      const socketIds = getUserSessions(userId.toString());
      
      // Emit force logout to specific user's sockets
      if (socketIds.size > 0) {
        socketIds.forEach((socketId) => {
          io.to(socketId).emit("forceLogout", { userId: userId.toString() });
        });
      }
      
      // Also emit to all as fallback (client will check userId)
      io.emit("forceLogout", { userId: userId.toString() });
    }

    res.status(200).json({
      message: "User status updated successfully",
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err: any) {
    console.error("Error updating user status:", err);
    res.status(500).json({ message: "Failed to update user status", error: err });
  }
};

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const changeOwnPassword = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const userId = currentUser.userId || currentUser._id;

    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { success, data, error } = changeOwnPasswordSchema.safeParse(req.body);

    if (!success) {
      res.status(400).json({ message: error.message });
      return;
    }

    const user = await User.findById(userId);

    if (!user || !user.password) {
      res.status(404).json({ message: "User not found or has no password set" });
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      data.currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      res.status(401).json({ message: "Current password is incorrect" });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(data.newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (err: any) {
    console.error("Error changing password:", err);
    res.status(500).json({ message: "Failed to change password", error: err });
  }
};

const changeUserPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export const changeUserPassword = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUser = (req as any).user;

    // Only admin can change other users' passwords
    if (currentUser.role !== "admin") {
      res.status(403).json({ message: "Only admins can change user passwords" });
      return;
    }

    const { success, data, error } = changeUserPasswordSchema.safeParse(req.body);

    if (!success) {
      res.status(400).json({ message: error.message });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Only allow changing password for admin, operator, and client roles
    if (!["admin", "operator", "client"].includes(user.role)) {
      res.status(400).json({ message: "Cannot change password for team users" });
      return;
    }

    // Generate random password if not provided
    let plainTextPassword = data.newPassword;
    if (!plainTextPassword) {
      // Generate a random password (12 characters, alphanumeric + special chars)
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      plainTextPassword = Array.from({ length: 12 }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length))
      ).join("");
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(plainTextPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

    // Return the plain text password ONCE in the response.
    // This endpoint must only be reachable over TLS in production.
    // Consider logging (adminUserId, targetUserId, timestamp) for audit purposes.
    res.status(200).json({
      message: "Password changed successfully",
      password: plainTextPassword,
    });
  } catch (err: any) {
    console.error("Error changing user password:", err);
    res.status(500).json({ message: "Failed to change user password", error: err });
  }
};