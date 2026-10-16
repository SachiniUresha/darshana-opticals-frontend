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
      return 'This Doctor already has a session that overlaps with the selected time. Please choose another time.';

    case 'PROVIDER_CHANGED':
      return 'The selected Doctor is no longer available. Refresh the Doctor list and try again.';

    case 'INVALID_BRANCH':
      return 'Doctor sessions can only be created for Gampaha Main Branch.';

    default:
      break;
  }

  if (error?.status === 403) {
    return 'You do not have permission to create Doctor sessions.';
  }

  if (error?.status === 404) {
    return 'The selected Doctor is no longer available.';
  }

  if (error?.status === 400 || error?.status === 409 || error?.status === 422) {
    return 'The Doctor session could not be created. Please review the session details and try again.';
  }

  if (error?.status === 0) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return 'Unable to create the Doctor session. Please try again.';
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
            'You do not have permission to view available Doctors.',
          );
        } else if (error?.status === 0) {
          setProviderError(
            'Unable to reach the server. Please check your connection and try again.',
          );
        } else {
          setProviderError('Unable to load Doctors. Please try again.');
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
        doctorId: selectedProvider.id,
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

          <p>Schedule an available Doctor at Gampaha Main Branch.</p>
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
              Fields marked * are required. Sessions are created for Gampaha
              Main Branch.
            </p>
          </div>

          {providerError ? (
            <div
              className="staff-session-form-alert staff-session-form-alert--error"
              role="alert"
            >
              <strong>Unable to load Doctors</strong>
              <span>{providerError}</span>
            </div>
          ) : null}

          <label>
            <span>Doctor *</span>

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
                <option value="">Loading Doctors...</option>
              ) : providers.length === 0 ? (
                <option value="">No Doctors available</option>
              ) : (
                providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                    {provider.specialization
                      ? ` — ${provider.specialization}`
                      : ''}
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
                value="Gampaha Main Branch · fixed"
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
              <strong>Doctor</strong>
              <p>Choose an available Doctor from the approved directory.</p>
            </div>

            <div>
              <strong>Time</strong>
              <p>End time must be later than the start time.</p>
            </div>

            <div>
              <strong>Capacity</strong>
              <p>Enter the maximum number of appointments for this session.</p>
            </div>
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
    </section>
  );
}
