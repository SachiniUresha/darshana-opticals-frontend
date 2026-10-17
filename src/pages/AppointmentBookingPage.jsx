import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import profileService from '../services/profile/profileService';
import {
  createAppointment,
  getAppointmentProviders,
  getAvailableDoctorSessions,
} from '../services/appointmentService';
import {
  appointmentAvailabilityErrorLabel,
  appointmentDateLabel,
  appointmentDateTimeLabel,
  appointmentStatusLabel,
  bookingErrorLabel,
  sessionTimeRangeLabel,
} from '../components/appointments/appointmentView';
import './AppointmentBookingPage.css';

const STEPS = ['Your Details', 'Choose Doctor', 'Date & Time', 'Confirm'];

const REFRESH_AFTER_BOOKING_ERROR = new Set([
  'SESSION_FULL',
  'BOOKING_WINDOW',
  'PROVIDER_CHANGED',
  'SESSION_CHANGED',
]);

function sessionDateKey(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Colombo',
  }).format(date);
}

function providerInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'DR';
  }

  const usableParts =
    parts[0].toLowerCase().startsWith('dr') && parts.length > 1
      ? parts.slice(1)
      : parts;

  return usableParts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function StepProgress({ currentStep }) {
  return (
    <ol
      className="appointment-progress"
      aria-label="Appointment booking progress"
    >
      {STEPS.map((label, index) => {
        const number = index + 1;
        const complete = number < currentStep;
        const active = number === currentStep;

        return (
          <li
            key={label}
            className={[
              'appointment-progress__step',
              complete ? 'appointment-progress__step--complete' : '',
              active ? 'appointment-progress__step--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={active ? 'step' : undefined}
          >
            <div className="appointment-progress__row">
              <span className="appointment-progress__circle">
                {complete ? '✓' : number}
              </span>

              {number < STEPS.length ? (
                <span
                  className="appointment-progress__line"
                  aria-hidden="true"
                />
              ) : null}
            </div>

            <span className="appointment-progress__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function AppointmentBookingPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);

  const [profile, setProfile] = useState(null);
  const [providers, setProviders] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [loadError, setLoadError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  const handleAuthenticationFailure = useCallback(
    (error) => {
      if (error?.status !== 401) {
        return false;
      }

      logout();
      navigate('/login', { replace: true });

      return true;
    },
    [logout, navigate],
  );

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const [loadedProfile, loadedProviders, loadedSessions] =
        await Promise.all([
          profileService.getProfile(),
          getAppointmentProviders(),
          getAvailableDoctorSessions(),
        ]);

      setProfile(loadedProfile);
      setProviders(loadedProviders);
      setSessions(loadedSessions);
    } catch (error) {
      if (handleAuthenticationFailure(error)) {
        return;
      }

      setLoadError(appointmentAvailabilityErrorLabel(error));
    } finally {
      setIsLoading(false);
    }
  }, [handleAuthenticationFailure]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Book Eye Test | Darshana Opticals';

    loadPageData();

    return () => {
      document.title = previousTitle;
    };
  }, [loadPageData]);

  const selectedProvider = useMemo(
    () =>
      providers.find((provider) => provider.id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
  );

  const providerSessions = useMemo(
    () => sessions.filter((session) => session.doctorId === selectedProviderId),
    [sessions, selectedProviderId],
  );

  const availableDates = useMemo(() => {
    const seen = new Set();

    return providerSessions.reduce((dates, session) => {
      const key = sessionDateKey(session.startAt);

      if (!key || seen.has(key)) {
        return dates;
      }

      seen.add(key);

      dates.push({
        key,
        label: appointmentDateLabel(session.startAt),
      });

      return dates;
    }, []);
  }, [providerSessions]);

  const sessionsForSelectedDate = useMemo(
    () =>
      providerSessions.filter(
        (session) => sessionDateKey(session.startAt) === selectedDateKey,
      ),
    [providerSessions, selectedDateKey],
  );

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  function moveToStep(step) {
    setBookingError('');
    setCurrentStep(step);
  }

  function chooseProvider(providerId) {
    setSelectedProviderId(providerId);
    setSelectedDateKey('');
    setSelectedSessionId('');
    setBookingError('');
  }

  function chooseDate(dateKey) {
    setSelectedDateKey(dateKey);
    setSelectedSessionId('');
    setBookingError('');
  }

  async function refreshSessionsAfterFailure() {
    try {
      const latestSessions = await getAvailableDoctorSessions();

      setSessions(latestSessions);

      const selectedStillExists = latestSessions.some(
        (session) => session.id === selectedSessionId,
      );

      if (!selectedStillExists) {
        setSelectedSessionId('');
        setSelectedDateKey('');
        setCurrentStep(3);
      }
    } catch (error) {
      handleAuthenticationFailure(error);
    }
  }

  async function handleBooking() {
    if (isSubmitting || !selectedProvider || !selectedSession) {
      return;
    }

    setIsSubmitting(true);
    setBookingError('');

    try {
      const result = await createAppointment(selectedSession.id);

      setConfirmation(result);
    } catch (error) {
      if (handleAuthenticationFailure(error)) {
        return;
      }

      setBookingError(bookingErrorLabel(error));

      if (
        REFRESH_AFTER_BOOKING_ERROR.has(error?.code) ||
        error?.status === 404
      ) {
        await refreshSessionsAfterFailure();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBookAnother() {
    setConfirmation(null);
    setCurrentStep(1);
    setSelectedProviderId('');
    setSelectedDateKey('');
    setSelectedSessionId('');
    setBookingError('');

    await loadPageData();
  }

  if (isLoading && !profile) {
    return (
      <section className="eye-test-page">
        <div className="eye-test-loading" role="status">
          Loading appointment booking...
        </div>
      </section>
    );
  }

  if (loadError && !profile) {
    return (
      <section className="eye-test-page">
        <div className="eye-test-loading">
          <h1>Book Your Eye Test</h1>

          <p role="alert">{loadError}</p>

          <button type="button" onClick={loadPageData} disabled={isLoading}>
            {isLoading ? 'Retrying...' : 'Try Again'}
          </button>
        </div>
      </section>
    );
  }

  if (confirmation) {
    const confirmationDoctorName =
      confirmation.doctorName ??
      confirmation.doctor?.name ??
      selectedProvider?.name ??
      'Doctor';

    const confirmationSpecialization =
      confirmation.specialization ??
      confirmation.doctor?.specialization ??
      selectedProvider?.specialization ??
      '';

    return (
      <section
        className="appointment-success-page"
        aria-labelledby="appointment-success-title"
      >
        <div className="appointment-success-card">
          <div className="appointment-success-card__icon" aria-hidden="true">
            ✓
          </div>

          <h1 id="appointment-success-title">Appointment Booked!</h1>

          <p>Your eye test has been successfully scheduled.</p>

          <dl className="appointment-success-details">
            <div>
              <dt>Patient</dt>
              <dd>{profile?.name || 'Customer'}</dd>
            </div>

            <div>
              <dt>Doctor</dt>
              <dd>
                {confirmationDoctorName}
                {confirmationSpecialization
                  ? ` — ${confirmationSpecialization}`
                  : ''}
              </dd>
            </div>

            <div>
              <dt>Date &amp; Time</dt>
              <dd>{appointmentDateTimeLabel(confirmation.dateTime)}</dd>
            </div>

            <div>
              <dt>Location</dt>
              <dd>Darshana Opticals — Gampaha Main Branch</dd>
            </div>

            <div>
              <dt>Status</dt>
              <dd>{appointmentStatusLabel(confirmation.status)}</dd>
            </div>

            <div>
              <dt>Queue Position</dt>
              <dd>{confirmation.position ?? 'Unavailable'}</dd>
            </div>
          </dl>

          <p className="appointment-success-reference">
            Appointment reference: <strong>{confirmation.id}</strong>
          </p>

          <button
            type="button"
            className="appointment-primary-button appointment-success-card__book-another"
            onClick={handleBookAnother}
          >
            Book Another Appointment
          </button>

          <Link
            to="/appointments"
            className="appointment-success-card__appointments-link"
          >
            View My Appointments
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="eye-test-page">
      <header className="eye-test-hero">
        <span className="eye-test-hero__badge">
          Eye Test — Gampaha Main Branch
        </span>

        <h1>Book Your Eye Test</h1>

        <p>
          Schedule a professional eye examination with one of our available
          doctors.
        </p>
      </header>

      <div className="eye-test-content">
        <StepProgress currentStep={currentStep} />

        {loadError ? (
          <div className="appointment-inline-error" role="alert">
            {loadError}
          </div>
        ) : null}

        {currentStep === 1 ? (
          <section
            className="eye-test-card"
            aria-labelledby="details-step-title"
          >
            <h2 id="details-step-title">Your details</h2>

            <div className="eye-test-fields">
              <div className="eye-test-field">
                <label htmlFor="appointment-full-name">Full Name</label>

                <div className="eye-test-readonly-field">
                  <span aria-hidden="true">○</span>

                  <input
                    id="appointment-full-name"
                    value={profile?.name ?? ''}
                    readOnly
                  />
                </div>
              </div>

              <div className="eye-test-field">
                <label htmlFor="appointment-phone">Phone Number</label>

                <div className="eye-test-readonly-field">
                  <span aria-hidden="true">⌕</span>

                  <input
                    id="appointment-phone"
                    value={profile?.phone ?? ''}
                    readOnly
                  />
                </div>
              </div>

              <div className="eye-test-field">
                <label htmlFor="appointment-email">Email Address</label>

                <div className="eye-test-readonly-field">
                  <span aria-hidden="true">✉</span>

                  <input
                    id="appointment-email"
                    value={profile?.email ?? ''}
                    readOnly
                  />
                </div>
              </div>
            </div>

            <div className="appointment-location-box">
              <span aria-hidden="true">⌖</span>

              <div>
                <strong>Appointment Location</strong>
                <span>Darshana Opticals — Gampaha Main Branch</span>
              </div>
            </div>

            <p className="appointment-profile-note">
              These details come from your customer profile.{' '}
              <Link to="/profile">Update profile details</Link>
            </p>

            <div className="eye-test-card__actions eye-test-card__actions--end">
              <button
                type="button"
                className="appointment-primary-button"
                onClick={() => moveToStep(2)}
              >
                Continue
                <span aria-hidden="true">›</span>
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section
            className="eye-test-card"
            aria-labelledby="doctor-step-title"
          >
            <h2 id="doctor-step-title">Choose your doctor</h2>

            {providers.length === 0 ? (
              <div className="appointment-empty-state">
                <p>No doctors are currently available.</p>

                <button
                  type="button"
                  onClick={loadPageData}
                  disabled={isLoading}
                >
                  Refresh
                </button>
              </div>
            ) : (
              <div className="doctor-choice-list">
                {providers.map((provider) => {
                  const providerSessionCount = sessions.filter(
                    (session) => session.doctorId === provider.id,
                  ).length;

                  const selected = selectedProviderId === provider.id;

                  return (
                    <button
                      key={provider.id}
                      type="button"
                      className={[
                        'doctor-choice-card',
                        selected ? 'doctor-choice-card--selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => chooseProvider(provider.id)}
                      aria-pressed={selected}
                    >
                      <span className="doctor-choice-card__avatar">
                        {providerInitials(provider.name)}
                      </span>

                      <span className="doctor-choice-card__details">
                        <strong>{provider.name}</strong>
                        <span>{provider.specialization}</span>
                        <small>
                          {providerSessionCount > 0
                            ? `${providerSessionCount} available ${
                                providerSessionCount === 1
                                  ? 'session'
                                  : 'sessions'
                              }`
                            : 'No sessions currently available'}
                        </small>
                      </span>

                      {selected ? (
                        <span
                          className="doctor-choice-card__check"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="eye-test-card__actions">
              <button
                type="button"
                className="appointment-back-button"
                onClick={() => moveToStep(1)}
              >
                ‹ Back
              </button>

              <button
                type="button"
                className="appointment-primary-button"
                onClick={() => moveToStep(3)}
                disabled={!selectedProvider}
              >
                Continue
                <span aria-hidden="true">›</span>
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 3 ? (
          <section className="eye-test-card" aria-labelledby="date-step-title">
            <h2 id="date-step-title">Pick a date &amp; time</h2>

            <p className="appointment-step-description">
              Choose an available date and time for your eye test.
            </p>

            {bookingError ? (
              <div className="appointment-inline-error" role="alert">
                {bookingError}
              </div>
            ) : null}

            {providerSessions.length === 0 ? (
              <div className="appointment-empty-state">
                <p>
                  No bookable sessions are currently available for{' '}
                  {selectedProvider?.name}.
                </p>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const latestSessions = await getAvailableDoctorSessions();

                      setSessions(latestSessions);
                    } catch (error) {
                      if (!handleAuthenticationFailure(error)) {
                        setBookingError(
                          appointmentAvailabilityErrorLabel(error),
                        );
                      }
                    }
                  }}
                >
                  Refresh Availability
                </button>
              </div>
            ) : (
              <>
                <div className="appointment-date-section">
                  <span className="appointment-field-label">
                    Available Date
                  </span>

                  <div className="appointment-date-options">
                    {availableDates.map((date) => (
                      <button
                        key={date.key}
                        type="button"
                        className={[
                          'appointment-date-button',
                          selectedDateKey === date.key
                            ? 'appointment-date-button--selected'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => chooseDate(date.key)}
                        aria-pressed={selectedDateKey === date.key}
                      >
                        {date.label}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedDateKey ? (
                  <fieldset className="appointment-time-section">
                    <legend>Available Doctor Sessions</legend>

                    <div className="appointment-time-options">
                      {sessionsForSelectedDate.map((session) => (
                        <label
                          key={session.id}
                          className={[
                            'appointment-time-option',
                            selectedSessionId === session.id
                              ? 'appointment-time-option--selected'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <input
                            type="radio"
                            name="doctor-session"
                            value={session.id}
                            checked={selectedSessionId === session.id}
                            onChange={() => {
                              setSelectedSessionId(session.id);
                              setBookingError('');
                            }}
                          />

                          <span>
                            {sessionTimeRangeLabel(
                              session.startAt,
                              session.endAt,
                            )}
                          </span>

                          <small>
                            {session.remainingCapacity}{' '}
                            {session.remainingCapacity === 1
                              ? 'place'
                              : 'places'}{' '}
                            available
                          </small>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <p className="appointment-date-prompt">
                    Choose one of the available dates to view its doctor
                    sessions.
                  </p>
                )}
              </>
            )}

            <div className="eye-test-card__actions">
              <button
                type="button"
                className="appointment-back-button"
                onClick={() => moveToStep(2)}
              >
                ‹ Back
              </button>

              <button
                type="button"
                className="appointment-primary-button"
                onClick={() => moveToStep(4)}
                disabled={!selectedSession}
              >
                Continue
                <span aria-hidden="true">›</span>
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 4 ? (
          <section
            className="eye-test-card eye-test-card--review"
            aria-labelledby="confirm-step-title"
          >
            <h2 id="confirm-step-title">Review &amp; confirm</h2>

            <dl className="appointment-review-list">
              <div>
                <dt>Patient Name</dt>
                <dd>{profile?.name}</dd>
              </div>

              <div>
                <dt>Phone</dt>
                <dd>{profile?.phone}</dd>
              </div>

              <div>
                <dt>Email</dt>
                <dd>{profile?.email}</dd>
              </div>

              <div>
                <dt>Doctor</dt>
                <dd>
                  {selectedProvider?.name}
                  {selectedProvider?.specialization
                    ? ` — ${selectedProvider.specialization}`
                    : ''}
                </dd>
              </div>

              <div>
                <dt>Date</dt>
                <dd>{appointmentDateLabel(selectedSession?.startAt)}</dd>
              </div>

              <div>
                <dt>Doctor Session</dt>
                <dd>
                  {sessionTimeRangeLabel(
                    selectedSession?.startAt,
                    selectedSession?.endAt,
                  )}
                </dd>
              </div>

              <div>
                <dt>Location</dt>
                <dd>Darshana Opticals — Gampaha Main Branch</dd>
              </div>
            </dl>

            {bookingError ? (
              <div className="appointment-inline-error" role="alert">
                {bookingError}
              </div>
            ) : null}

            <div className="eye-test-card__actions">
              <button
                type="button"
                className="appointment-back-button"
                onClick={() => moveToStep(3)}
                disabled={isSubmitting}
              >
                ‹ Back
              </button>

              <button
                type="button"
                className="appointment-confirm-button"
                onClick={handleBooking}
                disabled={isSubmitting}
              >
                <span aria-hidden="true">✓</span>

                {isSubmitting ? 'Confirming...' : 'Confirm Booking'}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

export default AppointmentBookingPage;
