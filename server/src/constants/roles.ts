export const ROLES = {
  ADMIN:    "admin",
  OPERATOR: "operator",
  CLIENT:   "client",
  TEAM:     "team",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];