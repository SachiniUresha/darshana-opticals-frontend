import { BRANCH_ASSISTANT } from '../../config/roles';
import './StaffAppointmentWorkspace.css';

export default function StaffAppointmentWorkspace({
  role,
  title,
  description,
  activeTab = 'sessions',
  onTabChange,
  action,
  children,
}) {
  const canManage = role === BRANCH_ASSISTANT;

  return (
    <section className="staff-appointment-workspace">
      <header className="staff-appointment-workspace__header">
        <div>
          <p className="staff-appointment-workspace__breadcrumb">
            STAFF / APPOINTMENTS
          </p>

          <h1>{title}</h1>

          {description ? <p>{description}</p> : null}
        </div>

        <div className="staff-appointment-workspace__header-action">
          {action}
        </div>
      </header>

      <section
        className="staff-appointment-location"
        aria-label="Appointment location"
      >
        <div>
          <span className="staff-appointment-location__label">Location</span>

          <strong>Gampaha Main Branch · Sri Lanka Time (Asia/Colombo)</strong>
        </div>

        <span className="staff-appointment-location__badge">
          Single approved branch
        </span>
      </section>

      <div
        className={[
          'staff-appointment-access',
          canManage
            ? 'staff-appointment-access--operational'
            : 'staff-appointment-access--readonly',
        ].join(' ')}
      >
        {canManage ? 'Operational access' : 'Read-only access'}
      </div>

      {onTabChange ? (
        <div
          className="staff-appointment-tabs"
          role="tablist"
          aria-label="Appointment management sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sessions'}
            className={
              activeTab === 'sessions' ? 'staff-appointment-tabs__active' : ''
            }
            onClick={() => onTabChange('sessions')}
          >
            Doctor Sessions
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bookings'}
            className={
              activeTab === 'bookings' ? 'staff-appointment-tabs__active' : ''
            }
            onClick={() => onTabChange('bookings')}
          >
            Customer Bookings
          </button>
        </div>
      ) : null}

      <div className="staff-appointment-workspace__content">{children}</div>
    </section>
  );
}
