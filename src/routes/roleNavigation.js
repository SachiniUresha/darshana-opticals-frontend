import {
  isCanonicalRole,
  OPTOMETRIST,
  SYSTEM_ADMIN,
  BRANCH_MANAGER,
  BRANCH_ASSISTANT,
} from '../config/roles';

export const ROLE_DESTINATIONS = Object.freeze({
  [BRANCH_MANAGER]: '/staff/orders',
  [BRANCH_ASSISTANT]: '/staff/orders',
  [OPTOMETRIST]: '/clinical/prescriptions/new',
  [SYSTEM_ADMIN]: '/admin',
});

function isSafeInternalDestination(destination) {
  if (
    typeof destination !== 'string' ||
    !destination.startsWith('/') ||
    destination.startsWith('//') ||
    destination.includes('\\') ||
    [...destination].some((character) => {
      const code = character.charCodeAt(0);

      return code < 0x20 || code === 0x7f;
    })
  ) {
    return false;
  }

  try {
    return (
      new URL(destination, 'https://darshana.invalid').origin ===
      'https://darshana.invalid'
    );
  } catch {
    return false;
  }
}

export function getPostLoginRoute(role, destinations = ROLE_DESTINATIONS) {
  if (
    !isCanonicalRole(role) ||
    !destinations ||
    typeof destinations !== 'object' ||
    Array.isArray(destinations) ||
    !Object.prototype.hasOwnProperty.call(destinations, role)
  ) {
    return '/';
  }

  const destination = destinations[role];

  return isSafeInternalDestination(destination) ? destination : '/';
}
