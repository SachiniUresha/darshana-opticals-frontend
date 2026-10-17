import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useAuth from '../hooks/useAuth';
import FormField from '../components/forms/FormField';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import {
  MailIcon,
  LockIcon,
  ArrowRightIcon,
  SparkleIcon,
  EyeIcon,
  TruckIcon,
  RefreshIcon,
} from '../components/forms/FieldIcons';
import {
  isRequired,
  isValidEmail,
  validationMessages,
} from '../utils/validators';
import { getPostLoginRoute } from '../routes/roleNavigation';
import '../styles/authShell.css';
import './LoginPage.css';

const initialFormState = {
  email: '',
  password: '',
};

// Decorative marketing copy for the branding panel - no functionality.
const LOGIN_FEATURES = [
  { primary: 'Premium eyewear collection', icon: SparkleIcon },
  { primary: 'Free professional eye tests', icon: EyeIcon },
  { primary: 'Free delivery island-wide', icon: TruckIcon },
  { primary: '30-day easy returns', icon: RefreshIcon },
];

// Validates the login form and returns a map of field -> error message.
function validateLoginForm(values) {
  const errors = {};

  if (!isRequired(values.email)) {
    errors.email = validationMessages.required;
  } else if (!isValidEmail(values.email)) {
    errors.email = validationMessages.email;
  }

  if (!isRequired(values.password)) {
    errors.password = validationMessages.required;
  }

  return errors;
}

// Reuse the login form's existing inline-link styling.
function ForgotPasswordLink() {
  return (
    <Link to="/forgot-password" className="auth-inline-link">
      Forgot password?
    </Link>
  );
}

// Public login page.
// Valid credentials are sent through the centralized authentication service.
function LoginPage() {
  useDocumentTitle('Log In | Darshana Opticals');

  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  function handleChange(field) {
    return (event) => {
      setValues((previous) => ({
        ...previous,
        [field]: event.target.value,
      }));

      setApiError('');
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    const validationErrors = validateLoginForm(values);

    setErrors(validationErrors);
    setApiError('');

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    try {
      const authenticatedUser = await login({
        email: values.email,
        password: values.password,
      });
      navigate(getPostLoginRoute(authenticatedUser?.role), { replace: true });
    } catch (error) {
      setApiError(error.message || 'Unable to sign in. Please try again.');
    }
  }

  return (
    <div className="auth-shell">
      <AuthBrandPanel features={LOGIN_FEATURES} />

      <div className="auth-shell__form-section">
        <div className="auth-card">
          <div className="auth-card__header">
            <h1>Welcome back</h1>
            <p>Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
            <FormField
              id="email"
              label="Email Address"
              type="email"
              value={values.email}
              onChange={handleChange('email')}
              error={errors.email}
              autoComplete="email"
              placeholder="you@example.com"
              icon={MailIcon}
            />
            <FormField
              id="password"
              label="Password"
              type="password"
              value={values.password}
              onChange={handleChange('password')}
              error={errors.password}
              autoComplete="current-password"
              placeholder="Enter your password"
              icon={LockIcon}
              revealable
              labelExtra={<ForgotPasswordLink />}
            />
            <button
              type="submit"
              className="auth-submit-button"
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
              {!isLoading ? <ArrowRightIcon /> : null}
            </button>
            {apiError ? (
              <p role="alert" className="auth-error-text">
                {apiError}
              </p>
            ) : null}{' '}
          </form>

          <p className="auth-card__footer">
            Don&apos;t have an account?{' '}
            <Link to="/signup">Create one free</Link>
          </p>
        </div>

        <p className="auth-copyright">
          &copy; {new Date().getFullYear()} Darshana Opticals (PVT) LTD. All
          rights reserved.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
