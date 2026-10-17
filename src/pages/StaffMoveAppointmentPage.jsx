import { useEffect, useMemo, useRef, useState } from 'react';
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
      return 'The selected doctor session is full or its availability has changed. Please choose another session.';

    case 'BOOKING_WINDOW':
      return 'The selected doctor session is too close to its start time. Choose a session at least 24 hours away.';

    case 'DUPLICATE_BOOKING':
      return 'This customer already has a confirmed booking in the selected doctor session.';

    case 'SAME_SESSION':
      return 'The appointment is already assigned to that doctor session.';

    case 'SESSION_CHANGED':
      return 'This booking changed while it was being moved. Please refresh and try again.';

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
    return 'The booking can no longer be moved with the selected option. Please refresh and try again.';
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

function doctorReference(doctorId) {
  if (!doctorId) {
    return 'Doctor unavailable';
  }

  return `Doctor …${String(doctorId).slice(-6)}`;
}

function recordDoctorId(record) {
  return record?.doctorId ?? record?.doctor?.id ?? record?.staffId ?? null;
}

function recordDoctorName(record) {
  return (
    record?.doctorName ?? record?.doctor?.name ?? record?.providerName ?? null
  );
}

function recordDoctorSpecialization(record) {
  return record?.specialization ?? record?.doctor?.specialization ?? null;
}

