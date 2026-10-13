export const CUSTOMER = 'CUSTOMER';
export const SYSTEM_ADMIN = 'SYSTEM_ADMIN';
export const BRANCH_MANAGER = 'BRANCH_MANAGER';
export const OPTOMETRIST = 'OPTOMETRIST';
export const BRANCH_ASSISTANT = 'BRANCH_ASSISTANT';

const CANONICAL_ROLES = new Set([
  CUSTOMER,
  SYSTEM_ADMIN,
  BRANCH_MANAGER,
  OPTOMETRIST,
  BRANCH_ASSISTANT,
]);

export function isCanonicalRole(role) {
  return typeof role === 'string' && CANONICAL_ROLES.has(role);
}
