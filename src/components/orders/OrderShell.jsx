import { Link, NavLink, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import './orders.css';

export default function OrderShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const name = user?.name || 'Customer';
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <section className="orders-page" aria-labelledby="orders-title">
      <header className="orders-heading">
        <h1 id="orders-title">My Orders</h1>
        <p>Manage your profile &amp; preferences</p>
      </header>
      <div className="orders-layout">
        <aside className="orders-sidebar" aria-label="Customer account">
          <div className="orders-person">
            <span className="orders-avatar" aria-hidden="true">
              {initials || 'DO'}
            </span>
            <div>
              <strong>{name}</strong>
              <small>{user?.email || 'Customer account'}</small>
              <Link to="/profile">My account</Link>
            </div>
          </div>
          <nav className="orders-nav" aria-label="Account sections">
            <NavLink to="/profile">
              My Profile <span aria-hidden="true">&rsaquo;</span>
            </NavLink>
            <NavLink
              to="/orders"
              className={({ isActive }) =>
                isActive || window.location.pathname.startsWith('/orders/')
                  ? 'active'
                  : ''
              }
            >
              Order History <span aria-hidden="true">&rsaquo;</span>
            </NavLink>
            {[
              'Saved Prescriptions',
              'Wishlist',
              'Addresses',
              'Security',
              'Notifications',
            ].map((label) => (
              <span className="orders-nav-disabled" key={label}>
                {label}
                <span aria-hidden="true">&rsaquo;</span>
              </span>
            ))}
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              Sign Out
            </button>
          </nav>
        </aside>
        <div className="orders-content">{children}</div>
      </div>
    </section>
  );
}
