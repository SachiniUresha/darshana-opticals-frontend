import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PrescriptionEntryForm from '../src/components/prescriptions/PrescriptionEntryForm';
import prescriptionService from '../src/services/prescription/prescriptionService';
import useAuth from '../src/hooks/useAuth';

vi.mock('../src/services/prescription/prescriptionService');
vi.mock('../src/hooks/useAuth');

const customer = {
  id: '507f1f77bcf86cd799439011',
  name: 'Kamal Perera',
  email: 'kamal@example.com',
};

const recorded = {
  id: 'new-prescription-1',
  recordedAt: '2026-10-12T10:00:00.000Z',
};

function renderForm() {
  return render(
    <MemoryRouter initialEntries={['/clinical/prescriptions/new']}>
      <Routes>
        <Route
          path="/clinical/prescriptions/new"
          element={<PrescriptionEntryForm customer={customer} />}
        />
        <Route path="/login" element={<h1>Login destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PrescriptionEntryForm', () => {
  let logout;

  beforeEach(() => {
    vi.clearAllMocks();
    logout = vi.fn();
    useAuth.mockReturnValue({ logout });
    prescriptionService.createPrescription.mockResolvedValue(recorded);
  });

  it('renders approved Right Eye and Left Eye fields', () => {
    renderForm();

    expect(screen.getByText(/recording for:/i)).toHaveTextContent(
      customer.name,
    );

    for (const eye of ['Right Eye', 'Left Eye']) {
      for (const field of [
        'SPH',
        'CYL',
        'Axis',
        'VA',
        'Add Power',
        'Near VA',
      ]) {
        expect(
          screen.getByRole(
            ['SPH', 'CYL', 'Axis', 'Add Power'].includes(field)
              ? 'spinbutton'
              : 'textbox',
            { name: `${eye} ${field}` },
          ),
        ).toBeInTheDocument();
      }
    }

    expect(screen.getByLabelText('Remarks')).toBeInTheDocument();
    expect(screen.queryByLabelText('recordedBy')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('recordedAt')).not.toBeInTheDocument();
  });

  it('accepts Axis 0 and 180 and sends only approved data', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(
      screen.getByRole('spinbutton', { name: 'Right Eye Axis' }),
      '0',
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'Left Eye Axis' }),
      '180',
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'Right Eye SPH' }),
      '-1.5',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Right Eye VA' }),
      '6/6',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Remarks' }),
      'Follow-up recommended.',
    );

    await user.click(
      screen.getByRole('button', { name: 'Record Prescription' }),
    );

    await waitFor(() =>
      expect(prescriptionService.createPrescription).toHaveBeenCalledOnce(),
    );

    const payload = prescriptionService.createPrescription.mock.calls[0][0];

    expect(payload.customerId).toBe(customer.id);
    expect(payload.rightEye.distance.axis).toBe(0);
    expect(payload.leftEye.distance.axis).toBe(180);
    expect(payload.rightEye.distance.sph).toBe(-1.5);
    expect(payload.rightEye.distance.va).toBe('6/6');
    expect(payload.remarks).toBe('Follow-up recommended.');

    expect(payload).not.toHaveProperty('recordedBy');
    expect(payload).not.toHaveProperty('recordedAt');
    expect(payload).not.toHaveProperty('isArchived');
    expect(payload).not.toHaveProperty('appointmentId');
  });

  it.each(['-1', '181'])('rejects Axis %s before submission', async (axis) => {
    const user = userEvent.setup();
    renderForm();

    await user.type(
      screen.getByRole('spinbutton', { name: 'Right Eye Axis' }),
      axis,
    );

    await user.click(
      screen.getByRole('button', { name: 'Record Prescription' }),
    );

    expect(
      screen.getByText('Axis must be between 0 and 180.'),
    ).toBeInTheDocument();

    expect(prescriptionService.createPrescription).not.toHaveBeenCalled();
  });

  it('omits blank optional measurements from the payload', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(
      screen.getByRole('button', { name: 'Record Prescription' }),
    );

    await waitFor(() =>
      expect(prescriptionService.createPrescription).toHaveBeenCalledOnce(),
    );

    expect(prescriptionService.createPrescription).toHaveBeenCalledWith({
      customerId: customer.id,
      rightEye: { distance: {}, reading: {} },
      leftEye: { distance: {}, reading: {} },
      remarks: '',
    });
  });

  it('prevents duplicate submission and keeps entered data while saving', async () => {
    const user = userEvent.setup();
    let resolveSave;

    prescriptionService.createPrescription.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );

    renderForm();

    const remarks = screen.getByRole('textbox', { name: 'Remarks' });

    await user.type(remarks, 'Important clinical note');

    await user.click(
      screen.getByRole('button', { name: 'Record Prescription' }),
    );

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();

    expect(remarks).toHaveValue('Important clinical note');
    expect(prescriptionService.createPrescription).toHaveBeenCalledOnce();

    await act(async () => {
      resolveSave(recorded);
    });

    expect(
      screen.getByText('Prescription recorded successfully.'),
    ).toBeInTheDocument();
  });

  it('creates a second historical prescription without changing the first record', async () => {
    const user = userEvent.setup();

    prescriptionService.createPrescription
      .mockResolvedValueOnce({
        id: 'prescription-1',
        recordedAt: '2026-10-12T10:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 'prescription-2',
        recordedAt: '2026-10-13T10:00:00.000Z',
      });

    renderForm();

    // Step 1: Enter and save the first prescription
    await user.type(
      screen.getByRole('spinbutton', { name: 'Right Eye SPH' }),
      '-1.5',
    );

    await user.click(
      screen.getByRole('button', { name: 'Record Prescription' }),
    );

    expect(
      await screen.findByText('Prescription recorded successfully.'),
    ).toBeInTheDocument();

    expect(prescriptionService.createPrescription).toHaveBeenCalledTimes(1);

    const firstPayload =
      prescriptionService.createPrescription.mock.calls[0][0];

    expect(firstPayload.customerId).toBe(customer.id);
    expect(firstPayload.rightEye.distance.sph).toBe(-1.5);

    // Prevent another submission while the saved result is displayed
    expect(
      screen.getByRole('button', { name: 'Record Prescription' }),
    ).toBeDisabled();

    // Step 2: Start a new historical record
    await user.click(
      screen.getByRole('button', {
        name: 'Record Another Prescription',
      }),
    );

    expect(
      screen.getByRole('button', { name: 'Record Prescription' }),
    ).toBeEnabled();

    // The new form must start with empty measurements
    expect(
      screen.getByRole('spinbutton', { name: 'Right Eye SPH' }),
    ).toHaveValue(null);

    // Step 3: Enter corrected measurements
    await user.type(
      screen.getByRole('spinbutton', { name: 'Right Eye SPH' }),
      '-2.0',
    );

    await user.type(
      screen.getByRole('textbox', { name: 'Remarks' }),
      'Corrected prescription',
    );

    // Step 4: Save the second prescription
    await user.click(
      screen.getByRole('button', { name: 'Record Prescription' }),
    );

    expect(
      await screen.findByText('Prescription recorded successfully.'),
    ).toBeInTheDocument();

    // Step 5: Verify two separate CREATE operations
    expect(prescriptionService.createPrescription).toHaveBeenCalledTimes(2);

    const secondPayload =
      prescriptionService.createPrescription.mock.calls[1][0];

    expect(secondPayload.customerId).toBe(customer.id);
    expect(secondPayload.rightEye.distance.sph).toBe(-2);
    expect(secondPayload.remarks).toBe('Corrected prescription');

    // Original historical data must remain unchanged
    expect(firstPayload.rightEye.distance.sph).toBe(-1.5);
    expect(firstPayload.remarks).toBe('');

    // Neither submission should attempt to identify a record to overwrite
    expect(firstPayload).not.toHaveProperty('id');
    expect(secondPayload).not.toHaveProperty('id');
  });

  it('preserves form values after validation errors', async () => {
    const user = userEvent.setup();

    prescriptionService.createPrescription.mockRejectedValue({
      status: 422,
      message: 'Backend validation details',
    });

    renderForm();

    const remarks = screen.getByRole('textbox', { name: 'Remarks' });
    await user.type(remarks, 'Preserve this note');

    await user.click(
      screen.getByRole('button', { name: 'Record Prescription' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /please check your measurements/i,
    );

    expect(remarks).toHaveValue('Preserve this note');
    expect(
      screen.queryByText('Backend validation details'),
    ).not.toBeInTheDocument();
  });

  it('handles missing customers safely', async () => {
    const user = userEvent.setup();

    prescriptionService.createPrescription.mockRejectedValue({
      status: 404,
    });

    renderForm();

    await user.click(
      screen.getByRole('button', { name: 'Record Prescription' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /selected customer could not be found/i,
    );
  });

  it('handles authorization failure safely', async () => {
    const user = userEvent.setup();

    prescriptionService.createPrescription.mockRejectedValue({
      status: 403,
    });

    renderForm();

    await user.click(
      screen.getByRole('button', { name: 'Record Prescription' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /do not have permission/i,
    );
  });

  it('redirects after an authentication failure', async () => {
    const user = userEvent.setup();

    prescriptionService.createPrescription.mockRejectedValue({
      status: 401,
    });

    renderForm();

    await user.click(
      screen.getByRole('button', { name: 'Record Prescription' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Login destination' }),
    ).toBeInTheDocument();

    expect(logout).toHaveBeenCalledOnce();
  });

  it('shows a safe network error without clearing entered data', async () => {
    const user = userEvent.setup();

    prescriptionService.createPrescription.mockRejectedValue(
      new Error('Internal connection details'),
    );

    renderForm();

    const remarks = screen.getByRole('textbox', { name: 'Remarks' });
    await user.type(remarks, 'Keep this information');

    await user.click(
      screen.getByRole('button', { name: 'Record Prescription' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /unable to save the prescription/i,
    );

    expect(remarks).toHaveValue('Keep this information');
    expect(
      screen.queryByText('Internal connection details'),
    ).not.toBeInTheDocument();
  });
});
