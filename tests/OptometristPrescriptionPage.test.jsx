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
      screen.getByRole('heading', { name: /prescription handling/i }),
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

  it('submits the newly selected customer instead of the previous customer', async () => {
    const user = userEvent.setup();

    prescriptionService.searchCustomers
      .mockResolvedValueOnce([customers[0]])
      .mockResolvedValueOnce([customers[1]]);

    prescriptionService.createPrescription.mockResolvedValue({
      id: 'new-prescription-b',
    });

    renderPage();

    const searchBox = screen.getByRole('searchbox');

    // Step 1: Search and select Customer A
    await user.type(searchBox, 'Kamal Perera');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await user.click(
      await screen.findByRole('button', {
        name: 'Select Kamal Perera',
      }),
    );

    expect(screen.getByText(/recording for:/i)).toHaveTextContent(
      'Kamal Perera',
    );

    // Step 2: Change the search
    await user.clear(searchBox);

    // Old customer selection and form must be cleared
    expect(
      screen.queryByRole('heading', { name: 'New Prescription' }),
    ).not.toBeInTheDocument();

    // Step 3: Search and select Customer B
    await user.type(searchBox, 'Kamal Silva');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await user.click(
      await screen.findByRole('button', {
        name: 'Select Kamal Silva',
      }),
    );

    expect(screen.getByText(/recording for:/i)).toHaveTextContent(
      'Kamal Silva',
    );

    // Step 4: Submit prescription for Customer B
    await user.type(
      screen.getByRole('textbox', { name: 'Remarks' }),
      'New prescription for Customer B',
    );

    await user.click(
      screen.getByRole('button', { name: 'Record Prescription' }),
    );

    expect(
      await screen.findByText('Prescription recorded successfully.'),
    ).toBeInTheDocument();

    // Step 5: Verify only Customer B's authoritative ID was submitted
    expect(prescriptionService.createPrescription).toHaveBeenCalledOnce();

    const submittedPayload =
      prescriptionService.createPrescription.mock.calls[0][0];

    expect(submittedPayload.customerId).toBe(customers[1].id);
    expect(submittedPayload.customerId).not.toBe(customers[0].id);
  });

  it('returns to initial customer search after a successful prescription save', async () => {
    const user = userEvent.setup();
    prescriptionService.createPrescription.mockResolvedValue({
      id: 'new-prescription-1',
    });
    renderPage();
    const searchBox = screen.getByRole('searchbox');
    await user.type(searchBox, 'Kamal');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(
      await screen.findByRole('button', { name: 'Select Kamal Perera' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Record Prescription' }),
    );

    expect(
      await screen.findByText('Prescription recorded successfully.'),
    ).toBeInTheDocument();
    expect(searchBox).toHaveValue('');
    expect(
      screen.queryByRole('heading', { name: 'Selected Customer' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'New Prescription' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Record Another Prescription' }),
    ).not.toBeInTheDocument();
    expect(prescriptionService.createPrescription).toHaveBeenCalledOnce();
  });

  it('handles a lookup network failure without retaining stale customer selection', async () => {
    const user = userEvent.setup();

    prescriptionService.searchCustomers
      .mockResolvedValueOnce([customers[0]])
      .mockRejectedValueOnce(new Error('Internal server connection details'));

    renderPage();

    const searchBox = screen.getByRole('searchbox');

    // Step 1: Search and select Customer A
    await user.type(searchBox, 'Kamal');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await user.click(
      await screen.findByRole('button', {
        name: 'Select Kamal Perera',
      }),
    );

    expect(
      screen.getByRole('heading', { name: 'New Prescription' }),
    ).toBeInTheDocument();

    // Step 2: Change search and trigger a network failure
    await user.clear(searchBox);
    await user.type(searchBox, 'Silva');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    // Step 3: Safe error message is displayed
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to search customers. Please try again.',
    );

    // Step 4: Internal details are not exposed
    expect(
      screen.queryByText('Internal server connection details'),
    ).not.toBeInTheDocument();

    // Step 5: Previous customer selection is cleared
    expect(
      screen.queryByRole('heading', { name: 'Selected Customer' }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('heading', { name: 'New Prescription' }),
    ).not.toBeInTheDocument();

    // Step 6: Search is no longer loading
    expect(
      screen.queryByText('Searching for customers...'),
    ).not.toBeInTheDocument();

    expect(prescriptionService.searchCustomers).toHaveBeenCalledTimes(2);
  });
});
