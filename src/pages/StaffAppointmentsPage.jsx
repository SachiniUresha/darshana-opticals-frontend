import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { BRANCH_ASSISTANT } from '../config/roles';
import StaffAppointmentWorkspace from '../components/staffAppointments/StaffAppointmentWorkspace';
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
import {
  getAppointmentStatusLabel,
  getAppointmentTiming,
} from '../utils/staffAppointmentView';
import './StaffAppointmentsPage.css';

const APPOINTMENT_TIME_ZONE = 'Asia/Colombo';

function getDateKey(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APPOINTMENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function matchesDateFilter(value, filter, now = new Date()) {
  if (filter === 'ALL') {
    return true;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  if (filter === 'TODAY') {
    return getDateKey(date) === getDateKey(now);
  }

  if (filter === 'UPCOMING') {
    return date.getTime() > now.getTime();
  }

  if (filter === 'PAST') {
    return date.getTime() <= now.getTime();
  }

  return true;
}

function sessionAvailability(session) {
  return session.remainingCapacity > 0 ? 'AVAILABLE' : 'FULL';
}

function shortProviderReference(providerId) {
  if (!providerId) {
    return 'Doctor unavailable';
  }

  return `Doctor …${providerId.slice(-6)}`;
}

function recordProviderId(record) {
  return record?.doctorId ?? record?.staffId ?? null;
}

function recordProviderName(record) {
  return (
    record?.doctorName ?? record?.doctor?.name ?? record?.providerName ?? null
  );
}

function recordProviderSpecialization(record) {
  return record?.specialization ?? record?.doctor?.specialization ?? null;
}

function recordProviderDisplayLabel(record) {
  const name = recordProviderName(record);
  const specialization = recordProviderSpecialization(record);

  if (!name) {
    return null;
  }

  return specialization ? `${name} — ${specialization}` : name;
}

function AppointmentMetrics({
  todaySessions,
  upcomingSessions,
  confirmedBookings,
  availablePlaces,
}) {
  const metrics = [
    {
      label: "Today's Sessions",
      value: todaySessions,
      note: 'Sessions scheduled today',
    },
    {
      label: 'Upcoming Sessions',
      value: upcomingSessions,
      note: 'Upcoming doctor sessions',
    },
    {
      label: 'Confirmed Bookings',
      value: confirmedBookings,
      note: 'Confirmed customer bookings',
    },
    {
      label: 'Available Places',
      value: availablePlaces,
      note: 'Open places in upcoming sessions',
    },
  ];

  return (
    <section
      className="staff-overview-metrics"
      aria-label="Appointment summary"
    >
      {metrics.map((metric) => (
        <article key={metric.label} className="staff-overview-metric">
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>{metric.note}</small>
        </article>
      ))}
    </section>
  );
}

function LoadingOverview() {
  return (
    <>
      <section
        className="staff-overview-metrics"
        aria-label="Loading appointment summary"
      >
        {[
          "Today's Sessions",
          'Upcoming Sessions',
          'Confirmed Bookings',
          'Available Places',
        ].map((label) => (
          <article key={label} className="staff-overview-metric">
            <span>{label}</span>
            <strong>—</strong>
            <small>Loading...</small>
          </article>
        ))}
      </section>

      <section
        className="staff-overview-loading"
        aria-label="Loading appointments"
      >
        <p role="status">Loading sessions...</p>

        <div className="staff-overview-loading__filters">
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="staff-overview-loading__rows">
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>
    </>
  );
}

function ErrorState({ accessDenied, onRetry }) {
  return (
    <section
      className="staff-overview-message staff-overview-message--error"
      role="alert"
    >
      <div className="staff-overview-message__icon" aria-hidden="true">
        !
      </div>

      <h2>
        {accessDenied
          ? 'You do not have permission to view appointments'
          : 'Unable to load appointments'}
      </h2>

      <p>
        {accessDenied
          ? 'No session, booking, customer or doctor details are displayed.'
          : 'Please check your connection and try again.'}
      </p>

      {!accessDenied ? (
        <button type="button" onClick={onRetry}>
          Try Again
        </button>
      ) : null}
    </section>
  );
}

export default function StaffAppointmentsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab =
    searchParams.get('tab') === 'bookings' ? 'bookings' : 'sessions';

  const isBranchAssistant = user?.role === BRANCH_ASSISTANT;

  const [sessions, setSessions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [providers, setProviders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionDateFilter, setSessionDateFilter] = useState('UPCOMING');
  const [sessionProviderFilter, setSessionProviderFilter] = useState('ALL');
  const [sessionAvailabilityFilter, setSessionAvailabilityFilter] =
    useState('ALL');

  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingDateFilter, setBookingDateFilter] = useState('UPCOMING');
  const [bookingProviderFilter, setBookingProviderFilter] = useState('ALL');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('ALL');

  const loadData = useCallback(
    async (isActive = () => true) => {
      setLoading(true);
      setAccessDenied(false);
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

        setSessions(sessionData);
        setAppointments(appointmentData);
        setProviders(providerData);
      } catch (error) {
        if (!isActive()) {
          return;
        }

        if (error?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }

        setSessions([]);
        setAppointments([]);
        setProviders([]);

        if (error?.status === 403) {
          setAccessDenied(true);
        } else if (error?.status === 0) {
          setErrorMessage(
            'Unable to load appointments. Please check your connection and try again.',
          );
        } else {
          setErrorMessage(
            'Unable to load appointment information. Please try again.',
          );
        }
      } finally {
        if (isActive()) {
          setLoading(false);
        }
      }
    },
    [isBranchAssistant, logout, navigate],
  );

  useEffect(() => {
    let active = true;
    const previousTitle = document.title;

    document.title = 'Appointment Management | Darshana Opticals';

    loadData(() => active);

    return () => {
      active = false;
      document.title = previousTitle;
    };
  }, [loadData]);

  const providerDetails = useMemo(() => {
    const details = new Map();

    function addProvider(id, name, specialization = null) {
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
      addProvider(provider.id, provider.name, provider.specialization);
    }

    for (const session of sessions) {
      addProvider(
        recordProviderId(session),
        recordProviderName(session),
        recordProviderSpecialization(session),
      );
    }

    for (const appointment of appointments) {
      addProvider(
        recordProviderId(appointment),
        recordProviderName(appointment),
        recordProviderSpecialization(appointment),
      );
    }

    return details;
  }, [appointments, providers, sessions]);

  const providerLabel = useCallback(
    (providerId) => {
      const details = providerDetails.get(providerId);

      if (!details?.name) {
        return shortProviderReference(providerId);
      }

      return details.specialization
        ? `${details.name} — ${details.specialization}`
        : details.name;
    },
    [providerDetails],
  );

  const now = new Date();

  const todaySessions = sessions.filter(
    (session) => getDateKey(session.startAt) === getDateKey(now),
  ).length;

  const upcomingSessions = sessions.filter(
    (session) => new Date(session.startAt).getTime() > now.getTime(),
  );

  const confirmedBookings = appointments.filter(
    (appointment) => appointment.status === 'CONFIRMED',
  ).length;

  const availablePlaces = upcomingSessions.reduce(
    (total, session) => total + session.remainingCapacity,
    0,
  );

  const sessionProviderOptions = useMemo(() => {
    const ids = [
      ...new Set(sessions.map((session) => recordProviderId(session))),
    ].filter(Boolean);

    return ids.map((providerId) => ({
      id: providerId,
      label: providerLabel(providerId),
    }));
  }, [providerLabel, sessions]);

  const bookingProviderOptions = useMemo(() => {
    const ids = [
      ...new Set(
        appointments.map((appointment) => recordProviderId(appointment)),
      ),
    ].filter(Boolean);

    return ids.map((providerId) => ({
      id: providerId,
      label: providerLabel(providerId),
    }));
  }, [appointments, providerLabel]);

  const filteredSessions = useMemo(() => {
    const search = sessionSearch.trim().toLowerCase();

    return [...sessions]
      .filter((session) => {
        const provider = providerLabel(recordProviderId(session)).toLowerCase();

        if (search && !provider.includes(search)) {
          return false;
        }

        if (!matchesDateFilter(session.startAt, sessionDateFilter)) {
          return false;
        }

        if (
          sessionProviderFilter !== 'ALL' &&
          recordProviderId(session) !== sessionProviderFilter
        ) {
          return false;
        }

        if (
          sessionAvailabilityFilter !== 'ALL' &&
          sessionAvailability(session) !== sessionAvailabilityFilter
        ) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
  }, [
    sessionAvailabilityFilter,
    sessionDateFilter,
    sessionProviderFilter,
    sessionSearch,
    sessions,
    providerLabel,
  ]);

  const filteredAppointments = useMemo(() => {
    const search = bookingSearch.trim().toLowerCase();

    return [...appointments]
      .filter((appointment) => {
        const customerName = appointment.customer?.name?.toLowerCase() ?? '';

        const identifier = appointment.id?.toLowerCase() ?? '';

        if (
          search &&
          !customerName.includes(search) &&
          !identifier.includes(search)
        ) {
          return false;
        }

        if (!matchesDateFilter(appointment.dateTime, bookingDateFilter)) {
          return false;
        }

        if (
          bookingProviderFilter !== 'ALL' &&
          recordProviderId(appointment) !== bookingProviderFilter
        ) {
          return false;
        }

        if (
          bookingStatusFilter !== 'ALL' &&
          appointment.status !== bookingStatusFilter
        ) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
      );
  }, [
    appointments,
    bookingDateFilter,
    bookingProviderFilter,
    bookingSearch,
    bookingStatusFilter,
  ]);

  function handleTabChange(tab) {
    const next = new URLSearchParams(searchParams);

    if (tab === 'bookings') {
      next.set('tab', 'bookings');
    } else {
      next.delete('tab');
    }

    setSearchParams(next, { replace: true });
  }

  function clearSessionFilters() {
    setSessionSearch('');
    setSessionDateFilter('UPCOMING');
    setSessionProviderFilter('ALL');
    setSessionAvailabilityFilter('ALL');
  }

  function clearBookingFilters() {
    setBookingSearch('');
    setBookingDateFilter('UPCOMING');
    setBookingProviderFilter('ALL');
    setBookingStatusFilter('ALL');
  }

  let action = null;

  if (!loading && !accessDenied && !errorMessage) {
    if (activeTab === 'sessions' && isBranchAssistant) {
      action = (
        <Link
          className="staff-overview-primary-action"
          to="/staff/appointments/sessions/new"
        >
          + Create Doctor Session
        </Link>
      );
    }

    if (activeTab === 'bookings') {
      action = (
        <button
          type="button"
          className="staff-overview-secondary-action"
          onClick={() => loadData()}
        >
          Refresh Bookings
        </button>
      );
    }
  }

  return (
    <StaffAppointmentWorkspace
      role={user?.role}
      title="Appointment Management"
      description={
        loading
          ? 'Loading doctor sessions and customer bookings.'
          : 'Manage doctor sessions and customer bookings for Gampaha Main Branch.'
      }
      activeTab={activeTab}
      onTabChange={handleTabChange}
      action={action}
    >
      {loading ? (
        <LoadingOverview />
      ) : accessDenied || errorMessage ? (
        <ErrorState accessDenied={accessDenied} onRetry={() => loadData()} />
      ) : (
        <>
          <AppointmentMetrics
            todaySessions={todaySessions}
            upcomingSessions={upcomingSessions.length}
            confirmedBookings={confirmedBookings}
            availablePlaces={availablePlaces}
          />

          {activeTab === 'sessions' ? (
            <section aria-labelledby="doctor-sessions-overview">
              <h2
                id="doctor-sessions-overview"
                className="staff-overview-visually-hidden"
              >
                Doctor Sessions
              </h2>

              <div className="staff-overview-filters">
                <label>
                  <span>Search doctor</span>
                  <input
                    type="search"
                    value={sessionSearch}
                    onChange={(event) => setSessionSearch(event.target.value)}
                    placeholder="Search doctor..."
                  />
                </label>

                <label>
                  <span>Date</span>
                  <select
                    value={sessionDateFilter}
                    onChange={(event) =>
                      setSessionDateFilter(event.target.value)
                    }
                  >
                    <option value="UPCOMING">Upcoming</option>
                    <option value="TODAY">Today</option>
                    <option value="PAST">Past</option>
                    <option value="ALL">All</option>
                  </select>
                </label>

                <label>
                  <span>Doctor</span>
                  <select
                    value={sessionProviderFilter}
                    onChange={(event) =>
                      setSessionProviderFilter(event.target.value)
                    }
                  >
                    <option value="ALL">All doctors</option>
                    {sessionProviderOptions.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Session</span>
                  <select
                    value={sessionAvailabilityFilter}
                    onChange={(event) =>
                      setSessionAvailabilityFilter(event.target.value)
                    }
                  >
                    <option value="ALL">All</option>
                    <option value="AVAILABLE">Available</option>
                    <option value="FULL">Full</option>
                  </select>
                </label>
              </div>

              {filteredSessions.length === 0 ? (
                <section className="staff-overview-empty">
                  <div aria-hidden="true">□</div>

                  <h3>No doctor sessions found</h3>

                  <p>
                    No sessions match your date and doctor filters. Clear
                    filters to see other sessions.
                  </p>

                  <div className="staff-overview-empty__actions">
                    <button type="button" onClick={clearSessionFilters}>
                      Clear Filters
                    </button>

                    {isBranchAssistant ? (
                      <Link to="/staff/appointments/sessions/new">
                        + Create Session
                      </Link>
                    ) : null}
                  </div>
                </section>
              ) : (
                <div className="staff-overview-table-wrap">
                  <table className="staff-overview-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Doctor</th>
                        <th>Capacity</th>
                        <th>Confirmed</th>
                        <th>Available</th>
                        <th>Session</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredSessions.map((session) => {
                        const availability = sessionAvailability(session);

                        return (
                          <tr key={session.id}>
                            <td>{appointmentDateLabel(session.startAt)}</td>

                            <td>
                              {sessionTimeRangeLabel(
                                session.startAt,
                                session.endAt,
                              )}
                            </td>

                            <td>
                              <strong>
                                {providerLabel(recordProviderId(session))}
                              </strong>
                            </td>

                            <td>{session.capacity}</td>

                            <td>{session.confirmedCount}</td>

                            <td
                              className={
                                session.remainingCapacity > 0
                                  ? 'staff-overview-positive'
                                  : 'staff-overview-zero'
                              }
                            >
                              {session.remainingCapacity}
                            </td>

                            <td>
                              <span
                                className={[
                                  'staff-overview-status',
                                  availability === 'AVAILABLE'
                                    ? 'staff-overview-status--available'
                                    : 'staff-overview-status--full',
                                ].join(' ')}
                              >
                                {availability === 'AVAILABLE'
                                  ? 'Available'
                                  : 'Full'}
                              </span>
                            </td>

                            <td>
                              <Link
                                className="staff-overview-view-link"
                                to={`/staff/appointments/sessions/${encodeURIComponent(
                                  session.id,
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

                  <div className="staff-session-mobile-list">
                    {filteredSessions.map((session) => {
                      const availability = sessionAvailability(session);

                      return (
                        <article
                          key={session.id}
                          className="staff-session-mobile-card"
                        >
                          <div className="staff-session-mobile-card__header">
                            <strong>
                              {appointmentDateLabel(session.startAt)}
                            </strong>

                            <span
                              className={[
                                'staff-overview-status',
                                availability === 'AVAILABLE'
                                  ? 'staff-overview-status--available'
                                  : 'staff-overview-status--full',
                              ].join(' ')}
                            >
                              {availability === 'AVAILABLE'
                                ? 'Available'
                                : 'Full'}
                            </span>
                          </div>

                          <strong className="staff-session-mobile-card__provider">
                            {providerLabel(recordProviderId(session))}
                          </strong>

                          <span>
                            {sessionTimeRangeLabel(
                              session.startAt,
                              session.endAt,
                            )}
                          </span>

                          <small>
                            Capacity {session.capacity} · Confirmed{' '}
                            {session.confirmedCount} · Available{' '}
                            {session.remainingCapacity}
                          </small>

                          <Link
                            to={`/staff/appointments/sessions/${encodeURIComponent(
                              session.id,
                            )}`}
                          >
                            View Session ›
                          </Link>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section aria-labelledby="customer-bookings-overview">
              <h2
                id="customer-bookings-overview"
                className="staff-overview-section-title"
              >
                Customer Bookings
              </h2>

              <div className="staff-overview-filters">
                <label>
                  <span>Search</span>

                  <input
                    type="search"
                    value={bookingSearch}
                    onChange={(event) => setBookingSearch(event.target.value)}
                    placeholder="Customer / Appointment ID"
                  />
                </label>

                <label>
                  <span>Date</span>

                  <select
                    value={bookingDateFilter}
                    onChange={(event) =>
                      setBookingDateFilter(event.target.value)
                    }
                  >
                    <option value="UPCOMING">Upcoming</option>
                    <option value="TODAY">Today</option>
                    <option value="PAST">Past</option>
                    <option value="ALL">All</option>
                  </select>
                </label>

                <label>
                  <span>Doctor</span>

                  <select
                    value={bookingProviderFilter}
                    onChange={(event) =>
                      setBookingProviderFilter(event.target.value)
                    }
                  >
                    <option value="ALL">All</option>

                    {bookingProviderOptions.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Booking Status</span>

                  <select
                    value={bookingStatusFilter}
                    onChange={(event) =>
                      setBookingStatusFilter(event.target.value)
                    }
                  >
                    <option value="ALL">All</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </label>
              </div>

              {filteredAppointments.length === 0 ? (
                <section className="staff-overview-empty">
                  <div aria-hidden="true">≡</div>

                  <h3>No customer bookings found</h3>

                  <p>
                    There are no bookings matching the selected filters. Try
                    another date or clear filters.
                  </p>

                  <button type="button" onClick={clearBookingFilters}>
                    Clear Filters
                  </button>
                </section>
              ) : (
                <div className="staff-overview-table-wrap">
                  <table className="staff-overview-table">
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
                      {filteredAppointments.map((appointment) => (
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

                            <small className="staff-overview-table__secondary">
                              {appointmentTimeLabel(appointment.dateTime)}
                              {' · '}
                              {getAppointmentTiming(appointment.dateTime) ===
                              'UPCOMING'
                                ? 'Upcoming'
                                : 'Past'}
                            </small>
                          </td>

                          <td>
                            {recordProviderDisplayLabel(appointment) ??
                              providerLabel(recordProviderId(appointment))}
                          </td>

                          <td>
                            <span
                              className={[
                                'staff-overview-status',
                                appointment.status === 'CONFIRMED'
                                  ? 'staff-overview-status--available'
                                  : 'staff-overview-status--cancelled',
                              ].join(' ')}
                            >
                              {getAppointmentStatusLabel(appointment.status)}
                            </span>
                          </td>

                          <td>
                            <Link
                              className="staff-overview-view-link"
                              to={`/staff/appointments/bookings/${encodeURIComponent(
                                appointment.id,
                              )}`}
                            >
                              View ›
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </StaffAppointmentWorkspace>
  );
}
