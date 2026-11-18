export type UserRole = 'VIEWER' | 'OPERATOR' | 'ENGINEER' | 'ADMINISTRATOR';

export function isUserRole(value: unknown): value is UserRole {
  return (
    value === 'VIEWER' || value === 'OPERATOR' || value === 'ENGINEER' || value === 'ADMINISTRATOR'
  );
}
