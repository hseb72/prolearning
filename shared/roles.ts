/**
 * Rôles (cf. CLAUDE.md, « Rôles »). Ils sont cumulatifs : chaque rôle a les droits des
 * précédents. Tenus dans l'application, pas dans Keycloak.
 */
export const ROLES = ['employee', 'manager', 'training', 'admin'] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Vrai si `role` donne au moins les droits de `required`. */
export function hasRole(role: Role, required: Role): boolean {
  return ROLES.indexOf(role) >= ROLES.indexOf(required);
}
