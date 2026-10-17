import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { getCustomerAppointments } from '../services/appointmentService';
import {
  appointmentDateTimeLabel,
  appointmentListErrorLabel,
  appointmentStatusLabel,
  appointmentTimingLabel,
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

function AppointmentHistoryPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAppointments = useCallback(
    async (active = () => true) => {
      setIsLoading(true);
      setError('');

      try {
        const result = await getCustomerAppointments();

        if (active()) {
          setAppointments(result);
        }
      } catch (err) {
        if (!active()) {
          return;
        }

        if (err?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }

        setError(appointmentListErrorLabel(err));
      } finally {
        if (active()) {
          setIsLoading(false);
        }
      }
    },
    [logout, navigate],
  );

  useEffect(() => {
    let active = true;

    const previousTitle = document.title;
    document.title = 'My Appointments | Darshana Opticals';

    loadAppointments(() => active);

    return () => {
      active = false;
      document.title = previousTitle;
    };
  }, [loadAppointments]);

  return (
    <section className="appointment-management-page">
      <header className="appointment-management-hero">
        <span className="appointment-management-hero__badge">Eye Care</span>

        <h1>My Appointments</h1>

        <p>View your scheduled and previous eye test appointments.</p>
      </header>

      <div className="appointment-management-content">
        <div className="appointment-management-toolbar">
          <div>
            <h2>Your appointments</h2>

            <p>View your upcoming and previous eye test bookings.</p>
          </div>

          <Link
            to="/appointments/book"
            className="appointment-management-primary-link"
          >
            Book Eye Test
          </Link>
        </div>

        {isLoading ? (
          <div className="appointment-management-state" role="status">
            Loading your appointments...
          </div>
        ) : error ? (
          <div
            className="appointment-management-state appointment-management-state--error"
            role="alert"
          >
            <p>{error}</p>

            <button type="button" onClick={() => loadAppointments()}>
              Try Again
            </button>
          </div>
        ) : appointments.length === 0 ? (
          <div className="appointment-management-empty">
            <div
              className="appointment-management-empty__icon"
              aria-hidden="true"
            >
              ◷
            </div>

            <h2>No appointments yet</h2>

            <p>You have not booked an eye test appointment yet.</p>

            <Link
              to="/appointments/book"
              className="appointment-management-primary-link"
            >
              Book Your Eye Test
            </Link>
          </div>
        ) : (
          <div className="appointment-history-list">
            {appointments.map((appointment) => {
              const timing = appointmentTimingLabel(appointment.dateTime);
              const doctorName = appointmentDoctorName(appointment);
              const specialization =
                appointmentDoctorSpecialization(appointment);

              return (
                <article
                  key={appointment.id}
                  className="appointment-history-card"
                >
                  <div className="appointment-history-card__main">
                    <div
                      className="appointment-history-card__icon"
                      aria-hidden="true"
                    >
                      ◉
                    </div>

                    <div>
                      <div className="appointment-history-card__badges">
                        <span
                          className={`appointment-status appointment-status--${appointment.status.toLowerCase()}`}
                        >
                          {appointmentStatusLabel(appointment.status)}
                        </span>

                        <span className="appointment-timing-badge">
                          {timing}
                        </span>
                      </div>

                      <h3>{doctorName}</h3>

                      {specialization ? <p>{specialization}</p> : null}

                      <p>{appointmentDateTimeLabel(appointment.dateTime)}</p>

                      <small>Darshana Opticals — Gampaha Main Branch</small>
                    </div>
                  </div>

                  <div className="appointment-history-card__actions">
                    {appointment.position != null &&
                    appointment.status === 'CONFIRMED' ? (
                      <span>Queue position #{appointment.position}</span>
                    ) : null}

                    <Link
                      to={`/appointments/${encodeURIComponent(appointment.id)}`}
                    >
                      View Details
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default AppointmentHistoryPage;
