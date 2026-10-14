import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import {
  getAppointmentProviders,
  getDoctorSessions,
  getStaffAppointment,
  reassignStaffAppointment,
} from '../services/staffAppointmentService';
import {
  appointmentDateLabel,
  appointmentTimeLabel,
  sessionTimeRangeLabel,
} from '../components/appointments/appointmentView';
import './StaffMoveAppointmentPage.css';

const MIN_LEAD_TIME_MS = 24 * 60 * 60 * 1000;

function moveErrorLabel(error) {
  switch (error?.code) {
    case 'SESSION_FULL':
      return 'The selected target session is full or its availability changed. Please choose another session.';

    case 'BOOKING_WINDOW':
      return 'The selected target session is too close to its start time. Choose a session at least 24 hours away.';

    case 'DUPLICATE_BOOKING':
      return 'This customer already has a confirmed booking in the selected target session.';

    case 'SAME_SESSION':
      return 'The appointment is already assigned to that doctor session.';

    case 'SESSION_CHANGED':
      return 'The source session changed while the booking was being moved. Please refresh and try again.';

    case 'INVALID_STATUS':
      return 'Only confirmed appointments can be moved to another session.';

    case 'INVALID_BRANCH':
      return 'Appointments can only be moved within the approved Gampaha Main Branch.';

    default:
      break;
  }

  if (error?.status === 403) {
    return 'You do not have permission to move this appointment.';
  }

  if (error?.status === 404) {
    return 'The appointment or selected doctor session is no longer available.';
  }

  if (error?.status === 400 || error?.status === 409 || error?.status === 422) {
    return 'The booking could not be moved because the latest backend state no longer allows this change.';
  }

  if (error?.status === 0) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return 'Unable to move the booking. Please try again.';
}

function loadErrorLabel(error) {
  if (error?.status === 403) {
    return 'You do not have permission to move customer appointments.';
  }

  if (error?.status === 404) {
    return 'The appointment is no longer available.';
  }

  if (error?.status === 0) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return 'Unable to load booking reassignment information. Please try again.';
}

