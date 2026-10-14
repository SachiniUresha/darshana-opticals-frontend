import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import {
  createDoctorSession,
  getAppointmentProviders,
} from '../services/staffAppointmentService';
import './StaffDoctorSessionForm.css';

function toSriLankaIso(date, time) {
  if (!date || !time) {
    return null;
  }

  return `${date}T${time}:00+05:30`;
}

function createSessionErrorLabel(error) {
  switch (error?.code) {
    case 'OVERLAPPING_SESSION':
      return 'This Optometrist already has a session that overlaps with the selected time. Please choose another time.';

    case 'PROVIDER_CHANGED':
      return 'The selected Optometrist is no longer eligible for scheduling. Refresh providers and try again.';

    case 'INVALID_PROVIDER_BRANCH':
      return 'The selected Optometrist is not assigned to Gampaha Main Branch.';

    case 'INVALID_BRANCH':
      return 'Doctor sessions can only be created for Gampaha Main Branch.';

    default:
      break;
  }

  if (error?.status === 403) {
    return 'You do not have permission to create doctor sessions.';
  }

  if (error?.status === 404) {
    return 'The selected Optometrist is no longer available.';
  }

  if (error?.status === 400 || error?.status === 409 || error?.status === 422) {
    return 'The doctor session could not be created. Please review the session details and try again.';
  }

  if (error?.status === 0) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return 'Unable to create the doctor session. Please try again.';
}

export default function StaffCreateDoctorSessionPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [providers, setProviders] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [capacity, setCapacity] = useState('10');

  const [loadingProviders, setLoadingProviders] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [providerError, setProviderError] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldError, setFieldError] = useState('');

  const selectedProvider = useMemo(
    () =>
      providers.find((provider) => provider.id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
  );

  useEffect(() => {
    let active = true;
    const previousTitle = document.title;

    document.title = 'Create Doctor Session | Darshana Opticals';

    async function loadProviders() {
      setLoadingProviders(true);
      setProviderError('');

      try {
        const result = await getAppointmentProviders();

        if (!active) {
          return;
        }

        setProviders(result);

        if (result.length > 0) {
          setSelectedProviderId(result[0].id);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        if (error?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }

        if (error?.status === 403) {
          setProviderError(
            'You do not have permission to view eligible Optometrists.',
          );
        } else if (error?.status === 0) {
          setProviderError(
            'Unable to reach the server. Please check your connection and try again.',
          );
        } else {
          setProviderError(
            'Unable to load eligible Optometrists. Please try again.',
          );
        }
      } finally {
        if (active) {
          setLoadingProviders(false);
        }
      }
    }

    loadProviders();

    return () => {
      active = false;
      document.title = previousTitle;
    };
  }, [logout, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setFormError('');
    setFieldError('');

    if (!selectedProvider || !date || !startTime || !endTime || !capacity) {
      setFieldError('Please complete all required fields.');
      return;
    }

    const numericCapacity = Number(capacity);

    if (!Number.isSafeInteger(numericCapacity) || numericCapacity <= 0) {
      setFieldError('Capacity must be a positive whole number.');
      return;
    }

    const startAt = toSriLankaIso(date, startTime);
    const endAt = toSriLankaIso(date, endTime);

    if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      setFieldError('End time must be later than the start time.');
      return;
    }

    setSubmitting(true);

    try {
      const createdSession = await createDoctorSession({
        staffId: selectedProvider.id,
        branchId: selectedProvider.branchId,
        startAt,
        endAt,
        capacity: numericCapacity,
      });

      navigate(
        `/staff/appointments/sessions/${encodeURIComponent(createdSession.id)}`,
        {
          replace: true,
        },
      );
    } catch (error) {
      if (error?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }

      setFormError(createSessionErrorLabel(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="staff-session-form-page">
      <header className="staff-session-form-header">
        <div>
          <p className="staff-session-form-breadcrumb">
            STAFF / APPOINTMENTS / CREATE SESSION
          </p>

          <h1>Create Doctor Session</h1>

          <p>Schedule an eligible Optometrist at Gampaha Main Branch.</p>
        </div>

        <Link className="staff-session-form-back" to="/staff/appointments">
          Back to Sessions
        </Link>
      </header>

      <div className="staff-session-form-layout">
        <form
          className="staff-session-form-card"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="staff-session-form-card__heading">
            <h2>Create Doctor Session</h2>
            <p>
              Fields marked * are required. Branch is fixed to Gampaha Main
              Branch.
            </p>
          </div>

          {providerError ? (
            <div
              className="staff-session-form-alert staff-session-form-alert--error"
              role="alert"
            >
              <strong>Unable to load providers</strong>
              <span>{providerError}</span>
            </div>
          ) : null}

          <label>
            <span>Optometrist *</span>

            <select
              value={selectedProviderId}
              onChange={(event) => {
                setSelectedProviderId(event.target.value);
                setFieldError('');
                setFormError('');
              }}
              disabled={
                loadingProviders || submitting || providers.length === 0
              }
              required
            >
              {loadingProviders ? (
                <option value="">Loading Optometrists...</option>
              ) : providers.length === 0 ? (
                <option value="">No eligible Optometrists</option>
              ) : (
                providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label>
            <span>Date *</span>

            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setFieldError('');
                setFormError('');
              }}
              disabled={submitting}
              required
            />
          </label>

          <div className="staff-session-form-row">
            <label>
              <span>Start Time *</span>

              <input
                type="time"
                value={startTime}
                onChange={(event) => {
                  setStartTime(event.target.value);
                  setFieldError('');
                  setFormError('');
                }}
                disabled={submitting}
                required
              />
            </label>

            <label>
              <span>End Time *</span>

              <input
                type="time"
                value={endTime}
                onChange={(event) => {
                  setEndTime(event.target.value);
                  setFieldError('');
                  setFormError('');
                }}
                disabled={submitting}
                required
              />
            </label>
          </div>

          <div className="staff-session-form-row">
            <label>
              <span>Capacity *</span>

              <input
                type="number"
                min="1"
                step="1"
                value={capacity}
                onChange={(event) => {
                  setCapacity(event.target.value);
                  setFieldError('');
                  setFormError('');
                }}
                disabled={submitting}
                required
              />
            </label>

            <label>
              <span>Branch</span>

              <input
                type="text"
                value="Gampaha Main Branch · locked"
                readOnly
                aria-readonly="true"
              />
            </label>
          </div>

          {fieldError ? (
            <p className="staff-session-form-field-error" role="alert">
              {fieldError}
            </p>
          ) : null}

          <div className="staff-session-form-actions">
            <Link to="/staff/appointments">Cancel</Link>

            <button
              type="submit"
              disabled={
                submitting || loadingProviders || providers.length === 0
              }
            >
              {submitting ? 'Creating Session...' : 'Create Session'}
            </button>
          </div>
        </form>

        <aside className="staff-session-form-guidance">
          <section>
            <h2>Scheduling Guidelines</h2>

            <div>
              <strong>Eligible provider</strong>
              <p>Select only an Optometrist supplied by the backend.</p>
            </div>

            <div>
              <strong>Time validation</strong>
              <p>End time must be later than the start time.</p>
            </div>

            <div>
              <strong>Scheduling authority</strong>
              <p>
                The server validates overlapping sessions, capacity and branch.
              </p>
            </div>
          </section>

          <section className="staff-session-form-note">
            <strong>Backend validation</strong>
            <p>
              The system confirms the provider, branch, availability and
              overlapping-session rules before saving.
            </p>
          </section>
        </aside>
      </div>

      {formError ? (
        <div
          className="staff-session-form-alert staff-session-form-alert--error staff-session-form-page-error"
          role="alert"
        >
          <strong>Cannot create session</strong>
          <span>{formError}</span>
        </div>
      ) : null}

      <p className="staff-session-form-footer-note">
        Scheduling conflicts and provider eligibility are checked by the backend
        before confirmation.
      </p>
    </section>
  );
}
