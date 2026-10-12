import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import profileService from '../services/profile/profileService';
import './ProfilePage.css';

const PROFILE_FIELDS = ['name', 'email', 'address', 'phone'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s()-]{7,20}$/;

function toFormValues(profile = {}) {
  return {
    name: profile.name ?? '',
    email: profile.email ?? '',
    address: profile.address ?? '',
    phone: profile.phone ?? '',
  };
}

function getInitials(name = '') {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'DO';
}

function validateProfileChanges(values, originalProfile) {
  const errors = {};
  const payload = {};

  for (const field of PROFILE_FIELDS) {
    const currentValue = values[field] ?? '';
    const originalValue = originalProfile?.[field] ?? '';

    if (currentValue === originalValue) {
      continue;
    }

    const trimmedValue = currentValue.trim();

    if (field === 'name' || field === 'address') {
      if (!trimmedValue) {
        errors[field] =
          `${field === 'name' ? 'Name' : 'Address'} cannot be empty.`;
        continue;
      }

      payload[field] = trimmedValue;
      continue;
    }

    if (field === 'email') {
      const normalizedEmail = trimmedValue.toLowerCase();

      if (!EMAIL_PATTERN.test(normalizedEmail)) {
        errors.email = 'Enter a valid email address.';
        continue;
      }

      payload.email = normalizedEmail;
      continue;
    }

    if (field === 'phone') {
      if (!PHONE_PATTERN.test(trimmedValue)) {
        errors.phone = 'Enter a valid phone number.';
        continue;
      }

      payload.phone = trimmedValue;
    }
  }

  return { errors, payload };
}

function getSafeErrorMessage(error) {
  if (!error?.status) {
    return 'Unable to reach the profile service. Check your connection and try again.';
  }

  if (error.status === 403) {
    return 'You do not have permission to access this customer profile.';
  }

  if (error.status === 404) {
    return 'Your customer profile could not be found.';
  }

  if (error.status === 409) {
    return 'That email address is already in use by another account.';
  }

  if (error.status === 400 || error.status === 422) {
    return (
      error.message || 'Please check the profile information and try again.'
    );
  }

  return 'We could not complete the profile request. Please try again later.';
}

