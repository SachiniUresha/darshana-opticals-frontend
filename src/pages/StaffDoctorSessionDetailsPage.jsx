import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { BRANCH_ASSISTANT } from '../config/roles';
import {
  getAppointmentProviders,
  getDoctorSessions,
  getStaffAppointments,
} from '../services/staffAppointmentService';
import {
  appointmentDateLabel,
  appointmentTimeLabel,
  sessionTimeRangeLabel,
} from '../components/appointments/appointmentView';
import { getAppointmentStatusLabel } from '../utils/staffAppointmentView';
import './StaffDoctorSessionDetailsPage.css';

function doctorReference(doctorId) {
  if (!doctorId) {
    return 'Doctor unavailable';
  }

  return `Doctor …${doctorId.slice(-6)}`;
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

function sessionStatus(session) {
  return session?.remainingCapacity > 0 ? 'AVAILABLE' : 'FULL';
}

export default function StaffDoctorSessionDetailsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isBranchAssistant = user?.role === BRANCH_ASSISTANT;

  const [session, setSession] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [providers, setProviders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(
    async (isActive = () => true) => {
      setLoading(true);
      setNotFound(false);
      setErrorMessage('');

      try {
        const providerRequest = isBranchAssistant
          ? getAppointmentProviders()
          : Promise.resolve([]);

        const [sessionData, appointmentData, providerData] = await Promise.all([
          getDoctorSessions(),
          getStaffAppointments(),
          providerRequest,
        ]);

        if (!isActive()) {
          return;
        }

        const selectedSession =
          sessionData.find((item) => item.id === sessionId) ?? null;

        if (!selectedSession) {
          setSession(null);
          setAppointments([]);
          setProviders(providerData);
          setNotFound(true);
          return;
        }

        setSession(selectedSession);

        setAppointments(
          appointmentData.filter(
            (appointment) => appointment.sessionId === selectedSession.id,
          ),
        );

        setProviders(providerData);
      } catch (error) {
        if (!isActive()) {
          return;
        }

        setSession(null);
        setAppointments([]);
        setProviders([]);

        if (error?.status === 401) {
          logout();
          navigate('/login', {
            replace: true,
          });
          return;
        }

        if (error?.status === 403) {
          setErrorMessage(
            'You do not have permission to view this doctor session.',
          );
          return;
        }

        if (error?.status === 0) {
          setErrorMessage(
            'Unable to reach the server. Please check your connection and try again.',
          );
          return;
        }

        setErrorMessage(
          'Unable to load doctor session details. Please try again.',
        );
      } finally {
        if (isActive()) {
          setLoading(false);
        }
      }
    },
    [isBranchAssistant, logout, navigate, sessionId],
  );

  useEffect(() => {
    let active = true;
    const previousTitle = document.title;

    document.title = 'Doctor Session Details | Darshana Opticals';

    loadData(() => active);

    return () => {
      active = false;
      document.title = previousTitle;
    };
  }, [loadData]);

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

    for (const provider of providers) {
      addDoctor(provider.id, provider.name, provider.specialization);
    }

    if (session) {
      addDoctor(
        recordDoctorId(session),
        recordDoctorName(session),
        recordDoctorSpecialization(session),
      );
    }

    for (const appointment of appointments) {
      addDoctor(
        recordDoctorId(appointment),
        recordDoctorName(appointment),
        recordDoctorSpecialization(appointment),
      );
    }

    return details;
  }, [appointments, providers, session]);

  const sessionDoctorId = recordDoctorId(session);

  const doctorName = session
    ? (doctorDetails.get(sessionDoctorId)?.name ??
      recordDoctorName(session) ??
      doctorReference(sessionDoctorId))
    : 'Doctor unavailable';

  const doctorSpecialization = session
    ? (doctorDetails.get(sessionDoctorId)?.specialization ??
      recordDoctorSpecialization(session))
    : null;

  if (loading) {
    return (
      <section className="staff-session-details-page">
        <p className="staff-session-details-state" role="status">
          Loading doctor session details...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="staff-session-details-page">
        <div
          className="staff-session-details-state staff-session-details-state--error"
          role="alert"
        >
          <h1>Unable to load doctor session</h1>

          <p>{errorMessage}</p>

          <button type="button" onClick={() => loadData()}>
            Try Again
          </button>
        </div>
      </section>
    );
  }

  if (notFound || !session) {
    return (
      <section className="staff-session-details-page">
        <div className="staff-session-details-state" role="status">
          <h1>Doctor session not found</h1>

          <p>This doctor session is unavailable.</p>

          <Link to="/staff/appointments">Back to Sessions</Link>
        </div>
      </section>
    );
  }

  const availability = sessionStatus(session);

  return (
    <section className="staff-session-details-page">
      <header className="staff-session-details-header">
        <div>
          <p className="staff-session-details-breadcrumb">
            STAFF / APPOINTMENTS / SESSION
          </p>

          <h1>Doctor Session Details</h1>

          <p>Review session details, availability, and customer bookings.</p>
        </div>

        <Link className="staff-session-details-back" to="/staff/appointments">
          Back to Sessions
        </Link>
      </header>

      <section className="staff-session-details-summary">
        <div>
          <h2>Doctor Session · {appointmentDateLabel(session.startAt)}</h2>

          <p>
            {sessionTimeRangeLabel(session.startAt, session.endAt)} ·
            Asia/Colombo
          </p>

          <p>
            {doctorName}
            {doctorSpecialization ? ` · ${doctorSpecialization}` : ''} · Gampaha
            Main Branch
          </p>
        </div>

        <span
          className={[
            'staff-session-details-status',
            availability === 'AVAILABLE'
              ? 'staff-session-details-status--available'
              : 'staff-session-details-status--full',
          ].join(' ')}
        >
          {availability === 'AVAILABLE' ? 'Available' : 'Full'}
        </span>
      </section>

      <section
        className="staff-session-details-metrics"
        aria-label="Doctor session summary"
      >
        <article>
          <span>Capacity</span>
          <strong>{session.capacity}</strong>
          <small>Session capacity</small>
        </article>

        <article>
          <span>Confirmed</span>
          <strong>{session.confirmedCount}</strong>
          <small>Current bookings</small>
        </article>

        <article>
          <span>Available</span>
          <strong>{session.remainingCapacity}</strong>
          <small>Places remaining</small>
        </article>

        <article>
          <span>Branch</span>
          <strong>Gampaha</strong>
          <small>Main Branch</small>
        </article>
      </section>

      <section className="staff-session-details-operations">
        <div>
          <h2>Session Operations</h2>

          <p>
            {isBranchAssistant
              ? 'You can update this doctor session.'
              : 'Your Branch Manager access is read-only.'}
          </p>
        </div>

        <div className="staff-session-details-operations__actions">
          {isBranchAssistant ? (
            <Link
              className="staff-session-details-primary"
              to={`/staff/appointments/sessions/${encodeURIComponent(
                session.id,
              )}/edit`}
            >
              Edit / Reschedule Session
            </Link>
          ) : null}

          <a
            className="staff-session-details-secondary"
            href="#session-bookings"
          >
            View Customer Bookings
          </a>
        </div>
      </section>

      <section
        id="session-bookings"
        className="staff-session-bookings"
        aria-labelledby="session-bookings-title"
      >
        <div className="staff-session-bookings__heading">
          <div>
            <h2 id="session-bookings-title">Customer Bookings</h2>

            <p>Review the customers booked for this doctor session.</p>
          </div>

          <strong>
            {session.confirmedCount} confirmed appointment
            {session.confirmedCount === 1 ? '' : 's'}
          </strong>
        </div>

        {appointments.length === 0 ? (
          <div className="staff-session-bookings-empty">
            No bookings are currently associated with this doctor session.
          </div>
        ) : (
          <div className="staff-session-bookings-table-wrap">
            <table className="staff-session-bookings-table">
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Doctor</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {appointments.map((appointment) => {
                  const appointmentDoctorId = recordDoctorId(appointment);

                  const appointmentDoctorName =
                    recordDoctorName(appointment) ??
                    doctorDetails.get(appointmentDoctorId)?.name ??
                    doctorName;

                  return (
                    <tr key={appointment.id}>
                      <td>
                        {appointment.position == null
                          ? '—'
                          : `#${appointment.position}`}
                      </td>

                      <td>
                        {isBranchAssistant
                          ? (appointment.customer?.name ??
                            'Customer unavailable')
                          : 'Restricted'}
                      </td>

                      <td>
                        {appointmentDateLabel(appointment.dateTime)}

                        <small>
                          {appointmentTimeLabel(appointment.dateTime)}
                        </small>
                      </td>

                      <td>{appointmentDoctorName}</td>

                      <td>
                        <span
                          className={[
                            'staff-session-details-status',
                            appointment.status === 'CONFIRMED'
                              ? 'staff-session-details-status--available'
                              : 'staff-session-details-status--cancelled',
                          ].join(' ')}
                        >
                          {getAppointmentStatusLabel(appointment.status)}
                        </span>
                      </td>

                      <td>
                        <Link
                          className="staff-session-bookings-view"
                          to={`/staff/appointments/bookings/${encodeURIComponent(
                            appointment.id,
                          )}`}
                        >
                          View ›
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isBranchAssistant && session.confirmedCount > 0 ? (
        <section className="staff-session-details-manual-contact">
          <strong>Manual contact</strong>

          <p>
            After significant session changes, contact affected customers and
            the Doctor if needed.
          </p>
        </section>
      ) : null}
    </section>
  );
}
