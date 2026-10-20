import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminDoctorManagementPage from '../src/pages/AdminDoctorManagementPage';
import {
  listManagedDoctors,
  updateDoctorDetails,
  updateDoctorStatus,
} from '../src/services/doctorAdminService';

const mockLogout = vi.hoisted(() => vi.fn());
vi.mock('../src/hooks/useAuth', () => ({
  default: () => ({ logout: mockLogout }),
}));
vi.mock('../src/services/doctorAdminService', () => ({
  listManagedDoctors: vi.fn(),
  updateDoctorDetails: vi.fn(),
  updateDoctorStatus: vi.fn(),
}));

const doctors = [
  {
    id: 'doctor-1',
    name: 'Dr. Nimal Perera',
    specialization: 'Ophthalmologist',
    isActive: true,
  },
  {
    id: 'doctor-2',
    name: 'Dr. Saman Silva',
    specialization: 'Optics',
    isActive: false,
  },
];

function openPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/doctors']}>
      <Routes>
        <Route path="/admin/doctors" element={<AdminDoctorManagementPage />} />
        <Route path="/login" element={<h1>Login screen</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function showDoctors() {
  listManagedDoctors.mockResolvedValue(doctors);
  openPage();
  return screen.findByText('Dr. Nimal Perera');
}

describe('Doctor Management (DDP-094 Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('shows loading, then the Doctors with status, and preserves Add Doctor route', async () => {
    let resolveList;
    listManagedDoctors.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    openPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading Doctors');
    resolveList(doctors);
    expect(await screen.findByText('Dr. Nimal Perera')).toBeInTheDocument();
    expect(screen.getByText('Dr. Saman Silva')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add Doctor' })).toHaveAttribute(
      'href',
      '/admin/doctors/new',
    );
    expect(
      screen.getByRole('button', { name: 'Deactivate Dr. Nimal Perera' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Activate Dr. Saman Silva' }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  it('shows an empty state and does not invent production Doctors', async () => {
    listManagedDoctors.mockResolvedValue([]);
    openPage();
    expect(await screen.findByText('No Doctors found.')).toBeInTheDocument();
  });

  it('shows backend-unavailable error and retries', async () => {
    listManagedDoctors.mockRejectedValueOnce({ status: 404 });
    listManagedDoctors.mockResolvedValueOnce(doctors);
    openPage();
    expect(
      await screen.findByText(/unavailable until the backend is updated/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Dr. Nimal Perera')).toBeInTheDocument();
    expect(listManagedDoctors).toHaveBeenCalledTimes(2);
  });

  it('redirects after an expired session', async () => {
    listManagedDoctors.mockRejectedValue({ status: 401 });
    openPage();
    expect(
      await screen.findByRole('heading', { name: 'Login screen' }),
    ).toBeInTheDocument();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('prepopulates edit fields and rejects unchanged data', async () => {
    await showDoctors();
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Dr. Nimal Perera' }),
    );
    expect(screen.getByLabelText('Doctor Name')).toHaveValue(
      'Dr. Nimal Perera',
    );
    expect(screen.getByLabelText('Specialization')).toHaveValue(
      'Ophthalmologist',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getByText('No changes to save.')).toBeInTheDocument();
    expect(updateDoctorDetails).not.toHaveBeenCalled();
  });

  it('validates missing Doctor details locally', async () => {
    await showDoctors();
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Dr. Nimal Perera' }),
    );
    fireEvent.change(screen.getByLabelText('Doctor Name'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(
      screen.getByText(/Doctor name and specialization are required/i),
    ).toBeInTheDocument();
    expect(updateDoctorDetails).not.toHaveBeenCalled();
  });

  it('saves Doctor details and refreshes only after backend confirmation', async () => {
    listManagedDoctors.mockResolvedValue(doctors);
    updateDoctorDetails.mockResolvedValue({
      ...doctors[0],
      name: 'Dr. Nimal Fernando',
    });
    openPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Edit Dr. Nimal Perera' }),
    );
    fireEvent.change(screen.getByLabelText('Doctor Name'), {
      target: { value: ' Dr. Nimal Fernando ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() =>
      expect(updateDoctorDetails).toHaveBeenCalledWith('doctor-1', {
        name: 'Dr. Nimal Fernando',
        specialization: 'Ophthalmologist',
      }),
    );
    await waitFor(() => expect(listManagedDoctors).toHaveBeenCalledTimes(2));
    expect(
      screen.getByText(/Doctor details updated successfully/i),
    ).toBeInTheDocument();
  });

  it('requires deactivation confirmation and never modifies previous appointments', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await showDoctors();
    fireEvent.click(
      screen.getByRole('button', { name: 'Deactivate Dr. Nimal Perera' }),
    );
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(updateDoctorStatus).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    updateDoctorStatus.mockResolvedValue({ ...doctors[0], isActive: false });
    fireEvent.click(
      screen.getByRole('button', { name: 'Deactivate Dr. Nimal Perera' }),
    );
    await waitFor(() =>
      expect(updateDoctorStatus).toHaveBeenCalledWith('doctor-1', false),
    );
    await waitFor(() => expect(listManagedDoctors).toHaveBeenCalledTimes(2));
  });

  it('activates an inactive Doctor without requiring a deactivation confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    updateDoctorStatus.mockResolvedValue({ ...doctors[1], isActive: true });
    await showDoctors();
    fireEvent.click(
      screen.getByRole('button', { name: 'Activate Dr. Saman Silva' }),
    );
    await waitFor(() =>
      expect(updateDoctorStatus).toHaveBeenCalledWith('doctor-2', true),
    );
    expect(confirm).not.toHaveBeenCalled();
  });

  it('handles scheduling conflicts without reporting success', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    updateDoctorStatus.mockRejectedValue({ status: 409 });
    await showDoctors();
    fireEvent.click(
      screen.getByRole('button', { name: 'Deactivate Dr. Nimal Perera' }),
    );
    expect(
      await screen.findByText(/conflicts with existing Doctor sessions/i),
    ).toBeInTheDocument();
    expect(listManagedDoctors).toHaveBeenCalledTimes(1);
  });

  it('disables activation when status is unavailable', async () => {
    listManagedDoctors.mockResolvedValue([{ ...doctors[0], isActive: null }]);
    openPage();
    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /activate Dr. Nimal/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit Dr. Nimal Perera' }),
    ).toBeEnabled();
  });
});

// DDP-094 Admin UI accessibility/polish regression.
it('renders the doctor editor before the table when an Edit action is clicked', async () => {
  await showDoctors();
  fireEvent.click(
    screen.getByRole('button', { name: 'Edit Dr. Nimal Perera' }),
  );
  const editor = screen.getByRole('region', { name: 'Edit Dr. Nimal Perera' });
  const directory = screen.getByRole('region', {
    name: 'Doctor directory table',
  });
  expect(
    Boolean(
      editor.compareDocumentPosition(directory) &
      Node.DOCUMENT_POSITION_FOLLOWING,
    ),
  ).toBe(true);
});

// DDP-094 doctor status-tab and cross-tab search regression.
it('searches active and inactive Doctor records without exposing one status in the other tab', async () => {
  listManagedDoctors.mockImplementation(async ({ isActive, search }) =>
    doctors.filter(
      (entry) =>
        entry.isActive === isActive &&
        (!search ||
          (entry.name + ' ' + entry.specialization)
            .toLowerCase()
            .includes(search.toLowerCase())),
    ),
  );
  openPage();
  expect(await screen.findByText('Dr. Nimal Perera')).toBeInTheDocument();
  expect(screen.queryByText('Dr. Saman Silva')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search doctors' }), {
    target: { value: 'Saman' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Inactive Doctors' }));
  expect(await screen.findByText('Dr. Saman Silva')).toBeInTheDocument();
  expect(listManagedDoctors).toHaveBeenLastCalledWith({
    isActive: false,
    search: 'Saman',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Active Doctors' }));
  expect(await screen.findByText('No Doctors found.')).toBeInTheDocument();
});
