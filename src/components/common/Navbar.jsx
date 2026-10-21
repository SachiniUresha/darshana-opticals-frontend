import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../../assets/darshana-logo.jpg';
import useAuth from '../../hooks/useAuth';
import { useBranches } from '../../hooks/useBranches';
import {
  CUSTOMER,
  OPTOMETRIST,
  BRANCH_ASSISTANT,
  BRANCH_MANAGER,
  SYSTEM_ADMIN,
} from '../../config/roles';
import SearchBar from '../products/SearchBar';
import './Navbar.css';
import useCart from '../../hooks/useCart';

const categoryLinks = ['Men', 'Women', 'Kids', 'Sunglasses'];

/** Read-only identity details; mounted only for Branch Manager / Branch Assistant. */
export function StaffIdentityDropdown({ staff, onUnauthorized }) {
  const { branches, loading, error, retry, unauthorized } = useBranches();
  const { pathname, search } = useLocation();
  const containerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    if (unauthorized) onUnauthorized();
  }, [unauthorized, onUnauthorized]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function closeOnOutsideClick(event) {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const staffRole =
    staff.role === BRANCH_MANAGER ? 'Branch Manager' : 'Branch Assistant';
  const name = staff.name?.trim() || 'Unavailable';
  const assignedBranch = staff.branchId
    ? branches.find((branch) => branch.id === staff.branchId)?.address ||
      'Assigned branch unavailable'
    : 'Not assigned';

  return (
    <div className="navbar__staff-identity" ref={containerRef}>
      <button
        type="button"
        className="navbar__staff-identity-trigger"
        aria-label="View staff identity"
        aria-expanded={isOpen}
        aria-controls="navbar-staff-identity-panel"
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <span>{staffRole}</span>
        <span aria-hidden="true">{'\u25BE'}</span>
      </button>
      {isOpen && (
        <div
          id="navbar-staff-identity-panel"
          className="navbar__staff-identity-panel"
          role="region"
          aria-label="Staff identity details"
        >
          <strong className="navbar__staff-identity-heading">
            Logged-in Staff
          </strong>
          <dl className="navbar__staff-identity-details">
            <div>
              <dt>Name</dt>
              <dd>{name}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{staffRole}</dd>
            </div>
            <div>
              <dt>Assigned Branch</dt>
              <dd>
                {!staff.branchId ? (
                  assignedBranch
                ) : loading ? (
                  <span role="status">Loading assigned branch...</span>
                ) : error ? (
                  <>
                    <span role="alert">{error}</span>
                    <button
                      type="button"
                      className="navbar__staff-identity-retry"
                      onClick={retry}
                    >
                      Retry branches
                    </button>
                  </>
                ) : (
                  assignedBranch
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const isAdminWorkspace =
    isAuthenticated &&
    user?.role === SYSTEM_ADMIN &&
    (location.pathname === '/admin' || location.pathname.startsWith('/admin/'));
  const { cartCount } = useCart();
  const isStaffWorkspace =
    isAuthenticated &&
    (user?.role === BRANCH_MANAGER ||
      user?.role === BRANCH_ASSISTANT ||
      user?.role === OPTOMETRIST);
  const currentParams = new URLSearchParams(location.search);

  const currentSearch = location.pathname.startsWith('/products')
    ? currentParams.get('q') || ''
    : '';

  const [query, setQuery] = useState(currentSearch);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  useEffect(() => {
    setQuery(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    setIsAccountMenuOpen(false);
  }, [location.pathname, location.search]);

  const handleSearch = (value) => {
    const next = new URLSearchParams(
      location.pathname.startsWith('/products') ? location.search : '',
    );

    const cleanValue = value.trim();

    if (cleanValue) {
      next.set('q', cleanValue);
    } else {
      next.delete('q');
    }

    navigate({
      pathname: '/products',
      search: next.toString() ? `?${next.toString()}` : '',
    });
  };

  function handleLogout() {
    setIsAccountMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  }

  function toggleAccountMenu() {
    setIsAccountMenuOpen((current) => !current);
  }

  const canViewStaffAppointments =
    user?.role === BRANCH_ASSISTANT || user?.role === BRANCH_MANAGER;

  return (
    <header className="site-header">
      <nav
        className={
          isAdminWorkspace
            ? 'navbar navbar--admin'
            : isStaffWorkspace
              ? 'navbar navbar--staff'
              : 'navbar'
        }
        aria-label="Main navigation"
      >
        <Link
          className="navbar__brand"
          to={isAdminWorkspace ? '/admin' : '/'}
          aria-label={
            isAdminWorkspace
              ? 'Darshana Opticals admin dashboard'
              : 'Darshana Opticals home'
          }
        >
          <img
            src={logo}
            alt=""
            className="navbar__brand-logo"
            aria-hidden="true"
          />

          <span className="navbar__brand-copy">
            <span className="navbar__brand-name">Darshana Opticals</span>
            <span className="navbar__brand-tagline">Eyewear Studio</span>
          </span>
        </Link>

        <button
          type="button"
          className="navbar__menu-button"
          aria-label="Toggle account menu"
          aria-expanded={isAccountMenuOpen}
          aria-controls="navbar-account-menu"
          onClick={toggleAccountMenu}
        >
          <span aria-hidden="true">☰</span>
        </button>

        {!isAdminWorkspace && !isStaffWorkspace ? (
          <>
            <ul className="navbar__categories">
              {categoryLinks.map((category) => (
                <li key={category}>
                  <Link
                    to={`/products?category=${encodeURIComponent(category)}`}
                    className="navbar__category-link"
                  >
                    {category}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="navbar__search">
              <SearchBar
                value={query}
                onChange={setQuery}
                onSubmit={handleSearch}
                compact
              />
            </div>
          </>
        ) : null}

        <ul
          id="navbar-account-menu"
          className={[
            'navbar__account-links',
            isAccountMenuOpen ? 'navbar__account-links--open' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {isAuthenticated ? (
            <>
              {user?.role === CUSTOMER ? (
                <>
                  <li>
                    <Link className="navbar__cart-link" to="/cart">
                      Cart
                      {cartCount > 0 ? (
                        <span
                          className="navbar__cart-count"
                          aria-label={`${cartCount} items`}
                        >
                          {cartCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>

                  <li>
                    <Link to="/appointments">Appointments</Link>
                  </li>

                  <li>
                    <Link to="/profile">Profile</Link>
                  </li>
                </>
              ) : null}

              {user?.role === OPTOMETRIST ? (
                <li>
                  <Link to="/clinical/prescriptions/new">
                    Prescription Handling
                  </Link>
                </li>
              ) : null}

              {user?.role === SYSTEM_ADMIN ? (
                <li>
                  <Link to="/admin">Admin Dashboard</Link>
                </li>
              ) : null}

              {(user?.role === BRANCH_ASSISTANT ||
                user?.role === BRANCH_MANAGER) && (
                <li>
                  <Link to="/staff/orders">Order Management</Link>
                </li>
              )}

              {user?.role === BRANCH_MANAGER ? (
                <li>
                  <Link to="/staff/loyalty">Loyalty Monitoring</Link>
                </li>
              ) : null}

              {canViewStaffAppointments ? (
                <li>
                  <Link to="/staff/appointments">Appointments</Link>
                </li>
              ) : null}

              {user?.role === BRANCH_MANAGER && (
                <li>
                  <Link to="/staff/inventory">Inventory</Link>
                </li>
              )}

              {user?.role === BRANCH_MANAGER && (
                <li>
                  <Link to="/staff/reports/sales">Sales Reports</Link>
                </li>
              )}

              {user?.role === BRANCH_MANAGER && (
                <li>
                  <Link to="/staff/reports/inventory">Inventory Reports</Link>
                </li>
              )}

              {(user?.role === BRANCH_MANAGER ||
                user?.role === BRANCH_ASSISTANT) && (
                <li className="navbar__staff-role">
                  <StaffIdentityDropdown
                    staff={user}
                    onUnauthorized={handleLogout}
                  />
                </li>
              )}

              <li>
                <button
                  type="button"
                  className="navbar__logout-button"
                  onClick={handleLogout}
                >
                  Log Out
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link to="/login">Log In</Link>
              </li>

              <li>
                <Link className="navbar__signup-link" to="/signup">
                  Sign Up
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
}

export default Navbar;
