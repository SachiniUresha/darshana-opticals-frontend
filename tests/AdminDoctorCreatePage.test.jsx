import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminDoctorCreatePage from '../src/pages/AdminDoctorCreatePage';
import { createDoctor } from '../src/services/doctorAdminService';

const mockLogout = vi.hoisted(() => vi.fn());
vi.mock('../src/services/doctorAdminService', () => ({
  createDoctor: vi.fn(),
}));
vi.mock('../src/hooks/useAuth', () => ({
  default: () => ({ logout: mockLogout }),
}));

function showPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/doctors/new']}>
      <Routes>
        <Route path="/admin/doctors/new" element={<AdminDoctorCreatePage />} />
        <Route path="/login" element={<div>Login screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function completeForm() {
  fireEvent.change(screen.getByLabelText(/doctor name/i), {
    target: { value: ' Dr. Nimal Perera ' },
  });
  fireEvent.change(screen.getByLabelText(/specialization/i), {
    target: { value: ' Ophthalmologist ' },
  });
}

describe('AdminDoctorCreatePage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows exactly two required business fields without login inputs', () => {
    showPage();
    expect(
      screen.getByRole('heading', { name: 'Add New Doctor' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getByLabelText(/doctor name/i)).toBeRequired();
    expect(screen.getByLabelText(/specialization/i)).toBeRequired();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/branch/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it('rejects empty and whitespace-only inputs locally', () => {
    showPage();
    fireEvent.change(screen.getByLabelText(/doctor name/i), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Doctor' }));
    expect(screen.getByText(/doctor name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/specialization is required/i)).toBeInTheDocument();
    expect(createDoctor).not.toHaveBeenCalled();
  });

  it('submits only normalized fields and displays the safe Doctor confirmation', async () => {
    createDoctor.mockResolvedValue({
      id: 'doctor-1',
      name: 'Dr. Nimal Perera',
      specialization: 'Ophthalmologist',
    });
    showPage();
    completeForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add Doctor' }));
    await waitFor(() => expect(createDoctor).toHaveBeenCalledTimes(1));
    expect(createDoctor).toHaveBeenCalledWith({
      name: 'Dr. Nimal Perera',
      specialization: 'Ophthalmologist',
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Doctor Created' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Dr. Nimal Perera')).toBeInTheDocument();
    expect(screen.getByText('Ophthalmologist')).toBeInTheDocument();
    expect(document.querySelector('.admin-doctor__success-icon')).toBeNull();
    expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
  });

  it('prevents repeated requests while the first creation is pending', async () => {
    let finish;
    createDoctor.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    showPage();
    completeForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add Doctor' }));
    expect(
      screen.getByRole('button', { name: 'Registering Doctor...' }),
    ).toBeDisabled();
    expect(createDoctor).toHaveBeenCalledTimes(1);
    finish({
      id: 'doctor-1',
      name: 'Dr. Nimal Perera',
      specialization: 'Ophthalmologist',
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Doctor Created' }),
    ).toBeInTheDocument();
  });

  it('reports validation errors without showing false success', async () => {
    createDoctor.mockRejectedValue(
      Object.assign(new Error('Doctor data is invalid.'), { status: 422 }),
    );
    showPage();
    completeForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add Doctor' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /doctor data is invalid/i,
    );
    expect(
      screen.queryByRole('heading', { name: 'Doctor Created' }),
    ).not.toBeInTheDocument();
  });

  it('handles forbidden responses safely', async () => {
    createDoctor.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { status: 403 }),
    );
    showPage();
    completeForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add Doctor' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /do not have permission/i,
    );
  });

  it('logs out and returns to login after session expiry', async () => {
    createDoctor.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    );
    showPage();
    completeForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add Doctor' }));
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
  it.each([
    [0, 'Network unavailable', /unable to reach the server/i],
    [500, 'Unexpected internal details', /doctor could not be registered/i],
  ])(
    'handles Doctor error status %s safely',
    async (status, message, expected) => {
      createDoctor.mockRejectedValue(
        Object.assign(new Error(message), { status }),
      );
      showPage();
      completeForm();
      fireEvent.click(screen.getByRole('button', { name: 'Add Doctor' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(expected);
      expect(
        screen.queryByRole('heading', { level: 1, name: 'Doctor Created' }),
      ).not.toBeInTheDocument();
    },
  );
});