function ProfilePage() {
  const navigate = useNavigate();
  const { logout, updateUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [formValues, setFormValues] = useState(toFormValues());
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'My Account | Darshana Opticals';

    let isActive = true;

    async function loadProfile() {
      setIsLoading(true);
      setPageError('');

      try {
        const loadedProfile = await profileService.getProfile();

        if (!isActive) {
          return;
        }

        setProfile(loadedProfile);
        setFormValues(toFormValues(loadedProfile));
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (error?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }

        setPageError(getSafeErrorMessage(error));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isActive = false;
      document.title = previousTitle;
    };
  }, [logout, navigate]);

  function handleFieldChange(event) {
    const { name, value } = event.target;

    setFormValues((current) => ({
      ...current,
      [name]: value,
    }));

    setFieldErrors((current) => ({
      ...current,
      [name]: '',
    }));

    setPageError('');
    setSuccessMessage('');
  }

  function beginEditing() {
    setFormValues(toFormValues(profile));
    setFieldErrors({});
    setPageError('');
    setSuccessMessage('');
    setIsEditing(true);
  }

  function cancelEditing() {
    setFormValues(toFormValues(profile));
    setFieldErrors({});
    setPageError('');
    setIsEditing(false);
  }

  function handleSignOut() {
    logout();
    navigate('/login', { replace: true });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSaving || !profile) {
      return;
    }

    const { errors, payload } = validateProfileChanges(formValues, profile);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setPageError('Please correct the highlighted fields.');
      return;
    }

    if (Object.keys(payload).length === 0) {
      setIsEditing(false);
      setSuccessMessage('No profile changes were needed.');
      return;
    }

    setIsSaving(true);
    setPageError('');
    setSuccessMessage('');

    try {
      const updatedProfile = await profileService.updateProfile(payload);

      setProfile(updatedProfile);
      setFormValues(toFormValues(updatedProfile));
      updateUser(updatedProfile);
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully.');
    } catch (error) {
      if (error?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }

      setPageError(getSafeErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  const pageHeading = (
    <header className="profile-page__heading">
      <h1 id="profile-title">My Account</h1>
      <p>Manage your profile &amp; preferences</p>
    </header>
  );

  if (isLoading) {
    return (
      <section className="profile-page" aria-labelledby="profile-title">
        {pageHeading}
        <div className="profile-page__state" role="status" aria-live="polite">
          <span className="profile-page__spinner" aria-hidden="true" />
          <p>Loading your profile...</p>
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="profile-page" aria-labelledby="profile-title">
        {pageHeading}
        <div className="profile-page__state profile-page__state--error">
          <p role="alert">{pageError || 'Your profile could not be loaded.'}</p>
          <button
            type="button"
            className="profile-page__button profile-page__button--primary"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="profile-page" aria-labelledby="profile-title">
      {pageHeading}

      <div className="profile-page__layout">
        <aside className="profile-sidebar" aria-label="Customer account">
          <div className="profile-sidebar__summary">
            <div className="profile-sidebar__avatar" aria-hidden="true">
              {getInitials(profile.name)}
            </div>

            <div className="profile-sidebar__identity">
              <strong title={profile.name}>{profile.name}</strong>
              <span title={profile.email}>{profile.email}</span>
              <small>Darshana Opticals customer</small>
            </div>
          </div>

          <nav className="profile-sidebar__nav" aria-label="Account sections">
            <span className="profile-sidebar__nav-item" aria-current="page">
              My Profile
            </span>
            <Link
              to="/profile/prescriptions"
              className="profile-sidebar__nav-link"
            >
              Prescription History
            </Link>
          </nav>

          <button
            type="button"
            className="profile-sidebar__sign-out"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </aside>

        <main className="profile-page__content">
          {successMessage && (
            <div
              className="profile-page__message profile-page__message--success"
              role="status"
            >
              {successMessage}
            </div>
          )}

          {pageError && (
            <div
              className="profile-page__message profile-page__message--error"
              role="alert"
            >
              {pageError}
            </div>
          )}

          <section
            className="profile-info-card"
            aria-labelledby="personal-information-title"
          >
            <header className="profile-info-card__header">
              <div>
                <h2 id="personal-information-title">Personal Information</h2>
                <p>Update your name, email and phone</p>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  className="profile-page__button profile-page__button--edit"
                  onClick={beginEditing}
                  aria-label="Edit profile"
                >
                  Edit
                </button>
              )}
            </header>

            {isEditing ? (
              <form className="profile-form" onSubmit={handleSubmit} noValidate>
                <div className="profile-form__grid">
                  <div className="profile-form__field">
                    <label htmlFor="profile-name">Full name</label>
                    <input
                      id="profile-name"
                      name="name"
                      type="text"
                      value={formValues.name}
                      onChange={handleFieldChange}
                      autoComplete="name"
                      disabled={isSaving}
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby={
                        fieldErrors.name ? 'profile-name-error' : undefined
                      }
                    />
                    {fieldErrors.name && (
                      <p
                        id="profile-name-error"
                        className="profile-form__error"
                      >
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>

                  <div className="profile-form__field">
                    <label htmlFor="profile-email">Email address</label>
                    <input
                      id="profile-email"
                      name="email"
                      type="email"
                      value={formValues.email}
                      onChange={handleFieldChange}
                      autoComplete="email"
                      disabled={isSaving}
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={
                        fieldErrors.email ? 'profile-email-error' : undefined
                      }
                    />
                    {fieldErrors.email && (
                      <p
                        id="profile-email-error"
                        className="profile-form__error"
                      >
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  <div className="profile-form__field">
                    <label htmlFor="profile-phone">Phone number</label>
                    <input
                      id="profile-phone"
                      name="phone"
                      type="tel"
                      value={formValues.phone}
                      onChange={handleFieldChange}
                      autoComplete="tel"
                      disabled={isSaving}
                      aria-invalid={Boolean(fieldErrors.phone)}
                      aria-describedby={
                        fieldErrors.phone ? 'profile-phone-error' : undefined
                      }
                    />
                    {fieldErrors.phone && (
                      <p
                        id="profile-phone-error"
                        className="profile-form__error"
                      >
                        {fieldErrors.phone}
                      </p>
                    )}
                  </div>

                  <div className="profile-form__field">
                    <label htmlFor="profile-address">Address</label>
                    <textarea
                      id="profile-address"
                      name="address"
                      rows="3"
                      value={formValues.address}
                      onChange={handleFieldChange}
                      autoComplete="street-address"
                      disabled={isSaving}
                      aria-invalid={Boolean(fieldErrors.address)}
                      aria-describedby={
                        fieldErrors.address
                          ? 'profile-address-error'
                          : undefined
                      }
                    />
                    {fieldErrors.address && (
                      <p
                        id="profile-address-error"
                        className="profile-form__error"
                      >
                        {fieldErrors.address}
                      </p>
                    )}
                  </div>
                </div>

                <p className="profile-form__note">
                  Account role, permissions, identifiers, and password
                  information cannot be changed from this page.
                </p>

                <div className="profile-form__actions">
                  <button
                    type="button"
                    className="profile-page__button profile-page__button--secondary"
                    onClick={cancelEditing}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="profile-page__button profile-page__button--primary"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <dl className="profile-details">
                <div className="profile-details__item">
                  <dt>Full Name</dt>
                  <dd>{profile.name}</dd>
                </div>

                <div className="profile-details__item">
                  <dt>Email Address</dt>
                  <dd>{profile.email}</dd>
                </div>

                <div className="profile-details__item">
                  <dt>Phone Number</dt>
                  <dd>{profile.phone}</dd>
                </div>

                <div className="profile-details__item">
                  <dt>Address</dt>
                  <dd>{profile.address || 'Not provided'}</dd>
                </div>
              </dl>
            )}
          </section>
        </main>
      </div>
    </section>
  );
}

export default ProfilePage;
