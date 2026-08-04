import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import User from "../models/users";
import Team from "../models/teams";
import jwt from "jsonwebtoken";
import { ROLES } from "../constants/roles";
import {
  DEFAULT_AVATAR_STYLE,
  generateAndStoreAvatar,
  isAvatarStyle,
} from "../services/avatars";

const SALT_ROUNDS = 10;

/**
 * POST /users/login — staff sign-in for the operator console.
 * Body: { email, password }
 *
 * Teams sign in with a passkey (below); admins, operators and clients sign in
 * with an email and password. This is the route that replaces the console's
 * hard-coded development token — with no login there was no way for the
 * dashboard to authenticate at all, so the token shipped inside the JS bundle.
 *
 * Deliberate choices:
 *  - `role: "team"` is refused here even with the right password. Team accounts
 *    exist per simulation and are addressed by passkey; letting one through
 *    this route would hand a team a staff-shaped session.
 *  - A wrong email and a wrong password return the identical 401, and the
 *    lookup runs a bcrypt compare against a dummy hash when no user matches,
 *    so response timing doesn't reveal which addresses exist.
 */
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      res.status(400).json({ message: "email and password are required." });
      return;
    }

    const user = await User.findOne({ email });

    // Same work whether or not the account exists — see the timing note above.
    const hash = user?.password ?? DUMMY_HASH;
    const ok = await bcrypt.compare(password, hash);

    if (!user || !ok || user.role === ROLES.TEAM) {
      res.status(401).json({ message: "Incorrect email or password." });
      return;
    }

    const token = jwt.sign(
      { role: user.role, userId: user._id },
      process.env.JWT_SECRET as string,
      { expiresIn: "12h" }
    );

    res.status(200).json({
      token,
      // Same shape as GET /users/me — the console renders the session from
      // whichever it got first, so a field present in one and absent from the
      // other shows up as an avatar that appears only after a reload.
      user: {
        _id: user._id,
        email: user.email,
        name: user.name ?? null,
        role: user.role,
        avatar: user.avatar ?? null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to log in." });
  }
};

/** A real bcrypt hash of a value nothing can supply, used only to keep the
 *  failure path's timing indistinguishable from the success path's. */
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.PjPMHUq0Q7ImV8YOZ5Yh6Ub4dGYS";

/**
 * GET /users/me — who the caller's token says they are.
 *
 * `authenticate` only verifies the JWT signature; it never touches the
 * database, so a validly signed token for a since-deleted account still passes
 * it. This route does the lookup, which is what lets the console tell a stale
 * session from a live one on boot instead of discovering it on the first write.
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role, teamId } = (req as any).user ?? {};

    if (!userId) {
      // Team tokens carry teamId, not userId — answer from the token itself.
      if (role === ROLES.TEAM) {
        res.status(200).json({ role, teamId: teamId ?? null });
        return;
      }
      res.status(401).json({ message: "Token carries no user." });
      return;
    }

    const user = await User.findById(userId).select("email name role avatar");
    if (!user) {
      res.status(401).json({ message: "This account no longer exists." });
      return;
    }

    res.status(200).json({
      _id: user._id,
      email: user.email,
      name: user.name ?? null,
      role: user.role,
      avatar: user.avatar ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to load account." });
  }
};

// POST /users/login-passkey
// Body: { passkey }

export const loginWithPasskey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { passkey } = req.body;

    if (!passkey) {
      res.status(400).json({ message: "passkey is required." });
      return;
    }

    const user = await User.findOne({ passkey, role: "team" });
    if (!user) {
      res.status(401).json({ message: "Invalid passkey." });
      return;
    }

    if (!user.teamId) {
      res.status(500).json({ message: "Team user is missing teamId." });
      return;
    }

    const team = await Team.findById(user.teamId);
    if (!team) {
      res.status(500).json({ message: "Team not found for this user." });
      return;
    }

    const token = jwt.sign(
      { role: "team", teamId: team._id, simulationId: team.simulationId },
      process.env.JWT_SECRET as string,
      { expiresIn: "12h" }
    );

    res.status(200).json({
      token,
      teamId: team._id,
      simulationId: team.simulationId,
      // The player had no idea who it was: `teamId` alone meant the game could
      // never greet a team by name or show the face the console generated for
      // it. Both already exist on the document being read here.
      teamName: team.teamName,
      avatar: team.avatar ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to log in." });
  }
};

const dynamicImport = new Function("specifier", "return import(specifier)");

const generatePasskey = async (): Promise<string> => {
  const mod = (await dynamicImport("random-words")) as any;
  const randomWords = mod.default ?? mod;
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
    const { email, name, password, role, teamId, avatar: requestedAvatar } = req.body;

    if (!role) {
      res.status(400).json({ message: "role is required." });
      return;
    }

    // Team users sign in by passkey only — `loginWithPasskey` never consults
    // the password — so requiring one just forced callers to invent a throwaway
    // value. Generate an unguessable one server-side instead, which keeps the
    // password login path permanently closed for these accounts.
    const effectivePassword =
      password ?? (role === ROLES.TEAM ? randomBytes(32).toString("hex") : null);

    if (!effectivePassword) {
      res.status(400).json({ message: "password is required for this role." });
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

    // `email` was never read out of the body, so every staff account created
    // over this route came back with no email — and `/users/login` matches on
    // email, so the account could never sign in. That is why bootstrapping an
    // admin needed its own script.
    if (role !== ROLES.TEAM && !email) {
      res.status(400).json({ message: "email is required for a staff account." });
      return;
    }

    const hashedPassword = await bcrypt.hash(effectivePassword, SALT_ROUNDS);

    // Same treatment teams get: the server renders the avatar, so `kind` +
    // `style` + `seed` stay the complete description and `url` is always
    // derived. A caller-supplied url is ignored.
    const style = isAvatarStyle(requestedAvatar?.style)
      ? requestedAvatar.style
      : DEFAULT_AVATAR_STYLE;
    const avatar = await generateAndStoreAvatar(
      style,
      String(requestedAvatar?.seed ?? name ?? email ?? role)
    ).catch(() => null);

    const user = await User.create({
      email:        email ?? null,
      name:         name  ?? null,
      password: hashedPassword,
      role,
      teamId:       teamId      ?? null,
      simulationId: simulationId ?? null,
      passkey:      passkey      ?? null,
      avatar,
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