export default function StaffMoveAppointmentPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [appointment, setAppointment] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [providers, setProviders] = useState([]);

  const [selectedSessionId, setSelectedSessionId] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [loadError, setLoadError] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [actionError, setActionError] = useState('');

  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    let active = true;
    const previousTitle = document.title;

    document.title = 'Move Booking | Darshana Opticals';

    async function load() {
      setLoading(true);
      setLoadError('');

      try {
        const [appointmentData, sessionData, providerData] = await Promise.all([
          getStaffAppointment(appointmentId),
          getDoctorSessions(),
          getAppointmentProviders(),
        ]);

        if (!active) {
          return;
        }

        setAppointment(appointmentData);
        setSessions(sessionData);
        setProviders(providerData);
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

        setLoadError(loadErrorLabel(error));
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
  }, [appointmentId, logout, navigate]);

  const providerNames = useMemo(() => {
    const names = new Map();

    for (const provider of providers) {
      names.set(provider.id, provider.name);
    }

    return names;
  }, [providers]);

  const eligibleSessions = useMemo(() => {
    if (!appointment) {
      return [];
    }

    const earliestAllowed = Date.now() + MIN_LEAD_TIME_MS;

    return [...sessions]
      .filter((session) => {
        if (session.id === appointment.sessionId) {
          return false;
        }

        const start = new Date(session.startAt);

        if (Number.isNaN(start.getTime())) {
          return false;
        }

        if (start.getTime() < earliestAllowed) {
          return false;
        }

        if (session.remainingCapacity <= 0) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
  }, [appointment, sessions]);

  const selectedSession =
    eligibleSessions.find((session) => session.id === selectedSessionId) ??
    null;

  function providerLabel(staffId) {
    return (
      providerNames.get(staffId) ?? `Provider …${String(staffId).slice(-6)}`
    );
  }

  function openConfirmation() {
    setSelectionError('');
    setActionError('');

    if (!selectedSession) {
      setSelectionError('Select an available target doctor session first.');

      return;
    }

    setShowConfirmation(true);
  }

  async function confirmMove() {
    if (!selectedSession || submitting) {
      return;
    }

    setSubmitting(true);
    setActionError('');

    try {
      await reassignStaffAppointment(appointment.id, selectedSession.id);

      const refreshedAppointment = await getStaffAppointment(appointment.id);

      if (refreshedAppointment.sessionId !== selectedSession.id) {
        throw Object.assign(new Error('Authoritative reassignment mismatch'), {
          status: 409,
          code: 'SESSION_CHANGED',
        });
      }

      navigate(
        `/staff/appointments/bookings/${encodeURIComponent(appointment.id)}`,
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
      setActionError(moveErrorLabel(error));

      try {
        const refreshedSessions = await getDoctorSessions();

        setSessions(refreshedSessions);
      } catch {
        // Keep the original safe reassignment error visible.
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="staff-move-booking-page">
        <p className="staff-move-booking-state" role="status">
          Loading available doctor sessions...
        </p>
      </section>
    );
  }

  if (loadError || !appointment) {
    return (
      <section className="staff-move-booking-page">
        <div
          className="staff-move-booking-state staff-move-booking-state--error"
          role="alert"
        >
          <h1>Unable to move booking</h1>

          <p>{loadError}</p>

          <Link to="/staff/appointments?tab=bookings">
            Back to Customer Bookings
          </Link>
        </div>
      </section>
    );
  }

  if (appointment.status !== 'CONFIRMED') {
    return (
      <section className="staff-move-booking-page">
        <div className="staff-move-booking-state">
          <h1>Booking cannot be moved</h1>

          <p>
            Only confirmed appointments can be reassigned to another doctor
            session.
          </p>

          <Link
            to={`/staff/appointments/bookings/${encodeURIComponent(
              appointment.id,
            )}`}
          >
            Back to Appointment
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="staff-move-booking-page">
      <header className="staff-move-booking-header">
        <div>
          <p className="staff-move-booking-breadcrumb">
            STAFF / APPOINTMENTS / MOVE BOOKING
          </p>

          <h1>Move Customer Booking</h1>

          <p>
            Select another eligible doctor session for this confirmed
            appointment.
          </p>
        </div>

        <Link
          className="staff-move-booking-back"
          to={`/staff/appointments/bookings/${encodeURIComponent(
            appointment.id,
          )}`}
        >
          Back to Appointment
        </Link>
      </header>

      {actionError ? (
        <div
          className="staff-move-booking-message staff-move-booking-message--error"
          role="alert"
        >
          <strong>Cannot move booking</strong>
          <span>{actionError}</span>
        </div>
      ) : null}

      <section className="staff-move-booking-current">
        <div>
          <span>Current Appointment</span>

          <strong>
            {appointment.customer?.name ?? 'Customer unavailable'}
          </strong>

          <small>
            {appointmentDateLabel(appointment.dateTime)} ·{' '}
            {appointmentTimeLabel(appointment.dateTime)}
          </small>
        </div>

        <div>
          <span>Current Optometrist</span>

          <strong>
            {appointment.providerName ?? providerLabel(appointment.staffId)}
          </strong>

          <small>
            Position{' '}
            {appointment.position == null
              ? 'unavailable'
              : `#${appointment.position}`}
          </small>
        </div>
      </section>

      <section className="staff-move-booking-selection">
        <div className="staff-move-booking-selection__heading">
          <div>
            <h2>Available Sessions</h2>

            <p>
              Sessions shown here are outside the current booking, have reported
              capacity and are at least 24 hours away.
            </p>
          </div>

          <strong>
            {eligibleSessions.length} option
            {eligibleSessions.length === 1 ? '' : 's'}
          </strong>
        </div>

        {eligibleSessions.length === 0 ? (
          <div className="staff-move-booking-empty">
            <h3>No eligible target sessions</h3>

            <p>
              There are currently no other sessions that satisfy the visible
              availability rules. Refresh later or keep the current booking.
            </p>
          </div>
        ) : (
          <div
            className="staff-move-booking-session-list"
            role="radiogroup"
            aria-label="Available target doctor sessions"
          >
            {eligibleSessions.map((session) => {
              const selected = selectedSessionId === session.id;

              return (
                <label
                  key={session.id}
                  className={[
                    'staff-move-booking-session',
                    selected ? 'staff-move-booking-session--selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <input
                    type="radio"
                    name="target-session"
                    value={session.id}
                    checked={selected}
                    onChange={() => {
                      setSelectedSessionId(session.id);
                      setSelectionError('');
                      setActionError('');
                    }}
                  />

                  <div className="staff-move-booking-session__main">
                    <strong>{appointmentDateLabel(session.startAt)}</strong>

                    <span>
                      {sessionTimeRangeLabel(session.startAt, session.endAt)}
                    </span>

                    <span>{providerLabel(session.staffId)}</span>
                  </div>

                  <div className="staff-move-booking-session__capacity">
                    <strong>{session.remainingCapacity}</strong>

                    <span>places available</span>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {selectionError ? (
          <p className="staff-move-booking-selection-error" role="alert">
            {selectionError}
          </p>
        ) : null}

        <div className="staff-move-booking-actions">
          <Link
            to={`/staff/appointments/bookings/${encodeURIComponent(
              appointment.id,
            )}`}
          >
            Keep Current Booking
          </Link>

          <button
            type="button"
            onClick={openConfirmation}
            disabled={submitting || eligibleSessions.length === 0}
          >
            Review Move
          </button>
        </div>
      </section>

      <section className="staff-move-booking-integrity">
        <strong>Backend revalidation</strong>

        <p>
          The server rechecks the target session, 24-hour window, capacity,
          duplicate booking rules and queue positions when you confirm the move.
        </p>
      </section>

      {showConfirmation && selectedSession ? (
        <div className="staff-move-booking-backdrop" role="presentation">
          <section
            className="staff-move-booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-booking-move-title"
          >
            <div className="staff-move-booking-modal__heading">
              <span aria-hidden="true">→</span>

              <div>
                <h2 id="confirm-booking-move-title">Confirm Booking Move</h2>

                <p>
                  Review the current and proposed doctor sessions before
                  applying the reassignment.
                </p>
              </div>
            </div>

            <div className="staff-move-booking-comparison">
              <div>
                <span>Current Booking</span>

                <strong>{appointmentDateLabel(appointment.dateTime)}</strong>

                <small>{appointmentTimeLabel(appointment.dateTime)}</small>

                <small>
                  {appointment.providerName ??
                    providerLabel(appointment.staffId)}
                </small>
              </div>

              <strong aria-hidden="true">→</strong>

              <div>
                <span>Proposed Session</span>

                <strong>{appointmentDateLabel(selectedSession.startAt)}</strong>

                <small>
                  {sessionTimeRangeLabel(
                    selectedSession.startAt,
                    selectedSession.endAt,
                  )}
                </small>

                <small>{providerLabel(selectedSession.staffId)}</small>
              </div>
            </div>

            <div className="staff-move-booking-modal__warning">
              <strong>Queue positions will change</strong>

              <p>
                The backend assigns the new target position and compacts
                positions in the original session. Inform the customer manually
                after confirmation.
              </p>
            </div>

            <div className="staff-move-booking-modal__actions">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                disabled={submitting}
              >
                Keep Current Booking
              </button>

              <button type="button" onClick={confirmMove} disabled={submitting}>
                {submitting ? 'Moving Booking...' : 'Confirm Move'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
