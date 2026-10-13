import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PrescriptionHistoryPage from '../src/pages/PrescriptionHistoryPage';
import prescriptionService from '../src/services/prescription/prescriptionService';
import useAuth from '../src/hooks/useAuth';

vi.mock('../src/services/prescription/prescriptionService');
vi.mock('../src/hooks/useAuth');

const prescriptions = [
  {
    id: 'prescription-new',
    recordedAt: '2026-10-10T10:00:00.000Z',
    recordedBy: { name: 'Dr. Silva' },
    rightEye: {
      distance: { sph: -1.5, cyl: -0.5, axis: 90, va: '6/6' },
      reading: { add: 1.5, nearVa: 'N6' },
    },
    leftEye: {
      distance: { sph: -2, cyl: -0.75, axis: 0, va: '6/9' },
      reading: { add: 1.25, nearVa: 'N8' },
    },
    remarks: '<script>alert("unsafe")</script>',
  },
  {
    id: 'prescription-old',
    recordedAt: '2026-09-10T10:00:00.000Z',
    rightEye: { distance: { sph: -1 } },
    leftEye: { distance: { sph: -1.25 } },
    remarks: 'Previous record',
  },
];

function renderHistory() {
  return render(
    <MemoryRouter initialEntries={['/profile/prescriptions']}>
      <Routes>
        <Route
          path="/profile/prescriptions"
          element={<PrescriptionHistoryPage />}
        />
        <Route path="/login" element={<h1>Login destination</h1>} />
        <Route path="/profile" element={<h1>Profile destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PrescriptionHistoryPage', () => {
  let logout;

  beforeEach(() => {
    vi.clearAllMocks();
    logout = vi.fn();
    useAuth.mockReturnValue({ logout });
    prescriptionService.getMyPrescriptions.mockResolvedValue(prescriptions);
  });

  it('shows loading while history is requested', async () => {
    let resolveHistory;
    prescriptionService.getMyPrescriptions.mockReturnValue(
      new Promise((resolve) => {
        resolveHistory = resolve;
      }),
    );

    renderHistory();

    expect(screen.getByRole('status')).toHaveTextContent(
      /loading your prescription history/i,
    );

    await act(async () => {
      resolveHistory([]);
    });
  });

  it('renders all prescriptions in backend order', async () => {
    renderHistory();

    const cards = await screen.findAllByRole('article');

    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText(/Dr. Silva/)).toBeInTheDocument();
    expect(within(cards[1]).getByText('Previous record')).toBeInTheDocument();

    expect(prescriptionService.getMyPrescriptions).toHaveBeenCalledTimes(1);
  });

  it('shows both eyes with original clinical values', async () => {
    renderHistory();

    const cards = await screen.findAllByRole('article');
    const rightEye = within(cards[0]).getByRole('region', {
      name: 'Right Eye',
    });
    const leftEye = within(cards[0]).getByRole('region', {
      name: 'Left Eye',
    });

    expect(within(rightEye).getByText('-1.5')).toBeInTheDocument();
    expect(within(rightEye).getByText('90')).toBeInTheDocument();
    expect(within(rightEye).getByText('6/6')).toBeInTheDocument();
    expect(within(rightEye).getByText('N6')).toBeInTheDocument();

    expect(within(leftEye).getByText('-2')).toBeInTheDocument();
    expect(within(leftEye).getByText('0')).toBeInTheDocument();
    expect(within(leftEye).getByText('6/9')).toBeInTheDocument();
    expect(within(leftEye).getByText('N8')).toBeInTheDocument();
  });

  it('renders remarks as text, not executable HTML', async () => {
    renderHistory();

    expect(
      await screen.findByText('<script>alert("unsafe")</script>'),
    ).toBeInTheDocument();

    expect(document.querySelector('script')).toBeNull();
  });

  it('shows a clear empty state', async () => {
    prescriptionService.getMyPrescriptions.mockResolvedValue([]);

    renderHistory();

    expect(
      await screen.findByRole('heading', { name: /no prescriptions yet/i }),
    ).toBeInTheDocument();
  });

  it('has no customer create, edit, delete or upload actions', async () => {
    renderHistory();

    await screen.findAllByRole('article');

    expect(
      screen.queryByRole('button', {
        name: /create|edit|delete|upload|archive/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('redirects to login when the session expires', async () => {
    prescriptionService.getMyPrescriptions.mockRejectedValue({
      status: 401,
    });

    renderHistory();

    expect(
      await screen.findByRole('heading', { name: 'Login destination' }),
    ).toBeInTheDocument();

    expect(logout).toHaveBeenCalled();
  });

  it('shows a safe authorization error', async () => {
    prescriptionService.getMyPrescriptions.mockRejectedValue({
      status: 403,
    });

    renderHistory();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /do not have permission/i,
    );
  });

  it('can retry after a network failure', async () => {
    const user = userEvent.setup();

    prescriptionService.getMyPrescriptions
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce([]);

    renderHistory();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /unable to load/i,
    );

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(
      await screen.findByRole('heading', { name: /no prescriptions yet/i }),
    ).toBeInTheDocument();

    expect(prescriptionService.getMyPrescriptions).toHaveBeenCalledTimes(2);
  });

  it('allows returning to the existing profile', async () => {
    const user = userEvent.setup();

    renderHistory();

    await user.click(screen.getByRole('link', { name: /back to my profile/i }));

    expect(
      await screen.findByRole('heading', { name: 'Profile destination' }),
    ).toBeInTheDocument();
  });
});
