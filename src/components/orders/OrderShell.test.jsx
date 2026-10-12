// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrderShell from './OrderShell';

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({
    user: { name: 'Test Customer', email: 'test@example.com' },
    logout: vi.fn(),
  }),
}));

describe('OrderShell account navigation', () => {
  it('shows customer profile and order history links', () => {
    render(
      <MemoryRouter initialEntries={['/orders']}>
        <OrderShell>
          <p>Order content</p>
        </OrderShell>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('link', { name: /My Profile/i }).getAttribute('href'),
    ).toBe('/profile');
    expect(
      screen.getByRole('link', { name: /Order History/i }).getAttribute('href'),
    ).toBe('/orders');
    expect(screen.getByText('Order content')).toBeTruthy();
    expect(screen.getByText('Test Customer')).toBeTruthy();
  });
});
