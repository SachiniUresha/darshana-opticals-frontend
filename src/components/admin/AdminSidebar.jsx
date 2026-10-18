import { Link, NavLink, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import logo from '../../assets/darshana-logo.jpg';
import './AdminSidebar.css';

const adminLinks = [
  { to: '/admin', title: 'Dashboard', end: true, icon: 'dashboard' },
  { to: '/admin/inventory', title: 'Inventory', icon: 'inventory' },
  { to: '/admin/staff/new', title: 'Add Staff Member', icon: 'staff' },
  { to: '/admin/doctors/new', title: 'Add Doctor', icon: 'doctor' },
];

function NavIcon({ name }) {
  if (name === 'dashboard') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }
  if (name === 'inventory') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 10v10M15 10v10" />
      </svg>
    );
  }
  if (name === 'staff') {
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
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20v-2.2a5.5 5.5 0 0 1 11 0V20" />
        <path d="M19 8v8M15 12h8" />
      </svg>
    );
  }
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
      <path d="M6 4v4a5 5 0 0 0 10 0V4" />
      <path d="M4 4h4M14 4h4M11 13v3a4 4 0 0 0 8 0v-1" />
      <circle cx="19" cy="13" r="2" />
    </svg>
  );
}

function AdminSidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="admin-sidebar" aria-label="Administrator workspace">
      <Link
        to="/admin"
        className="admin-sidebar__brand"
        aria-label="Darshana Opticals Admin Dashboard"
      >
        <img src={logo} alt="" aria-hidden="true" />
        <span className="admin-sidebar__brand-copy">
          <strong>Darshana Opticals</strong>
          <small>Eyewear Studio</small>
        </span>
      </Link>

      <div className="admin-sidebar__heading">Admin Workspace</div>
      <nav className="admin-sidebar__nav" aria-label="Admin workspace">
        {adminLinks.map(({ to, title, end, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `admin-sidebar__link${isActive ? ' admin-sidebar__link--active' : ''}`
            }
          >
            <NavIcon name={icon} />
            <span>{title}</span>
          </NavLink>
        ))}
      </nav>

      <div className="admin-sidebar__bottom">
        <div className="admin-sidebar__identity">
          <span className="admin-sidebar__avatar" aria-hidden="true">
            SA
          </span>
          <div>
            <strong>System Administrator</strong>
            <small>Admin workspace</small>
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

export default AdminSidebar;
