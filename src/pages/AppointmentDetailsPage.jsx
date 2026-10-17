import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import {
  cancelAppointment,
  getAppointment,
} from '../services/appointmentService';
import {
  appointmentDateTimeLabel,
  appointmentDetailsErrorLabel,
  appointmentStatusLabel,
  appointmentTimingLabel,
  cancellationErrorLabel,
  canCustomerCancelAppointment,
} from '../components/appointments/appointmentView';
import './AppointmentManagement.css';

function appointmentDoctorName(appointment) {
  return (
    appointment?.doctorName ?? appointment?.doctor?.name ?? 'Doctor unavailable'
  );
}

function appointmentDoctorSpecialization(appointment) {
  return (
    appointment?.specialization ?? appointment?.doctor?.specialization ?? ''
  );
}

function AppointmentDetailsPage() {
  const { id } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [cancellationError, setCancellationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleAuthenticationFailure = useCallback(
    (err) => {
      if (err?.status !== 401) {
        return false;
      }

      logout();
      navigate('/login', { replace: true });

      return true;
    },
    [logout, navigate],
  );

  const loadAppointment = useCallback(
    async (active = () => true) => {
      setIsLoading(true);
      setError('');

      try {
        const result = await getAppointment(id);

        if (active()) {
          setAppointment(result);
        }
      } catch (err) {
        if (!active()) {
          return;
        }

        if (handleAuthenticationFailure(err)) {
          return;
        }

        setAppointment(null);
        setError(appointmentDetailsErrorLabel(err));
      } finally {
        if (active()) {
          setIsLoading(false);
        }
      }
    },
    [id, handleAuthenticationFailure],
  );

  useEffect(() => {
    let active = true;

    const previousTitle = document.title;
    document.title = 'Appointment Details | Darshana Opticals';

    loadAppointment(() => active);

    return () => {
      active = false;
      document.title = previousTitle;
    };
  }, [loadAppointment]);

  async function handleCancellation() {
    if (!appointment || isCancelling) {
      return;
    }

    setIsCancelling(true);
    setCancellationError('');
    setSuccessMessage('');

    try {
      await cancelAppointment(appointment.id);

      setAppointment((current) =>
        current
          ? {
              ...current,
              status: 'CANCELLED',
              position: null,
            }
          : current,
      );

      setShowCancelConfirmation(false);
      setSuccessMessage('Your appointment has been cancelled successfully.');

      try {
        const refreshed = await getAppointment(appointment.id);

        setAppointment(refreshed);
      } catch (refreshError) {
        handleAuthenticationFailure(refreshError);
      }
    } catch (err) {
      if (handleAuthenticationFailure(err)) {
        return;
      }

      setCancellationError(cancellationErrorLabel(err));

      if (
        err?.code === 'CUSTOMER_CANCEL_WINDOW' ||
        err?.code === 'INVALID_STATUS'
      ) {
        try {
          const refreshed = await getAppointment(appointment.id);

          setAppointment(refreshed);
        } catch (refreshError) {
          handleAuthenticationFailure(refreshError);
        }
      }
    } finally {
      setIsCancelling(false);
    }
  }

  const canCancel = appointment && canCustomerCancelAppointment(appointment);

  const doctorName = appointmentDoctorName(appointment);
  const doctorSpecialization = appointmentDoctorSpecialization(appointment);

  return (
    <section className="appointment-management-page">
      <header className="appointment-management-hero">
        <span className="appointment-management-hero__badge">Eye Care</span>

        <h1>Appointment Details</h1>

        <p>Review the latest information for your eye test appointment.</p>
      </header>

      <div className="appointment-management-content">
        <Link to="/appointments" className="appointment-management-back">
          ‹ Back to My Appointments
        </Link>

        {isLoading ? (
          <div className="appointment-management-state" role="status">
            Loading appointment details...
          </div>
        ) : error ? (
          <div
            className="appointment-management-state appointment-management-state--error"
            role="alert"
          >
            <p>{error}</p>

            <button type="button" onClick={() => loadAppointment()}>
              Try Again
            </button>
          </div>
        ) : appointment ? (
          <article className="appointment-details-card">
            <div className="appointment-details-card__header">
              <div>
                <span className="appointment-details-card__eyebrow">
                  Appointment
                </span>

                <h2>{doctorName}</h2>

                {doctorSpecialization ? (
                  <p>
                    {doctorSpecialization} · Darshana Opticals — Gampaha Main
                    Branch
                  </p>
                ) : (
                  <p>Darshana Opticals — Gampaha Main Branch</p>
                )}
              </div>

              <div className="appointment-details-card__statuses">
                <span
                  className={`appointment-status appointment-status--${appointment.status.toLowerCase()}`}
                >
                  {appointmentStatusLabel(appointment.status)}
                </span>

                <span className="appointment-timing-badge">
                  {appointmentTimingLabel(appointment.dateTime)}
                </span>
              </div>
            </div>

            {successMessage ? (
              <div className="appointment-management-success" role="status">
                {successMessage}
              </div>
            ) : null}

            {cancellationError ? (
              <div className="appointment-management-inline-error" role="alert">
                {cancellationError}
              </div>
            ) : null}

            <dl className="appointment-details-grid">
              <div>
                <dt>Date &amp; Time</dt>
                <dd>{appointmentDateTimeLabel(appointment.dateTime)}</dd>
              </div>

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
                <dt>Location</dt>
                <dd>Gampaha Main Branch</dd>
              </div>

              <div>
                <dt>Status</dt>
                <dd>{appointmentStatusLabel(appointment.status)}</dd>
              </div>

              <div>
                <dt>Queue Position</dt>
                <dd>{appointment.position ?? 'Not applicable'}</dd>
              </div>

              <div className="appointment-details-grid__wide">
                <dt>Appointment ID</dt>
                <dd>{appointment.id}</dd>
              </div>
            </dl>

            {canCancel ? (
              <>
                {!showCancelConfirmation ? (
                  <div className="appointment-details-actions">
                    <button
                      type="button"
                      className="appointment-cancel-button"
                      onClick={() => {
                        setShowCancelConfirmation(true);
                        setCancellationError('');
                      }}
                    >
                      Cancel Appointment
                    </button>
                  </div>
                ) : (
                  <div className="appointment-cancel-confirmation">
                    <div>
                      <strong>Cancel this appointment?</strong>

                      <p>
                        This action will release your place in the doctor
                        session.
                      </p>
                    </div>

                    <div className="appointment-cancel-confirmation__actions">
                      <button
                        type="button"
                        className="appointment-keep-button"
                        onClick={() => setShowCancelConfirmation(false)}
                        disabled={isCancelling}
                      >
                        Keep Appointment
                      </button>

                      <button
                        type="button"
                        className="appointment-confirm-cancel-button"
                        onClick={handleCancellation}
                        disabled={isCancelling}
                      >
                        {isCancelling
                          ? 'Cancelling...'
                          : 'Yes, Cancel Appointment'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="appointment-details-actions">
                {appointment.status === 'CANCELLED' ? (
                  <Link
                    to="/appointments/book"
                    className="appointment-management-primary-link"
                  >
                    Book Another Appointment
                  </Link>
                ) : (
                  <p className="appointment-cancellation-unavailable">
                    This appointment can no longer be cancelled.
                  </p>
                )}
              </div>
            )}
          </article>
        ) : null}
      </div>
    </section>
  );
}

export default AppointmentDetailsPage;
