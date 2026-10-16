import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import {
  getAppointmentProviders,
  getDoctorSessions,
  getStaffAppointments,
  updateDoctorSession,
} from '../services/staffAppointmentService';
import {
  appointmentDateLabel,
  sessionTimeRangeLabel,
} from '../components/appointments/appointmentView';
import './StaffEditDoctorSessionPage.css';

const TIME_ZONE = 'Asia/Colombo';

function toSriLankaFields(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: '',
      time: '',
    };
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    date: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
    time: `${getPart('hour')}:${getPart('minute')}`,
  };
}

function toSriLankaIso(date, time) {
  if (!date || !time) {
    return null;
  }

  return `${date}T${time}:00+05:30`;
}

function doctorDisplayName(doctor) {
  if (!doctor?.name) {
    return '';
  }

  return doctor.specialization
    ? `${doctor.name} — ${doctor.specialization}`
    : doctor.name;
}

function currentSessionDoctorLabel(session, providers) {
  if (!session) {
    return 'Doctor unavailable';
  }

  const directoryDoctor =
    providers.find((provider) => provider.id === session.doctorId) ?? null;

  if (directoryDoctor) {
    return doctorDisplayName(directoryDoctor);
  }

  if (session.doctor?.name) {
    return doctorDisplayName(session.doctor);
  }

  if (session.doctorName) {
    return session.specialization
      ? `${session.doctorName} — ${session.specialization}`
      : session.doctorName;
  }

  if (session.staffId) {
    return 'Legacy Optometrist session';
  }

  return 'Doctor unavailable';
}

function updateSessionErrorLabel(error) {
  switch (error?.code) {
    case 'OVERLAPPING_SESSION':
      return 'This Doctor already has another session that overlaps with the proposed time.';

    case 'CAPACITY_TOO_LOW':
      return 'Capacity cannot be reduced below the number of confirmed active bookings.';

    case 'INVALID_BRANCH':
      return 'Doctor sessions can only be managed for Gampaha Main Branch.';

    case 'OPTOMETRIST_REASSIGNMENT_UNSUPPORTED':
      return 'This session must be assigned to a Doctor before it can be updated.';

    default:
      break;
  }

  if (error?.status === 403) {
    return 'You do not have permission to update Doctor sessions.';
  }

  if (error?.status === 404) {
    return 'The Doctor session or selected Doctor is no longer available.';
  }

  if (error?.status === 400 || error?.status === 409 || error?.status === 422) {
    return 'The session changes could not be saved. Please review the details and try again.';
  }

  if (error?.status === 0) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return 'Unable to update the Doctor session. Please try again.';
}

