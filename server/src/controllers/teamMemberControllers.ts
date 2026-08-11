import { Request, Response } from "express";
import { z } from "zod";
import Team from "../models/teams";
import {
  AVATAR_STYLES,
  DEFAULT_AVATAR_STYLE,
  generateAndStoreAvatar,
  isAvatarStyle,
  renderAvatarSvg,
} from "../services/avatars";

/**
 * Team roster and avatars.
 *
 * AUTHORISATION: operators/admins, plus the OWNING team's own token. Teams are
 * meant to be able to name themselves and pick their faces; the player app
 * doesn't surface that yet, but the capability lives here so it can be turned
 * on without a backend change.
 */

const MAX_MEMBERS = 12;

const avatarSchema = z.object({
  kind: z.enum(["dicebear", "upload"]),
  style: z.string().max(60).nullish(),
  seed: z.string().max(120).nullish(),
  imageAssetId: z.string().length(24).nullish(),
  /**
   * Optional for `dicebear` — the server renders it from (style, seed), so a
   * caller that supplies one has it overwritten. Required in practice only for
   * `upload`, where the URL points at a stored object the server can't derive.
   *
   * Generous bound because generated avatars are inlined data URIs (~2 KB for
   * a DiceBear SVG, more for the busier styles), but still bounded so nobody
   * can park a megabyte of base64 on a team document.
   */
  url: z.string().min(1).max(200_000).optional(),
});

const memberSchema = z.object({
  _id: z.string().length(24).optional(),
  name: z.string().trim().min(1, "A member needs a name.").max(60),
  role: z.string().trim().max(60).nullish(),
  avatar: avatarSchema.nullish(),
  order: z.number().int().min(0).max(999).optional(),
});

const rosterSchema = z
  .array(memberSchema)
  .max(MAX_MEMBERS, `A team can have at most ${MAX_MEMBERS} members.`);

/** Admin/operator, or the team acting on itself. */
function canEditTeam(req: Request, teamId: string): boolean {
  const user = (req as any).user ?? {};
  if (user.role === "admin" || user.role === "operator") return true;
  return user.role === "team" && String(user.teamId) === String(teamId);
}

const forbid = (res: Response) =>
  res.status(403).json({ message: "You can only edit your own team." });

// GET /teams/:id/members
export const getTeamMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const team = await Team.findById(req.params.id).select("teamName avatar members");
    if (!team) {
      res.status(404).json({ message: "Team not found." });
      return;
    }
    res.status(200).json({
      teamId: team._id,
      teamName: team.teamName,
      avatar: team.avatar ?? null,
      members: [...(team.members ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch the roster." });
  }
};

// PUT /teams/:id/members — replaces the whole roster.
export const putTeamMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!canEditTeam(req, req.params.id)) {
      forbid(res);
      return;
    }

    const parsed = rosterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Roster is invalid.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }

    const team = await Team.findById(req.params.id);
    if (!team) {
      res.status(404).json({ message: "Team not found." });
      return;
    }

    /**
     * Render generated avatars HERE rather than trusting the caller's `url`.
     *
     * `kind: "dicebear"` plus a style and a seed is already a complete,
     * deterministic description of the image — asking the caller to also send
     * the rendered result made the URL a second source of truth, and one that
     * nothing validated. A client that sent a placeholder got that placeholder
     * stored verbatim and every avatar rendered as a broken image.
     *
     * An `upload` avatar still uses the URL it was given: that one points at a
     * real object in storage, which the server has no way to re-derive.
     */
    const members = await Promise.all(
      parsed.data.map(async (m, i) => {
        let avatar = (m.avatar as any) ?? null;

        if (avatar?.kind === "dicebear") {
          const style = isAvatarStyle(avatar.style) ? avatar.style : DEFAULT_AVATAR_STYLE;
          // Seed defaults to the member's name so a roster saved without one
          // still gets a stable, per-person face.
          const seed = String(avatar.seed ?? m.name);
          avatar = await generateAndStoreAvatar(style, seed);
        }

        return {
          ...(m._id ? { _id: m._id as any } : {}),
          name: m.name,
          role: m.role ?? null,
          avatar,
          // Order is derived from array position — the console reorders by
          // moving rows, so an explicit `order` from the client would just be
          // a second source of truth to keep in sync.
          order: i,
        };
      })
    );

    team.members = members as any;

    await team.save();
    res.status(200).json({
      message: "Roster saved.",
      members: team.members,
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to save the roster." });
  }
};

// PUT /teams/:id/avatar
export const putTeamAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!canEditTeam(req, req.params.id)) {
      forbid(res);
      return;
    }

    // `null` clears the avatar back to initials.
    const parsed =
      req.body === null || req.body?.avatar === null
        ? { success: true as const, data: null }
        : avatarSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ message: "Avatar is invalid." });
      return;
    }

    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { avatar: parsed.data },
      { new: true }
    ).select("teamName avatar");

    if (!team) {
      res.status(404).json({ message: "Team not found." });
      return;
    }

    res.status(200).json({ message: "Avatar saved.", avatar: team.avatar ?? null });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to save the avatar." });
  }
};

// GET /avatars/styles — the attribution-free styles the console may offer.
export const getAvatarStyles = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({ styles: AVATAR_STYLES });
};

// POST /avatars/preview — render without storing, for the picker grid.
export const previewAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { style, seed } = req.body ?? {};
    if (!isAvatarStyle(style)) {
      res.status(400).json({ message: `Unknown avatar style "${style}".` });
      return;
    }
    const svg = await renderAvatarSvg(style, String(seed ?? ""));
    res.status(200).json({ style, seed: String(seed ?? ""), svg });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to render the avatar." });
  }
};

// POST /avatars/dicebear — render, store as an ImageAsset, return the ref.
export const createDiceBearAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { style, seed, label } = req.body ?? {};
    if (!isAvatarStyle(style)) {
      res.status(400).json({ message: `Unknown avatar style "${style}".` });
      return;
    }
    if (typeof seed !== "string" || !seed.trim()) {
      res.status(400).json({ message: "A seed is required — it's what makes the avatar stable." });
      return;
    }

    const avatar = await generateAndStoreAvatar(style, seed.trim(), label);
    res.status(201).json(avatar);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to generate the avatar." });
  }
};
