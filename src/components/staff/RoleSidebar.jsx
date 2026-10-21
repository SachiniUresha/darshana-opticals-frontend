import { Link, NavLink, useNavigate } from 'react-router-dom';
import logo from '../../assets/darshana-logo.jpg';
import useAuth from '../../hooks/useAuth';
import {
  BRANCH_ASSISTANT,
  BRANCH_MANAGER,
  OPTOMETRIST,
} from '../../config/roles';
import { StaffIdentityDropdown } from '../common/Navbar';
import '../admin/AdminSidebar.css';
import './RoleSidebar.css';

const commonStaffLinks = [
  { to: '/staff/orders', label: 'Order Management', icon: 'orders' },
  { to: '/staff/appointments', label: 'Appointments', icon: 'appointments' },
];
const managerLinks = [
  ...commonStaffLinks,
  { to: '/staff/inventory', label: 'Inventory', icon: 'inventory' },
  { to: '/staff/reports/sales', label: 'Sales Reports', icon: 'reports' },
  {
    to: '/staff/reports/inventory',
    label: 'Inventory Reports',
    icon: 'reports',
  },
  { to: '/staff/loyalty', label: 'Loyalty Monitoring', icon: 'loyalty' },
];
const clinicalLinks = [
  {
    to: '/clinical/prescriptions/new',
    label: 'Prescription Handling',
    icon: 'prescriptions',
  },
];

function NavIcon({ name }) {
  const paths = {
    orders: 'M3 4h18v16H3z M3 9h18 M7 14h5',
    appointments: 'M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4',
    inventory: 'M3 7l9-4 9 4v11l-9 4-9-4z M3 7l9 5 9-5 M12 12v10',
    reports: 'M4 20V10 M10 20V4 M16 20v-8 M22 20V7',
    loyalty: 'M12 2l3 6.5 7 .8-5.1 4.9 1.4 7-6.3-3.5-6.3 3.5 1.4-7L2 9.3l7-.8z',
    prescriptions: 'M7 3h9l4 4v14H7z M16 3v5h4 M10 12h7 M10 16h7',
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export default function RoleSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isManager = user?.role === BRANCH_MANAGER;
  const isAssistant = user?.role === BRANCH_ASSISTANT;
  const isOptometrist = user?.role === OPTOMETRIST;
  const links = isManager
    ? managerLinks
    : isAssistant
      ? commonStaffLinks
      : isOptometrist
        ? clinicalLinks
        : [];
  const landingPage = isOptometrist
    ? '/clinical/prescriptions/new'
    : '/staff/orders';
  const displayName = user?.name?.trim() || 'Staff member';
  const initials = isManager ? 'BM' : isAssistant ? 'BA' : 'OP';

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="admin-sidebar role-sidebar" aria-label="Staff workspace">
      <Link
        to={landingPage}
        className="admin-sidebar__brand"
        aria-label="Darshana Opticals staff workspace"
      >
        <img src={logo} alt="" aria-hidden="true" />
        <span className="admin-sidebar__brand-copy">
          <strong>Darshana Opticals</strong>
          <small>Eyewear Studio</small>
        </span>
      </Link>

      <nav className="admin-sidebar__nav" aria-label="Staff navigation">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `admin-sidebar__link${isActive ? ' admin-sidebar__link--active' : ''}`
            }
          >
            <NavIcon name={icon} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="admin-sidebar__bottom">
        <div className="admin-sidebar__identity role-sidebar__identity">
          <span className="admin-sidebar__avatar" aria-hidden="true">
            {initials}
          </span>
          <div className="role-sidebar__identity-copy">
            <strong>{displayName}</strong>
            {isOptometrist ? (
              <small>Optometrist</small>
            ) : (
              <StaffIdentityDropdown
                staff={user}
                onUnauthorized={handleLogout}
              />
            )}
          </div>
        </div>
        <button
          className="admin-sidebar__logout"
          type="button"
          onClick={handleLogout}
        >
          Log Out
        </button>
      </div>
    </aside>
  );
}
