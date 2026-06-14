import { NextFunction, Request, Response } from "express";

export const authorize = (allowedRoles: Array<string>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!allowedRoles.includes((req as any).user.role)) {
      res.status(403).json({ message: "Access denied." });

      return;
    }
    next();
  };
};
