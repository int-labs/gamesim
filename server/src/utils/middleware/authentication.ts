import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../../models/users";

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(" ")[1]; // Extract token from "Bearer <token>"

  if (!token) {
    res.status(401).json({ message: "Unauthorized." });

    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;
    
    // Check if user is suspended
    if (decoded.userId) {
      const user = await User.findById(decoded.userId);
      if (user && user.status === "suspended") {
        res.status(403).json({ message: "Your account has been suspended. Please contact an administrator." });
        return;
      }
    }
    
    (req as any).user = decoded; // Attach user data to request

    next();

    return;
  } catch (error) {
    console.log("error:", error);

    res.status(403).json({ message: "Forbidden." });

    return;
  }
};
