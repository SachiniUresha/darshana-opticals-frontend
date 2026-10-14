import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom';
import AppRoutes from '../src/routes/AppRoutes';
import useAuth from '../src/hooks/useAuth';
import profileService from '../src/services/profile/profileService';
import prescriptionService from '../src/services/prescription/prescriptionService';
import {
  CUSTOMER,
  OPTOMETRIST,
  BRANCH_MANAGER,
  BRANCH_ASSISTANT,
  SYSTEM_ADMIN,
} from '../src/config/roles';

vi.mock('../src/hooks/useAuth');
vi.mock('../src/services/profile/profileService');
vi.mock('../src/services/prescription/prescriptionService');

vi.mock('../src/layouts/AppLayout', () => ({
  default: () => <Outlet />,
}));

vi.mock('../src/pages/LoginPage', () => ({
  default: () => <h1>Login destination</h1>,
}));

vi.mock('../src/pages/HomePage', () => ({
  default: () => <h1>Home destination</h1>,
}));

const customer = {
  id: '507f1f77bcf86cd799439011',
  name: 'Kamal Perera',
  email: 'kamal@example.com',
  phone: '+94711234567',
};

const history = [
  {
    id: 'prescription-2',
    recordedAt: '2026-10-10T10:00:00.000Z',
    recordedBy: { name: 'Dr. Silva' },
    rightEye: {
      distance: { sph: -1.5, axis: 90 },
    },
    leftEye: {
      distance: { sph: -2 },
    },
    remarks: 'Recent prescription',
  },
  {
    id: 'prescription-1',
    recordedAt: '2026-09-10T10:00:00.000Z',
    rightEye: { distance: { sph: -1 } },
    leftEye: { distance: { sph: -1.25 } },
    remarks: 'Previous prescription',
  },
];

function CurrentPath() {
  const location = useLocation();

  return <output data-testid="path">{location.pathname}</output>;
}

function renderApp(path, role, isAuthenticated = true) {
  useAuth.mockReturnValue({
    isAuthenticated,
    user: isAuthenticated ? { role } : null,
    logout: vi.fn(),
    updateUser: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
      <CurrentPath />
    </MemoryRouter>,
  );
}

describe('Prescription frontend integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    profileService.getProfile.mockResolvedValue({
      ...customer,
      address: 'Colombo',
      role: CUSTOMER,
    });

    prescriptionService.getMyPrescriptions.mockResolvedValue(history);
    prescriptionService.searchCustomers.mockResolvedValue([customer]);
    prescriptionService.createPrescription.mockResolvedValue({
      id: 'new-prescription',
      recordedAt: '2026-10-12T10:00:00.000Z',
    });
  });

  it('allows OPTOMETRIST to access the recording route', () => {
    renderApp('/clinical/prescriptions/new', OPTOMETRIST);

    expect(
      screen.getByRole('heading', {
        name: 'Record Prescription',
      }),
    ).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', () => {
    renderApp('/clinical/prescriptions/new', null, false);

    expect(
      screen.getByRole('heading', {
        name: 'Login destination',
      }),
    ).toBeInTheDocument();

    expect(screen.getByTestId('path')).toHaveTextContent('/login');
  });

  it.each([CUSTOMER, BRANCH_MANAGER, BRANCH_ASSISTANT, SYSTEM_ADMIN])(
    'blocks %s from recording prescriptions',
    (role) => {
      renderApp('/clinical/prescriptions/new', role);

      expect(
        screen.getByRole('heading', {
          name: 'Home destination',
        }),
      ).toBeInTheDocument();

      expect(
        screen.queryByRole('heading', {
          name: 'Record Prescription',
        }),
      ).not.toBeInTheDocument();
    },
  );

  it('navigates from Customer Profile to complete prescription history', async () => {
    const user = userEvent.setup();

    renderApp('/profile', CUSTOMER);

    await user.click(
      await screen.findByRole('link', {
        name: 'Prescription History',
      }),
    );

    const cards = await screen.findAllByRole('article');

    expect(cards).toHaveLength(2);

    expect(
      within(cards[0]).getByText('Recent prescription'),
    ).toBeInTheDocument();

    expect(
      within(cards[1]).getByText('Previous prescription'),
    ).toBeInTheDocument();

    expect(prescriptionService.getMyPrescriptions).toHaveBeenCalledOnce();

    expect(screen.getByTestId('path')).toHaveTextContent(
      '/profile/prescriptions',
    );
  });

  it('completes the Optometrist search, selection and recording flow', async () => {
    const user = userEvent.setup();

    renderApp('/clinical/prescriptions/new', OPTOMETRIST);

    await user.type(
      screen.getByRole('searchbox', {
        name: /search by customer name/i,
      }),
      'Kamal',
    );

    await user.click(screen.getByRole('button', { name: 'Search' }));

    await user.click(
      await screen.findByRole('button', {
        name: 'Select Kamal Perera',
      }),
    );

    expect(
      screen.getByRole('heading', {
        name: 'New Prescription',
      }),
    ).toBeInTheDocument();

    await user.type(
      screen.getByRole('spinbutton', {
        name: 'Right Eye SPH',
      }),
      '-1.5',
    );

    await user.type(
      screen.getByRole('spinbutton', {
        name: 'Left Eye Axis',
      }),
      '180',
    );

    await user.type(
      screen.getByRole('textbox', {
        name: 'Remarks',
      }),
      'Clinical follow-up',
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Record Prescription',
      }),
    );

    expect(
      await screen.findByText('Prescription recorded successfully.'),
    ).toBeInTheDocument();

    expect(prescriptionService.createPrescription).toHaveBeenCalledWith({
      customerId: customer.id,
      rightEye: {
        distance: { sph: -1.5 },
        reading: {},
      },
      leftEye: {
        distance: { axis: 180 },
        reading: {},
      },
      remarks: 'Clinical follow-up',
    });
  });
});
