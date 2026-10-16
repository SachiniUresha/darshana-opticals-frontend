import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import {
  BRANCH_MANAGER,
  BRANCH_ASSISTANT,
  CUSTOMER,
  OPTOMETRIST,
  SYSTEM_ADMIN,
  isCanonicalRole,
} from '../src/config/roles';
import { getPostLoginRoute } from '../src/routes/roleNavigation';

const canonicalRoles = [
  CUSTOMER,
  SYSTEM_ADMIN,
  BRANCH_MANAGER,
  BRANCH_ASSISTANT,
  OPTOMETRIST,
];

describe('canonical roles', () => {
  it.each(canonicalRoles)('accepts %s', (role) => {
    expect(isCanonicalRole(role)).toBe(true);
  });

  it.each([undefined, null, '', 'customer', 'ADMIN', 1, {}])(
    'rejects non-canonical role %s',
    (role) => {
      expect(isCanonicalRole(role)).toBe(false);
    },
  );
});

describe('post-login routing', () => {
  it.each(canonicalRoles.filter((role) => ![OPTOMETRIST, SYSTEM_ADMIN].includes(role)))(
    'safely falls back to Home for %s',
    (role) => {
      expect(getPostLoginRoute(role)).toBe('/');
    },
  );

  it('directs SYSTEM_ADMIN to the protected Admin Dashboard', () => {
    expect(getPostLoginRoute(SYSTEM_ADMIN)).toBe('/admin');
  });

  it('directs OPTOMETRIST to the Clinical recording workspace', () => {
    expect(getPostLoginRoute(OPTOMETRIST)).toBe('/clinical/prescriptions/new');
  });

  it.each([undefined, null, '', 'optometrist', 'ADMIN'])(
    'safely falls back for missing or unknown role %s',
    (role) => {
      expect(getPostLoginRoute(role)).toBe('/');
    },
  );

  it.each([
    'https://attacker.example',
    '//attacker.example/path',
    '/\\attacker.example/path',
    'javascript:alert(1)',
    'clinical',
    42,
  ])('rejects unsafe destination %s', (destination) => {
    expect(getPostLoginRoute(OPTOMETRIST, { [OPTOMETRIST]: destination })).toBe(
      '/',
    );
  });

  it('uses a configured internal destination when its test-only route exists', () => {
    const futureDestinations = { [OPTOMETRIST]: '/clinical' };
    const postLoginRoute = getPostLoginRoute(OPTOMETRIST, futureDestinations);

    render(
      createElement(
        MemoryRouter,
        { initialEntries: ['/login-success'] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: '/login-success',
            element: createElement(Navigate, {
              to: postLoginRoute,
              replace: true,
            }),
          }),
          createElement(Route, {
            path: '/clinical',
            element: createElement('h1', null, 'Clinical test route'),
          }),
        ),
      ),
    );

    expect(
      screen.getByRole('heading', { name: /clinical test route/i }),
    ).toBeInTheDocument();
  });
  it.each(['INVENTORY_MANAGER', 'MANAGEMENT', 'SALES_ASSISTANT_CASHIER'])(
    'rejects retired role %s',
    (role) => {
      expect(isCanonicalRole(role)).toBe(false);
    },
  );
});
