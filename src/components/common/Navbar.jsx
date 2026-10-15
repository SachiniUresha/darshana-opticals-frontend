import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../../assets/darshana-logo.jpg';
import useAuth from '../../hooks/useAuth';
import {
  CUSTOMER,
  OPTOMETRIST,
  BRANCH_ASSISTANT,
  BRANCH_MANAGER,
} from '../../config/roles';
import SearchBar from '../products/SearchBar';
import './Navbar.css';
import useCart from '../../hooks/useCart';

const categoryLinks = ['Men', 'Women', 'Kids', 'Sunglasses'];

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { cartCount } = useCart();

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
      <nav className="navbar" aria-label="Main navigation">
        <Link
          className="navbar__brand"
          to="/"
          aria-label="Darshana Opticals home"
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
                    Record Prescription
                  </Link>
                </li>
              ) : null}

              {(user?.role === BRANCH_ASSISTANT ||
                user?.role === BRANCH_MANAGER) && (
                <li>
                  <Link to="/staff/orders">Staff Orders</Link>
                </li>
              )}

              {canViewStaffAppointments ? (
                <li>
                  <Link to="/staff/appointments">Appointments</Link>
                </li>
              ) : null}

              {(user?.role === BRANCH_MANAGER ||
                user?.role === BRANCH_ASSISTANT) && (
                <li className="navbar__staff-role">
                  {user.role === BRANCH_MANAGER
                    ? 'Branch Manager'
                    : 'Branch Assistant'}
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
