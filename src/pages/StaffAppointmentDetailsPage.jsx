import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { BRANCH_ASSISTANT } from '../config/roles';
import {
  cancelStaffAppointment,
  getStaffAppointment,
} from '../services/staffAppointmentService';
import {
  appointmentDateLabel,
  appointmentTimeLabel,
} from '../components/appointments/appointmentView';
import {
  getAppointmentStatusLabel,
  getAppointmentTiming,
} from '../utils/staffAppointmentView';
import './StaffAppointmentDetailsPage.css';

function cancellationErrorLabel(error) {
  switch (error?.code) {
    case 'INVALID_STATUS':
      return 'Only confirmed appointments can be cancelled. Refresh the appointment and try again.';

    default:
      break;
  }

  if (error?.status === 403) {
    return 'You do not have permission to cancel this appointment.';
  }

  if (error?.status === 404) {
    return 'The appointment is no longer available.';
  }

  if (error?.status === 400 || error?.status === 409 || error?.status === 422) {
    return 'The appointment can no longer be cancelled. Please refresh and try again.';
  }

  if (error?.status === 0) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return 'Unable to cancel the appointment. Please try again.';
}

function detailsErrorLabel(error) {
  if (error?.status === 403) {
    return 'You do not have permission to view this appointment.';
  }

  if (error?.status === 404) {
    return 'This appointment is unavailable or no longer exists.';
  }

  if (error?.status === 0) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return 'Unable to load appointment details. Please try again.';
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

export default function StaffAppointmentDetailsPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isBranchAssistant = user?.role === BRANCH_ASSISTANT;

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [refreshingAfterCancellation, setRefreshingAfterCancellation] =
    useState(false);

  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [refreshError, setRefreshError] = useState('');

  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [cancellationCompleted, setCancellationCompleted] = useState(false);

  const cancelButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const restoreFocusRef = useRef(true);
  const actionPendingRef = useRef(false);

  useEffect(() => {
    actionPendingRef.current = actionPending;
  }, [actionPending]);

  const loadAppointment = useCallback(
    async ({ isActive = () => true } = {}) => {
      setLoading(true);
      setLoadError('');

      try {
        const result = await getStaffAppointment(appointmentId);

        if (!isActive()) {
          return;
        }

        setAppointment(result);
      } catch (error) {
        if (!isActive()) {
          return;
        }

        setAppointment(null);

        if (error?.status === 401) {
          logout();

          navigate('/login', {
            replace: true,
          });

          return;
        }

        setLoadError(detailsErrorLabel(error));
      } finally {
        if (isActive()) {
          setLoading(false);
        }
      }
    },
    [appointmentId, logout, navigate],
  );

  useEffect(() => {
    let active = true;
    const previousTitle = document.title;

    document.title = 'Appointment Details | Darshana Opticals';

    loadAppointment({
      isActive: () => active,
    });

    return () => {
      active = false;
      document.title = previousTitle;
    };
  }, [loadAppointment]);

  useEffect(() => {
    if (!showCancelConfirmation) {
      return undefined;
    }

    const dialog = dialogRef.current;
    const cancelButton = cancelButtonRef.current;

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
        if (actionPendingRef.current) {
          return;
        }

        event.preventDefault();
        setShowCancelConfirmation(false);
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
        cancelButton &&
        document.contains(cancelButton)
      ) {
        cancelButton.focus();
      }
    };
  }, [showCancelConfirmation]);

  const doctorId = recordDoctorId(appointment);

  const doctorName = recordDoctorName(appointment) ?? doctorReference(doctorId);

  const doctorSpecialization = recordDoctorSpecialization(appointment);

  function openCancelConfirmation() {
    setActionError('');
    setSuccessMessage('');
    setRefreshError('');
    restoreFocusRef.current = true;
    setShowCancelConfirmation(true);
  }

  function closeCancelConfirmation() {
    if (actionPending) {
      return;
    }

    restoreFocusRef.current = true;
    setShowCancelConfirmation(false);
  }

  async function refreshCancelledAppointment() {
    if (refreshingAfterCancellation) {
      return;
    }

    setRefreshingAfterCancellation(true);
    setRefreshError('');

    try {
      const refreshed = await getStaffAppointment(appointmentId);

      if (refreshed.status !== 'CANCELLED') {
        setRefreshError(
          'The appointment was cancelled successfully, but the latest details are not available yet. Please try again.',
        );

        return;
      }

      setAppointment(refreshed);
      setCancellationCompleted(false);
      setSuccessMessage('Appointment cancelled successfully.');
    } catch (error) {
      if (error?.status === 401) {
        logout();

        navigate('/login', {
          replace: true,
        });

        return;
      }

      setRefreshError(
        'The appointment was cancelled successfully, but the latest appointment details could not be loaded. Please try again.',
      );
    } finally {
      setRefreshingAfterCancellation(false);
    }
  }

  async function confirmCancellation() {
    if (actionPending || appointment?.status !== 'CONFIRMED') {
      return;
    }

    setActionPending(true);
    setActionError('');
    setSuccessMessage('');
    setRefreshError('');

    try {
      await cancelStaffAppointment(appointment.id);
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
      setShowCancelConfirmation(false);
      setActionError(cancellationErrorLabel(error));

      return;
    } finally {
      setActionPending(false);
    }

    restoreFocusRef.current = false;
    setShowCancelConfirmation(false);
    setCancellationCompleted(true);
    setSuccessMessage('Appointment cancelled successfully.');

    await refreshCancelledAppointment();
  }

  if (loading) {
    return (
      <section className="staff-appointment-details-page">
        <p className="staff-appointment-details-state" role="status">
          Loading appointment details...
        </p>
      </section>
    );
  }

  if (loadError || !appointment) {
    return (
      <section className="staff-appointment-details-page">
        <div
          className="staff-appointment-details-state staff-appointment-details-state--error"
          role="alert"
        >
          <h1>Unable to view appointment</h1>

          <p>{loadError}</p>

          <Link to="/staff/appointments?tab=bookings">
            Back to Customer Bookings
          </Link>
        </div>
      </section>
    );
  }

  if (cancellationCompleted) {
    return (
      <section className="staff-appointment-details-page">
        <div
          className="staff-appointment-details-state"
          role="status"
          aria-live="polite"
        >
          <h1>Appointment cancelled successfully</h1>

          {refreshError ? (
            <>
              <p>{refreshError}</p>

              <button
                type="button"
                onClick={refreshCancelledAppointment}
                disabled={refreshingAfterCancellation}
              >
                {refreshingAfterCancellation
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

  const timing = getAppointmentTiming(appointment.dateTime);

  const canManageBooking =
    isBranchAssistant && appointment.status === 'CONFIRMED';

  return (
    <section className="staff-appointment-details-page">
      <header className="staff-appointment-details-header">
        <div>
          <p className="staff-appointment-details-breadcrumb">
            STAFF / APPOINTMENTS / CUSTOMER BOOKING
          </p>

          <h1>Appointment Details</h1>

          <p>Review this customer booking and appointment information.</p>
        </div>

        <Link
          className="staff-appointment-details-back"
          to="/staff/appointments?tab=bookings"
        >
          Back to Bookings
        </Link>
      </header>

      {successMessage ? (
        <div
          className="staff-appointment-details-message staff-appointment-details-message--success"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      {actionError ? (
        <div
          className="staff-appointment-details-message staff-appointment-details-message--error"
          role="alert"
        >
          {actionError}
        </div>
      ) : null}

      <section className="staff-appointment-details-summary">
        <div>
          <span>Appointment ID</span>

          <strong>{appointment.id}</strong>
        </div>

        <span
          className={[
            'staff-appointment-details-status',
            appointment.status === 'CONFIRMED'
              ? 'staff-appointment-details-status--confirmed'
              : 'staff-appointment-details-status--cancelled',
          ].join(' ')}
        >
          {getAppointmentStatusLabel(appointment.status)}
        </span>
      </section>

      <div className="staff-appointment-details-grid">
        <section className="staff-appointment-details-card">
          <h2>Appointment Schedule</h2>

          <dl>
            <div>
              <dt>Date</dt>
              <dd>{appointmentDateLabel(appointment.dateTime)}</dd>
            </div>

            <div>
              <dt>Time</dt>
              <dd>{appointmentTimeLabel(appointment.dateTime)}</dd>
            </div>

            <div>
              <dt>Timing</dt>
              <dd>
                {timing === 'UPCOMING'
                  ? 'Upcoming'
                  : timing === 'PAST'
                    ? 'Past'
                    : 'Unavailable'}
              </dd>
            </div>

            <div>
              <dt>Queue Position</dt>
              <dd>
                {appointment.position == null
                  ? 'Not applicable'
                  : `#${appointment.position}`}
              </dd>
            </div>
          </dl>
        </section>

        <section className="staff-appointment-details-card">
          <h2>Doctor & Session</h2>

          <dl>
            <div>
              <dt>Doctor</dt>
              <dd>{doctorName}</dd>
            </div>

            {doctorSpecialization ? (
              <div>
                <dt>Specialization</dt>
                <dd>{doctorSpecialization}</dd>
              </div>
            ) : null}

            <div>
              <dt>Session ID</dt>
              <dd>{appointment.sessionId ?? 'Session unavailable'}</dd>
            </div>

            <div>
              <dt>Branch</dt>
              <dd>Gampaha Main Branch</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="staff-appointment-details-card">
        <h2>Customer</h2>

        {isBranchAssistant ? (
          appointment.customer ? (
            <dl>
              <div>
                <dt>Name</dt>
                <dd>{appointment.customer.name ?? 'Name unavailable'}</dd>
              </div>

              <div>
                <dt>Phone</dt>
                <dd>{appointment.customer.phone ?? 'Phone unavailable'}</dd>
              </div>

              <div>
                <dt>Customer ID</dt>
                <dd>{appointment.customer.id ?? 'ID unavailable'}</dd>
              </div>
            </dl>
          ) : (
            <p className="staff-appointment-details-muted">
              Customer contact information is unavailable.
            </p>
          )
        ) : (
          <div className="staff-appointment-details-restricted">
            <strong>Customer contact restricted</strong>

            <p>
              Customer contact details are available to Branch Assistants only.
            </p>
          </div>
        )}
      </section>

      <section className="staff-appointment-details-actions">
        <div>
          <h2>Booking Operations</h2>

          <p>
            {isBranchAssistant
              ? appointment.status === 'CONFIRMED'
                ? 'You can move or cancel this confirmed booking.'
                : 'This booking has been cancelled.'
              : 'Branch Manager access is read-only.'}
          </p>
        </div>

        {canManageBooking ? (
          <div className="staff-appointment-details-actions__buttons">
            <Link
              to={`/staff/appointments/bookings/${encodeURIComponent(
                appointment.id,
              )}/move`}
            >
              Move Booking
            </Link>

            <button
              ref={cancelButtonRef}
              type="button"
              className="staff-appointment-details-cancel"
              onClick={openCancelConfirmation}
            >
              Cancel Booking
            </button>
          </div>
        ) : null}
      </section>

      {showCancelConfirmation ? (
        <div className="staff-appointment-cancel-backdrop" role="presentation">
          <section
            ref={dialogRef}
            className="staff-appointment-cancel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-cancel-booking-title"
            tabIndex={-1}
          >
            <div className="staff-appointment-cancel-modal__heading">
              <span aria-hidden="true">!</span>

              <div>
                <h2 id="staff-cancel-booking-title">
                  Cancel Customer Booking?
                </h2>

                <p>
                  Confirm that you want to cancel this customer appointment.
                </p>
              </div>
            </div>

            <div className="staff-appointment-cancel-modal__details">
              {isBranchAssistant && appointment.customer?.name ? (
                <div>
                  <span>Customer</span>
                  <strong>{appointment.customer.name}</strong>
                </div>
              ) : null}

              <div>
                <span>Appointment</span>
                <strong>
                  {appointmentDateLabel(appointment.dateTime)} ·{' '}
                  {appointmentTimeLabel(appointment.dateTime)}
                </strong>
              </div>

              <div>
                <span>Doctor</span>
                <strong>{doctorName}</strong>
              </div>

              {doctorSpecialization ? (
                <div>
                  <span>Specialization</span>
                  <strong>{doctorSpecialization}</strong>
                </div>
              ) : null}
            </div>

            <div className="staff-appointment-cancel-modal__warning">
              <strong>Customer communication</strong>

              <p>Inform the customer about the cancellation if needed.</p>
            </div>

            <div className="staff-appointment-cancel-modal__actions">
              <button
                type="button"
                onClick={closeCancelConfirmation}
                disabled={actionPending}
              >
                Keep Appointment
              </button>

              <button
                type="button"
                onClick={confirmCancellation}
                disabled={actionPending}
              >
                {actionPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
