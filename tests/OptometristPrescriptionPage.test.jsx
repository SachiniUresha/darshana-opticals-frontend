import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OptometristPrescriptionPage from '../src/pages/OptometristPrescriptionPage';
import prescriptionService from '../src/services/prescription/prescriptionService';
import useAuth from '../src/hooks/useAuth';

vi.mock('../src/services/prescription/prescriptionService');
vi.mock('../src/hooks/useAuth');

const customers = [
  {
    id: '507f1f77bcf86cd799439011',
    name: 'Kamal Perera',
    email: 'kamal@example.com',
    phone: '+94711234567',
  },
  {
    id: '507f1f77bcf86cd799439012',
    name: 'Kamal Silva',
    email: 'silva@example.com',
    phone: '+94712222222',
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/clinical/prescriptions/new']}>
      <Routes>
        <Route
          path="/clinical/prescriptions/new"
          element={<OptometristPrescriptionPage />}
        />
        <Route path="/login" element={<h1>Login destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Optometrist customer selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      logout: vi.fn(),
    });

    prescriptionService.searchCustomers.mockResolvedValue(customers);
  });

  it('renders the customer search interface', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: /record prescription/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('searchbox', {
        name: /search by customer name, email or phone/i,
      }),
    ).toBeInTheDocument();
  });

  it('rejects a search shorter than two characters', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('searchbox'), 'K');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      /between 2 and 100 characters/i,
    );
    expect(prescriptionService.searchCustomers).not.toHaveBeenCalled();
  });

  it('finds and selects a customer', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('searchbox'), 'Kamal');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByRole('button', { name: 'Select Kamal Perera' }),
    ).toBeInTheDocument();

    expect(prescriptionService.searchCustomers).toHaveBeenCalledWith('Kamal');

    await user.click(
      screen.getByRole('button', { name: 'Select Kamal Perera' }),
    );

    expect(
      screen.getByRole('heading', { name: 'Selected Customer' }),
    ).toBeInTheDocument();

    expect(screen.getByText('Customer selected.')).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: 'New Prescription' }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('spinbutton', { name: 'Right Eye SPH' }),
    ).toBeInTheDocument();
  });

  it('shows an empty result state', async () => {
    const user = userEvent.setup();
    prescriptionService.searchCustomers.mockResolvedValue([]);
    renderPage();

    await user.type(screen.getByRole('searchbox'), 'Unknown');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByText('No matching customers found.'),
    ).toBeInTheDocument();
  });

  it('handles unauthorized searches safely', async () => {
    const user = userEvent.setup();
    prescriptionService.searchCustomers.mockRejectedValue({
      status: 403,
    });

    renderPage();

    await user.type(screen.getByRole('searchbox'), 'Kamal');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /do not have permission/i,
    );
  });

  it('redirects when the API reports an expired session', async () => {
    const user = userEvent.setup();
    const logout = vi.fn();

    useAuth.mockReturnValue({ logout });
    prescriptionService.searchCustomers.mockRejectedValue({
      status: 401,
    });

    renderPage();

    await user.type(screen.getByRole('searchbox'), 'Kamal');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByRole('heading', { name: 'Login destination' }),
    ).toBeInTheDocument();

    expect(logout).toHaveBeenCalledOnce();
  });
});
