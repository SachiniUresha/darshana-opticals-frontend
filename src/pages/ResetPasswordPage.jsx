import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import FormField from '../components/forms/FormField';
import { ArrowRightIcon, LockIcon } from '../components/forms/FieldIcons';
import useDocumentTitle from '../hooks/useDocumentTitle';
import authService from '../services/auth/authService';
import '../styles/authShell.css';
import './ResetPasswordPage.css';

const RECOVERY_FEATURES = [
  { primary: 'Premium eyewear collection' },
  { primary: 'Free professional eye tests' },
  { primary: 'Free delivery island-wide' },
  { primary: '30-day easy returns' },
];

function validatePasswords(password, confirmPassword) {
  const errors = {};
  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    errors.newPassword =
      'Use at least 8 characters with an uppercase letter, a lowercase letter, and a number.';
  }
  if (!confirmPassword || password !== confirmPassword) {
    errors.confirmPassword = 'Passwords must match.';
  }
  return errors;
}

function ResetPasswordPage() {
  useDocumentTitle('Reset Password | Darshana Opticals');
  const location = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(location.search).get('token')?.trim() || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [completed, setCompleted] = useState(false);
  const submittingRef = useRef(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current || completed || invalidLink || !token) return;

    const foundErrors = validatePasswords(newPassword, confirmPassword);
    setErrors(foundErrors);
    setRequestError('');
    if (Object.keys(foundErrors).length) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await authService.resetPassword({ token, newPassword });
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      setCompleted(true);
      // Replace the token-bearing URL in browser history after success.
      navigate('/reset-password', { replace: true });
    } catch (error) {
      if (
        error?.status === 400 ||
        error?.code === 'RESET_TOKEN_INVALID_OR_EXPIRED'
      ) {
        setNewPassword('');
        setConfirmPassword('');
        setInvalidLink(true);
        navigate('/reset-password', { replace: true });
      } else if (error?.status === 422) {
        setRequestError(
          'Please choose a password that meets the stated requirements.',
        );
      } else if (error?.status === 429) {
        setRequestError('Too many requests. Please try again later.');
      } else if (error?.status === 0) {
        setRequestError('Unable to reach the server. Please try again.');
      } else {
        setRequestError('Unable to reset your password. Please try again.');
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <AuthBrandPanel features={RECOVERY_FEATURES} />
      <div className="auth-shell__form-section">
        <div className="auth-card">
          <div className="auth-card__header">
            <h1>Reset Password</h1>
            <p>Choose a new password for your account.</p>
          </div>

          {completed ? (
            <div className="reset-password__success" role="status">
              <p>Your password has been reset successfully.</p>
            </div>
          ) : invalidLink || !token ? (
            <div className="reset-password__invalid" role="alert">
              <p>This reset link is invalid or expired.</p>
              <Link to="/forgot-password" className="auth-inline-link">
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
              <p className="reset-password__guidance">
                Use at least 8 characters, including an uppercase letter, a
                lowercase letter, and a number.
              </p>
              <FormField
                id="newPassword"
                label="New Password"
                type="password"
                autoComplete="new-password"
                placeholder="Enter a new password"
                icon={LockIcon}
                value={newPassword}
                error={errors.newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    newPassword: undefined,
                  }));
                  setRequestError('');
                }}
              />
              <FormField
                id="confirmPassword"
                label="Confirm Password"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter the new password"
                icon={LockIcon}
                value={confirmPassword}
                error={errors.confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    confirmPassword: undefined,
                  }));
                  setRequestError('');
                }}
              />
              {requestError ? (
                <p role="alert" className="auth-error-text">
                  {requestError}
                </p>
              ) : null}
              <button
                type="submit"
                className="auth-submit-button"
                disabled={submitting}
              >
                {submitting ? 'Resetting...' : 'Reset Password'}
                {!submitting ? <ArrowRightIcon /> : null}
              </button>
            </form>
          )}

          <p className="auth-card__footer">
            <Link className="auth-inline-link" to="/login">
              Back to Log In
            </Link>
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

export default ResetPasswordPage;