export default function StaffMoveAppointmentPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [appointment, setAppointment] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [doctors, setDoctors] = useState([]);

  const [selectedSessionId, setSelectedSessionId] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingAfterMove, setRefreshingAfterMove] = useState(false);

  const [loadError, setLoadError] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [actionError, setActionError] = useState('');
  const [refreshError, setRefreshError] = useState('');

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [moveCompleted, setMoveCompleted] = useState(false);

  const reviewButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const restoreFocusRef = useRef(true);
  const submittingRef = useRef(false);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    let active = true;
    const previousTitle = document.title;

    document.title = 'Move Booking | Darshana Opticals';

    async function load() {
      setLoading(true);
      setLoadError('');

      try {
        const [appointmentData, sessionData, doctorData] = await Promise.all([
          getStaffAppointment(appointmentId),
          getDoctorSessions(),
          getAppointmentProviders(),
        ]);

        if (!active) {
          return;
        }

        setAppointment(appointmentData);
        setSessions(sessionData);
        setDoctors(doctorData);
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

  useEffect(() => {
    if (!showConfirmation) {
      return undefined;
    }

    const dialog = dialogRef.current;
    const reviewButton = reviewButtonRef.current;

    if (!dialog) {
      return undefined;
    }

    function getFocusableElements() {
      return Array.from(
        dialog.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          element instanceof HTMLElement &&
          element.getAttribute('aria-hidden') !== 'true',
      );
    }

    const focusableElements = getFocusableElements();

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      dialog.focus();
    }

    function handleDialogKeyDown(event) {
      if (event.key === 'Escape') {
        if (submittingRef.current) {
          return;
        }

        event.preventDefault();
        setShowConfirmation(false);
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const currentFocusableElements = getFocusableElements();

      if (currentFocusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = currentFocusableElements[0];
      const lastElement =
        currentFocusableElements[currentFocusableElements.length - 1];

      if (
        event.shiftKey &&
        (document.activeElement === firstElement ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (
        !event.shiftKey &&
        (document.activeElement === lastElement ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener('keydown', handleDialogKeyDown);

    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);

      if (
        restoreFocusRef.current &&
        reviewButton &&
        document.contains(reviewButton)
      ) {
        reviewButton.focus();
      }
    };
  }, [showConfirmation]);

  const doctorDetails = useMemo(() => {
    const details = new Map();

    function addDoctor(id, name, specialization = null) {
      if (!id) {
        return;
      }

      const current = details.get(id);

      details.set(id, {
        name: name ?? current?.name ?? null,
        specialization: specialization ?? current?.specialization ?? null,
      });
    }

    for (const doctor of doctors) {
      addDoctor(doctor.id, doctor.name, doctor.specialization);
    }

    if (appointment) {
      addDoctor(
        recordDoctorId(appointment),
        recordDoctorName(appointment),
        recordDoctorSpecialization(appointment),
      );
    }

    for (const session of sessions) {
      addDoctor(
        recordDoctorId(session),
        recordDoctorName(session),
        recordDoctorSpecialization(session),
      );
    }

    return details;
  }, [appointment, doctors, sessions]);

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

  function doctorLabel(record) {
    const doctorId = recordDoctorId(record);

    return (
      recordDoctorName(record) ??
      doctorDetails.get(doctorId)?.name ??
      doctorReference(doctorId)
    );
  }

  function doctorSpecialization(record) {
    const doctorId = recordDoctorId(record);

    return (
      recordDoctorSpecialization(record) ??
      doctorDetails.get(doctorId)?.specialization ??
      null
    );
  }

  function closeConfirmation() {
    if (submitting) {
      return;
    }

    restoreFocusRef.current = true;
    setShowConfirmation(false);
  }

  function openConfirmation() {
    setSelectionError('');
    setActionError('');
    setRefreshError('');

    if (!selectedSession) {
      setSelectionError('Select an available target doctor session first.');
      return;
    }

    restoreFocusRef.current = true;
    setShowConfirmation(true);
  }

  function navigateToAppointment() {
    navigate(
      `/staff/appointments/bookings/${encodeURIComponent(appointment.id)}`,
      {
        replace: true,
      },
    );
  }

  async function retryAppointmentRefresh() {
    if (refreshingAfterMove) {
      return;
    }

    setRefreshingAfterMove(true);
    setRefreshError('');

    try {
      const refreshedAppointment = await getStaffAppointment(appointment.id);

      if (refreshedAppointment.sessionId !== selectedSessionId) {
        setRefreshError(
          'The booking was moved successfully, but the latest appointment details are not available yet. Please try again.',
        );

        return;
      }

      navigateToAppointment();
    } catch (error) {
      if (error?.status === 401) {
        logout();

        navigate('/login', {
          replace: true,
        });

        return;
      }

      setRefreshError(
        'The booking was moved successfully, but the latest appointment details could not be loaded. Please try again.',
      );
    } finally {
      setRefreshingAfterMove(false);
    }
  }

  async function confirmMove() {
    if (!selectedSession || submitting) {
      return;
    }

    setSubmitting(true);
    setActionError('');
    setRefreshError('');

    try {
      await reassignStaffAppointment(appointment.id, selectedSession.id);
    } catch (error) {
      if (error?.status === 401) {
        restoreFocusRef.current = false;

        logout();

        navigate('/login', {
          replace: true,
        });

        return;
      }

      restoreFocusRef.current = true;
      setShowConfirmation(false);
      setActionError(moveErrorLabel(error));

      try {
        const refreshedSessions = await getDoctorSessions();

        setSessions(refreshedSessions);
      } catch {
        // Preserve the safe reassignment error already shown.
      }

      return;
    } finally {
      setSubmitting(false);
    }

    restoreFocusRef.current = false;
    setShowConfirmation(false);
    setMoveCompleted(true);

    try {
      const refreshedAppointment = await getStaffAppointment(appointment.id);

      if (refreshedAppointment.sessionId !== selectedSession.id) {
        setRefreshError(
          'The booking was moved successfully, but the latest appointment details are not available yet. Please refresh the appointment.',
        );

        return;
      }

      navigateToAppointment();
    } catch (error) {
      if (error?.status === 401) {
        logout();

        navigate('/login', {
          replace: true,
        });

        return;
      }

      setRefreshError(
        'The booking was moved successfully, but the latest appointment details could not be loaded. Please refresh the appointment.',
      );
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

  if (moveCompleted) {
    return (
      <section className="staff-move-booking-page">
        <div
          className="staff-move-booking-state"
          role="status"
          aria-live="polite"
        >
          <h1>Booking moved successfully</h1>

          {refreshError ? (
            <>
              <p>{refreshError}</p>

              <button
                type="button"
                onClick={retryAppointmentRefresh}
                disabled={refreshingAfterMove}
              >
                {refreshingAfterMove
                  ? 'Refreshing Appointment...'
                  : 'Refresh Appointment'}
              </button>
            </>
          ) : (
            <p>Loading the latest appointment details...</p>
          )}

          <Link to="/staff/appointments?tab=bookings">
            Back to Customer Bookings
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
            Select another available doctor session for this confirmed
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
          <span>Current Doctor</span>

          <strong>{doctorLabel(appointment)}</strong>

          {doctorSpecialization(appointment) ? (
            <small>{doctorSpecialization(appointment)}</small>
          ) : null}

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
            <h2>Available Doctor Sessions</h2>

            <p>Choose an available session for the customer.</p>
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
              There are currently no other available doctor sessions for this
              booking. Please try again later or keep the current booking.
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
              const specialization = doctorSpecialization(session);

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

                    <span>{doctorLabel(session)}</span>

                    {specialization ? <small>{specialization}</small> : null}
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
            ref={reviewButtonRef}
            type="button"
            onClick={openConfirmation}
            disabled={submitting || eligibleSessions.length === 0}
          >
            Review Move
          </button>
        </div>
      </section>

      {showConfirmation && selectedSession ? (
        <div className="staff-move-booking-backdrop" role="presentation">
          <section
            ref={dialogRef}
            className="staff-move-booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-booking-move-title"
            tabIndex={-1}
          >
            <div className="staff-move-booking-modal__heading">
              <span aria-hidden="true">→</span>

              <div>
                <h2 id="confirm-booking-move-title">Confirm Booking Move</h2>

                <p>
                  Review the current and proposed doctor sessions before
                  confirming the move.
                </p>
              </div>
            </div>

            <div className="staff-move-booking-comparison">
              <div>
                <span>Current Booking</span>

                <strong>{appointmentDateLabel(appointment.dateTime)}</strong>

                <small>{appointmentTimeLabel(appointment.dateTime)}</small>

                <small>{doctorLabel(appointment)}</small>

                {doctorSpecialization(appointment) ? (
                  <small>{doctorSpecialization(appointment)}</small>
                ) : null}
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

                <small>{doctorLabel(selectedSession)}</small>

                {doctorSpecialization(selectedSession) ? (
                  <small>{doctorSpecialization(selectedSession)}</small>
                ) : null}
              </div>
            </div>

            <div className="staff-move-booking-modal__warning">
              <strong>Booking position may change</strong>

              <p>
                The customer may receive a different queue position after the
                move. Contact the customer if needed.
              </p>
            </div>

            <div className="staff-move-booking-modal__actions">
              <button
                type="button"
                onClick={closeConfirmation}
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
