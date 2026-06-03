import "jsonwebtoken";

declare module "jsonwebtoken" {
  export interface JwtPayload {
    userId?: string;
    role?: string;
    jti?: string;
    // extended payload
    teamId?: string | null;
    teamName?: string | null;
    teamLeader?: string | null;
    simulationId?: string | null;
  }
}
