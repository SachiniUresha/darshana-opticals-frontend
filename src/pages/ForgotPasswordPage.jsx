import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import FormField from '../components/forms/FormField';
import { ArrowRightIcon, MailIcon } from '../components/forms/FieldIcons';
import useDocumentTitle from '../hooks/useDocumentTitle';
import authService from '../services/auth/authService';
import {
  isRequired,
  isValidEmail,
  validationMessages,
} from '../utils/validators';
import '../styles/authShell.css';
import './ForgotPasswordPage.css';

const RECOVERY_FEATURES = [
  { primary: 'Premium eyewear collection' },
  { primary: 'Free professional eye tests' },
  { primary: 'Free delivery island-wide' },
  { primary: '30-day easy returns' },
];

const GENERIC_CONFIRMATION =
  'If an eligible account exists for this email, a password reset link has been sent.';

function ForgotPasswordPage() {
  useDocumentTitle('Forgot Password | Darshana Opticals');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const submittingRef = useRef(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current || sent) return;

    setEmailError('');
    setRequestError('');
    if (!isRequired(email)) {
      setEmailError(validationMessages.required);
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError(validationMessages.email);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await authService.requestPasswordReset(email);
      setEmail('');
      setSent(true);
    } catch (error) {
      if (error?.status === 422) {
        setRequestError('Please enter a valid email address.');
      } else if (error?.status === 429) {
        setRequestError('Too many requests. Please try again later.');
      } else if (error?.status === 0) {
        setRequestError('Unable to reach the server. Please try again.');
      } else {
        setRequestError('Unable to process your request. Please try again.');
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
            <h1>Forgot Password?</h1>
            <p>Enter your email address to request a password reset link.</p>
          </div>

          {sent ? (
            <p className="forgot-password__success" role="status">
              {GENERIC_CONFIRMATION}
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
              <FormField
                id="email"
                label="Email Address"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                icon={MailIcon}
                value={email}
                error={emailError}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError('');
                  setRequestError('');
                }}
              />
              {requestError ? (
                <p className="auth-error-text" role="alert">
                  {requestError}
                </p>
              ) : null}
              <button
                type="submit"
                className="auth-submit-button"
                disabled={submitting}
              >
                {submitting ? 'Sending...' : 'Send Reset Link'}
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

export default ForgotPasswordPage;
