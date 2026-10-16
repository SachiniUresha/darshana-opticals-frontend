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
  });
});
