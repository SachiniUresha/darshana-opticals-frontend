import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboardPage from '../src/pages/AdminDashboardPage';

describe('AdminDashboardPage', () => {
  it('shows only the two approved creation actions', () => {
    render(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Admin Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add staff/i })).toHaveAttribute(
      'href',
      '/admin/staff/new',
    );
    expect(screen.getByRole('link', { name: /add doctor/i })).toHaveAttribute(
      'href',
      '/admin/doctors/new',
    );
    expect(screen.queryByText(/delete staff/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage Staff' })).toHaveAttribute(
      'href',
      '/admin/staff',
    );
    expect(
      screen.getByRole('link', { name: 'Manage Doctors' }),
    ).toHaveAttribute('href', '/admin/doctors');
  });
});

// DDP-094 Admin UI accessibility/polish regression.
it('shows creation actions 01/02 above management actions 03/04', () => {
  render(
    <MemoryRouter>
      <AdminDashboardPage />
    </MemoryRouter>,
  );
  expect(
    screen
      .getAllByRole('heading', { level: 3 })
      .map((node) => node.textContent),
  ).toEqual([
    'Add Staff Member',
    'Add Doctor',
    'Staff Management',
    'Doctor Management',
  ]);
  expect(
    screen.getAllByText(/^(01|02|03|04)$/).map((node) => node.textContent),
  ).toEqual(['01', '02', '03', '04']);
});
