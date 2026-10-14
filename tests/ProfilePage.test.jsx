import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProfilePage from '../src/pages/ProfilePage';
import useAuth from '../src/hooks/useAuth';
import profileService from '../src/services/profile/profileService';

vi.mock('../src/hooks/useAuth');
vi.mock('../src/services/profile/profileService');

const baseProfile = {
  id: 'customer-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  address: '10 Main Street, Colombo',
  phone: '+94711234567',
  role: 'CUSTOMER',
};

function createDeferred() {
  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function renderProfilePage() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/login" element={<h1>Login destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProfilePage', () => {
  let logout;
  let updateUser;

  beforeEach(() => {
    vi.clearAllMocks();

    logout = vi.fn();
    updateUser = vi.fn();

    useAuth.mockReturnValue({
      logout,
      updateUser,
    });

    profileService.getProfile.mockResolvedValue(baseProfile);
  });

  it('shows a loading state while profile information is being retrieved', async () => {
    const deferred = createDeferred();
    profileService.getProfile.mockReturnValue(deferred.promise);

    renderProfilePage();

    expect(screen.getByRole('status')).toHaveTextContent(
      /loading your profile/i,
    );

    await act(async () => {
      deferred.resolve(baseProfile);
    });
  });

  it('displays the Figma-aligned account layout and backend profile fields', async () => {
    renderProfilePage();

    expect(
      await screen.findByRole('heading', { name: /my account/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/manage your profile & preferences/i),
    ).toBeInTheDocument();
    expect(await screen.findByText('My Profile')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /personal information/i }),
    ).toBeInTheDocument();

    expect(screen.getAllByText(baseProfile.name).length).toBeGreaterThan(0);
    expect(screen.getAllByText(baseProfile.email).length).toBeGreaterThan(0);
    expect(screen.getByText(baseProfile.phone)).toBeInTheDocument();
    expect(screen.getByText(baseProfile.address)).toBeInTheDocument();
  });

  it('enters edit mode with labelled editable profile fields only', async () => {
    const user = userEvent.setup();

    renderProfilePage();

    await user.click(
      await screen.findByRole('button', { name: /edit profile/i }),
    );

    expect(screen.getByLabelText(/full name/i)).toHaveValue(baseProfile.name);
    expect(screen.getByLabelText(/email address/i)).toHaveValue(
      baseProfile.email,
    );
    expect(screen.getByLabelText(/phone number/i)).toHaveValue(
      baseProfile.phone,
    );
    expect(screen.getByLabelText(/^address$/i)).toHaveValue(
      baseProfile.address,
    );

    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/customer id/i)).not.toBeInTheDocument();
  });

  it('prevents clearly invalid client-side data from being submitted', async () => {
    const user = userEvent.setup();

    renderProfilePage();

    await user.click(
      await screen.findByRole('button', { name: /edit profile/i }),
    );

    const emailInput = screen.getByLabelText(/email address/i);
    await user.clear(emailInput);
    await user.type(emailInput, 'not-an-email');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(
      screen.getByText(/enter a valid email address/i),
    ).toBeInTheDocument();
    expect(profileService.updateProfile).not.toHaveBeenCalled();
  });

  it('submits only changed editable fields and refreshes the stored auth user', async () => {
    const user = userEvent.setup();
    const updatedProfile = {
      ...baseProfile,
      phone: '+94770000000',
    };

    profileService.updateProfile.mockResolvedValue(updatedProfile);

    renderProfilePage();

    await user.click(
      await screen.findByRole('button', { name: /edit profile/i }),
    );

    const phoneInput = screen.getByLabelText(/phone number/i);
    await user.clear(phoneInput);
    await user.type(phoneInput, '+94770000000');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(profileService.updateProfile).toHaveBeenCalledWith({
      phone: '+94770000000',
    });

    expect(updateUser).toHaveBeenCalledWith(updatedProfile);

    expect(await screen.findByRole('status')).toHaveTextContent(
      /profile updated successfully/i,
    );
    expect(screen.getByText('+94770000000')).toBeInTheDocument();
  });

  it('prevents duplicate update submissions while a save is pending', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();

    profileService.updateProfile.mockReturnValue(deferred.promise);

    renderProfilePage();

    await user.click(
      await screen.findByRole('button', { name: /edit profile/i }),
    );

    const nameInput = screen.getByLabelText(/full name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Jane Updated');

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    expect(profileService.updateProfile).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({
        ...baseProfile,
        name: 'Jane Updated',
      });
    });
  });

  it('logs out and redirects to login when the profile API returns 401', async () => {
    profileService.getProfile.mockRejectedValue({
      status: 401,
      message: 'Authentication required.',
    });

    renderProfilePage();

    expect(
      await screen.findByRole('heading', { name: /login destination/i }),
    ).toBeInTheDocument();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('allows the customer to sign out from the account sidebar', async () => {
    const user = userEvent.setup();

    renderProfilePage();

    await user.click(await screen.findByRole('button', { name: /sign out/i }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('heading', { name: /login destination/i }),
    ).toBeInTheDocument();
  });

  it('shows a friendly duplicate-email message for a 409 response', async () => {
    const user = userEvent.setup();

    profileService.updateProfile.mockRejectedValue({
      status: 409,
      message: 'An account with this email already exists.',
    });

    renderProfilePage();

    await user.click(
      await screen.findByRole('button', { name: /edit profile/i }),
    );

    const emailInput = screen.getByLabelText(/email address/i);
    await user.clear(emailInput);
    await user.type(emailInput, 'used@example.com');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /email address is already in use/i,
    );
  });

  it('does not expose backend technical messages for server failures', async () => {
    profileService.getProfile.mockRejectedValue({
      status: 500,
      message: 'MongoServerError: internal stack path',
    });

    renderProfilePage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not complete the profile request/i,
    );
    expect(screen.queryByText(/MongoServerError/i)).not.toBeInTheDocument();
  });

  it('provides access to prescription history from the profile sidebar', async () => {
    renderProfilePage();

    const historyLink = await screen.findByRole('link', {
      name: 'Prescription History',
    });

    expect(historyLink).toHaveAttribute('href', '/profile/prescriptions');
  });

  it('provides access to My Appointments from the profile sidebar', async () => {
    renderProfilePage();

    const appointmentsLink = await screen.findByRole('link', {
      name: 'My Appointments',
    });

    expect(appointmentsLink).toHaveAttribute('href', '/appointments');
  });
});