export default function StaffEditDoctorSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [session, setSession] = useState(null);
  const [providers, setProviders] = useState([]);
  const [confirmedBookings, setConfirmedBookings] = useState(0);

  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [capacity, setCapacity] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [loadError, setLoadError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let active = true;
    const previousTitle = document.title;

    document.title = 'Edit Doctor Session | Darshana Opticals';

    async function load() {
      setLoading(true);
      setLoadError('');

      try {
        const [sessionData, providerData, appointmentData] = await Promise.all([
          getDoctorSessions(),
          getAppointmentProviders(),
          getStaffAppointments(),
        ]);

        if (!active) {
          return;
        }

        const selectedSession =
          sessionData.find((item) => item.id === sessionId) ?? null;

        if (!selectedSession) {
          setLoadError(
            'The Doctor session is unavailable or outside your approved workspace.',
          );
          return;
        }

        const start = toSriLankaFields(selectedSession.startAt);
        const end = toSriLankaFields(selectedSession.endAt);

        const bookings = appointmentData.filter(
          (appointment) =>
            appointment.sessionId === selectedSession.id &&
            appointment.status === 'CONFIRMED',
        );

        const currentDoctorExists = providerData.some(
          (provider) => provider.id === selectedSession.doctorId,
        );

        setSession(selectedSession);
        setProviders(providerData);
        setConfirmedBookings(bookings.length);

        setSelectedProviderId(
          currentDoctorExists ? selectedSession.doctorId : '',
        );
        setDate(start.date);
        setStartTime(start.time);
        setEndTime(end.time);
        setCapacity(String(selectedSession.capacity));
      } catch (error) {
        if (!active) {
          return;
        }

        if (error?.status === 401) {
          logout();
          navigate('/login', {
            replace: true,
          });
          return;
        }

        if (error?.status === 403) {
          setLoadError('You do not have permission to edit Doctor sessions.');
        } else if (error?.status === 0) {
          setLoadError(
            'Unable to reach the server. Please check your connection and try again.',
          );
        } else {
          setLoadError('Unable to load the Doctor session. Please try again.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
      document.title = previousTitle;
    };
  }, [logout, navigate, sessionId]);

  const selectedProvider = useMemo(
    () =>
      providers.find((provider) => provider.id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
  );

  const currentProviderLabel = useMemo(
    () => currentSessionDoctorLabel(session, providers),
    [providers, session],
  );

  const proposedStartAt = toSriLankaIso(date, startTime);
  const proposedEndAt = toSriLankaIso(date, endTime);

  function validateForm() {
    setFieldError('');
    setSubmitError('');

    if (!selectedProvider) {
      setFieldError('Please select a Doctor.');
      return false;
    }

    if (!date || !startTime || !endTime || !capacity) {
      setFieldError('Please complete all required fields.');
      return false;
    }

    const numericCapacity = Number(capacity);

    if (!Number.isSafeInteger(numericCapacity) || numericCapacity <= 0) {
      setFieldError('Capacity must be a positive whole number.');
      return false;
    }

    if (numericCapacity < confirmedBookings) {
      setFieldError(
        'Capacity cannot be lower than the confirmed bookings for this session.',
      );
      return false;
    }

    const startAt = toSriLankaIso(date, startTime);
    const endAt = toSriLankaIso(date, endTime);

    if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      setFieldError('End time must be later than the start time.');
      return false;
    }

    return true;
  }

  function handleReview(event) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setShowConfirmation(true);
  }

  async function confirmUpdate() {
    if (!validateForm() || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const updatedSession = await updateDoctorSession(session.id, {
        doctorId: selectedProvider.id,
        startAt: toSriLankaIso(date, startTime),
        endAt: toSriLankaIso(date, endTime),
        capacity: Number(capacity),
      });

      navigate(
        `/staff/appointments/sessions/${encodeURIComponent(updatedSession.id)}`,
        {
          replace: true,
        },
      );
    } catch (error) {
      if (error?.status === 401) {
        logout();
        navigate('/login', {
          replace: true,
        });
        return;
      }

      setShowConfirmation(false);
      setSubmitError(updateSessionErrorLabel(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="staff-edit-session-page">
        <p className="staff-edit-session-state" role="status">
          Loading Doctor session...
        </p>
      </section>
    );
  }

  if (loadError || !session) {
    return (
      <section className="staff-edit-session-page">
        <div
          className="staff-edit-session-state staff-edit-session-state--error"
          role="alert"
        >
          <h1>Unable to edit Doctor session</h1>

          <p>{loadError}</p>

          <Link to="/staff/appointments">Back to Sessions</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="staff-edit-session-page">
      <header className="staff-edit-session-header">
        <div>
          <p className="staff-edit-session-breadcrumb">
            STAFF / APPOINTMENTS / EDIT SESSION
          </p>

          <h1>Edit / Reschedule Doctor Session</h1>

          <p>
            Change the scheduled Doctor, time or capacity while keeping existing
            booking records.
          </p>
        </div>

        <Link
          className="staff-edit-session-back"
          to={`/staff/appointments/sessions/${encodeURIComponent(session.id)}`}
        >
          Back to Session
        </Link>
      </header>

      <div className="staff-edit-session-layout">
        <form
          className="staff-edit-session-form"
          onSubmit={handleReview}
          noValidate
        >
          <div>
            <h2>Edit / Reschedule Session</h2>

            <p>Update the session information for Gampaha Main Branch.</p>
          </div>

          <label>
            <span>Doctor *</span>

            <select
              value={selectedProviderId}
              onChange={(event) => {
                setSelectedProviderId(event.target.value);
                setFieldError('');
                setSubmitError('');
              }}
              disabled={submitting || providers.length === 0}
              required
            >
              <option value="">Select a Doctor</option>

              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {doctorDisplayName(provider)}
                </option>
              ))}
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
                setSubmitError('');
              }}
              disabled={submitting}
            />
          </label>

          <div className="staff-edit-session-row">
            <label>
              <span>Start Time *</span>

              <input
                type="time"
                value={startTime}
                onChange={(event) => {
                  setStartTime(event.target.value);
                  setFieldError('');
                  setSubmitError('');
                }}
                disabled={submitting}
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
                  setSubmitError('');
                }}
                disabled={submitting}
              />
            </label>
          </div>

          <div className="staff-edit-session-row">
            <label>
              <span>Capacity *</span>

              <input
                type="number"
                min={Math.max(1, confirmedBookings)}
                step="1"
                value={capacity}
                onChange={(event) => {
                  setCapacity(event.target.value);
                  setFieldError('');
                  setSubmitError('');
                }}
                disabled={submitting}
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
            <p className="staff-edit-session-field-error" role="alert">
              {fieldError}
            </p>
          ) : null}

          <div className="staff-edit-session-actions">
            <Link
              to={`/staff/appointments/sessions/${encodeURIComponent(
                session.id,
              )}`}
            >
              Cancel
            </Link>

            <button type="submit" disabled={submitting}>
              Save Session Changes
            </button>
          </div>
        </form>

        <aside className="staff-edit-session-aside">
          <section>
            <span className="staff-edit-session-count">
              {confirmedBookings} CONFIRMED
            </span>

            <h2>Bookings will be affected</h2>

            <p>
              {confirmedBookings} confirmed customer booking
              {confirmedBookings === 1 ? '' : 's'}{' '}
              {confirmedBookings === 1 ? 'is' : 'are'} associated with this
              session. Inform affected customers and the Doctor manually after
              making changes.
            </p>
          </section>

          <section className="staff-edit-session-warning">
            <strong>Customer communication</strong>

            <p>
              Contact affected customers directly if the session date, time or
              Doctor changes.
            </p>
          </section>

          <section>
            <h2>Current session</h2>

            <p>
              <strong>{appointmentDateLabel(session.startAt)}</strong>
            </p>

            <p>{sessionTimeRangeLabel(session.startAt, session.endAt)}</p>

            <p>{currentProviderLabel}</p>
          </section>
        </aside>
      </div>

      {submitError ? (
        <div className="staff-edit-session-submit-error" role="alert">
          <strong>Cannot save session changes</strong>
          <span>{submitError}</span>
        </div>
      ) : null}

      {showConfirmation ? (
        <div className="staff-edit-session-modal-backdrop" role="presentation">
          <section
            className="staff-edit-session-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-session-reschedule-title"
          >
            <div className="staff-edit-session-modal__title">
              <span aria-hidden="true">!</span>

              <div>
                <h2 id="confirm-session-reschedule-title">
                  Confirm Session Reschedule
                </h2>

                <p>
                  Review the current and proposed session details before
                  applying changes.
                </p>
              </div>
            </div>

            <div className="staff-edit-session-comparison">
              <div>
                <span>Current Session</span>

                <strong>{currentProviderLabel}</strong>

                <small>Branch: Gampaha Main Branch</small>

                <small>Date: {appointmentDateLabel(session.startAt)}</small>

                <small>
                  Time: {sessionTimeRangeLabel(session.startAt, session.endAt)}
                </small>

                <small>Capacity: {session.capacity}</small>
              </div>

              <strong aria-hidden="true">→</strong>

              <div>
                <span>Proposed Session</span>

                <strong>
                  {selectedProvider
                    ? doctorDisplayName(selectedProvider)
                    : 'Doctor not selected'}
                </strong>

                <small>Branch: Gampaha Main Branch</small>

                <small>Date: {appointmentDateLabel(proposedStartAt)}</small>

                <small>
                  Time: {sessionTimeRangeLabel(proposedStartAt, proposedEndAt)}
                </small>

                <small>Capacity: {capacity}</small>
              </div>
            </div>

            {confirmedBookings > 0 ? (
              <div className="staff-edit-session-modal__affected">
                <strong>
                  {confirmedBookings} customer
                  {confirmedBookings === 1 ? '' : 's'} affected
                </strong>

                <p>
                  Inform affected customers about the updated appointment
                  details after saving.
                </p>
              </div>
            ) : null}

            <div className="staff-edit-session-modal__actions">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                disabled={submitting}
              >
                Keep Current Session
              </button>

              <button
                type="button"
                onClick={confirmUpdate}
                disabled={submitting}
              >
                {submitting ? 'Saving Changes...' : 'Confirm Reschedule'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
