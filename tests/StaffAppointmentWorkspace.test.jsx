import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StaffAppointmentWorkspace from '../src/components/staffAppointments/StaffAppointmentWorkspace';
import { BRANCH_ASSISTANT, BRANCH_MANAGER } from '../src/config/roles';

describe('StaffAppointmentWorkspace', () => {
  it('renders the shared appointment workspace information', () => {
    render(
      <StaffAppointmentWorkspace
        role={BRANCH_ASSISTANT}
        title="Appointment Management"
        description="Manage doctor sessions and customer bookings."
      >
        <p>Workspace content</p>
      </StaffAppointmentWorkspace>,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Appointment Management',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText('Gampaha Main Branch · Sri Lanka Time (Asia/Colombo)'),
    ).toBeInTheDocument();

    expect(screen.getByText('Workspace content')).toBeInTheDocument();
  });

  it('shows operational access for Branch Assistant', () => {
    render(
      <StaffAppointmentWorkspace
        role={BRANCH_ASSISTANT}
        title="Appointments"
      />,
    );

    expect(screen.getByText('Operational access')).toBeInTheDocument();
  });

  it('shows read-only access for Branch Manager', () => {
    render(
      <StaffAppointmentWorkspace role={BRANCH_MANAGER} title="Appointments" />,
    );

    expect(screen.getByText('Read-only access')).toBeInTheDocument();
  });

  it('renders an optional page action', () => {
    render(
      <StaffAppointmentWorkspace
        role={BRANCH_ASSISTANT}
        title="Appointments"
        action={<button type="button">Create Doctor Session</button>}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'Create Doctor Session',
      }),
    ).toBeInTheDocument();
  });

  it('switches between Doctor Sessions and Customer Bookings tabs', () => {
    const onTabChange = vi.fn();

    render(
      <StaffAppointmentWorkspace
        role={BRANCH_ASSISTANT}
        title="Appointments"
        activeTab="sessions"
        onTabChange={onTabChange}
      />,
    );

    expect(
      screen.getByRole('tab', {
        name: 'Doctor Sessions',
      }),
    ).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(
      screen.getByRole('tab', {
        name: 'Customer Bookings',
      }),
    );

    expect(onTabChange).toHaveBeenCalledWith('bookings');
  });

  it('marks the bookings tab active when requested', () => {
    render(
      <StaffAppointmentWorkspace
        role={BRANCH_ASSISTANT}
        title="Appointments"
        activeTab="bookings"
        onTabChange={() => {}}
      />,
    );

    expect(
      screen.getByRole('tab', {
        name: 'Customer Bookings',
      }),
    ).toHaveAttribute('aria-selected', 'true');
  });
});
