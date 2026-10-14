import { useCallback, useEffect, useState } from 'react';
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
    return 'The appointment could not be cancelled because its latest state no longer allows this action.';
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

export default function StaffAppointmentDetailsPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isBranchAssistant = user?.role === BRANCH_ASSISTANT;

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);

  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  const loadAppointment = useCallback(
    async ({ showLoading = true, isActive = () => true } = {}) => {
      if (showLoading) {
        setLoading(true);
      }

      setLoadError('');

      try {
        const result = await getStaffAppointment(appointmentId);

        if (!isActive()) {
          return null;
        }

        setAppointment(result);

        return result;
      } catch (error) {
        if (!isActive()) {
          return null;
        }

        setAppointment(null);

        if (error?.status === 401) {
          logout();
          navigate('/login', {
            replace: true,
          });

          return null;
        }

        setLoadError(detailsErrorLabel(error));

        return null;
      } finally {
        if (showLoading && isActive()) {
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

  async function confirmCancellation() {
    if (actionPending || appointment?.status !== 'CONFIRMED') {
      return;
    }

    setActionPending(true);
    setActionError('');
    setSuccessMessage('');

    try {
      await cancelStaffAppointment(appointment.id);

      const refreshed = await loadAppointment({
        showLoading: false,
      });

      if (refreshed) {
        setSuccessMessage(
          'Appointment cancelled successfully. The latest backend state is shown below.',
        );
      }

      setShowCancelConfirmation(false);
    } catch (error) {
      if (error?.status === 401) {
        logout();
        navigate('/login', {
          replace: true,
        });

        return;
      }

      setShowCancelConfirmation(false);
      setActionError(cancellationErrorLabel(error));
    } finally {
      setActionPending(false);
    }
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

          <p>Review the backend-authoritative customer booking record.</p>
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
          <h2>Optometrist & Session</h2>

          <dl>
            <div>
              <dt>Optometrist</dt>
              <dd>{appointment.providerName ?? 'Provider unavailable'}</dd>
            </div>

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
              Branch Manager access is read-only and does not include the Branch
              Assistant customer-contact projection.
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
                ? 'Move or cancel this confirmed booking using backend-approved operations.'
                : 'This booking is cancelled. No further booking mutation is available.'
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
              type="button"
              className="staff-appointment-details-cancel"
              onClick={() => {
                setActionError('');
                setSuccessMessage('');
                setShowCancelConfirmation(true);
              }}
            >
              Cancel Booking
            </button>
          </div>
        ) : null}
      </section>

      <section className="staff-appointment-details-integrity">
        <strong>Backend-authoritative position</strong>

        <p>
          Queue position is displayed exactly as returned by the backend. After
          cancellation or reassignment, the page reloads the latest appointment
          state rather than recalculating positions in React.
        </p>
      </section>

      {showCancelConfirmation ? (
        <div className="staff-appointment-cancel-backdrop" role="presentation">
          <section
            className="staff-appointment-cancel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-cancel-booking-title"
          >
            <div className="staff-appointment-cancel-modal__heading">
              <span aria-hidden="true">!</span>

              <div>
                <h2 id="staff-cancel-booking-title">
                  Cancel Customer Booking?
                </h2>

                <p>
                  This action will mark the confirmed appointment as cancelled
                  and the backend will compact the remaining queue positions.
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
                <span>Optometrist</span>
                <strong>
                  {appointment.providerName ?? 'Provider unavailable'}
                </strong>
              </div>
            </div>

            <div className="staff-appointment-cancel-modal__warning">
              <strong>Manual communication required</strong>

              <p>
                Inform the affected customer manually after the cancellation is
                confirmed.
              </p>
            </div>

            <div className="staff-appointment-cancel-modal__actions">
              <button
                type="button"
                onClick={() => setShowCancelConfirmation(false)}
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
