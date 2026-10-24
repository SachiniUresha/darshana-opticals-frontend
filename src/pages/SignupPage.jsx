import { useState } from 'react';
import { Link } from 'react-router-dom';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useAuth from '../hooks/useAuth';
import FormField from '../components/forms/FormField';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import {
  UserIcon,
  MailIcon,
  PhoneIcon,
  LockIcon,
  ArrowRightIcon,
} from '../components/forms/FieldIcons';
import {
  isRequired,
  isValidEmail,
  isValidPhone,
  isValidPasswordLength,
  passwordsMatch,
  validationMessages,
} from '../utils/validators';
import '../styles/authShell.css';
import './SignupPage.css';

const AGREEMENT_ERROR_MESSAGE =
  'You must agree to the Terms of Service and Privacy Policy to continue.';

const initialFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  password: '',
  confirmPassword: '',
  agreedToTerms: false,
};

// Decorative marketing copy for the branding panel - no functionality.
const SIGNUP_FEATURES = [
  { primary: 'Order History', secondary: 'Track all your past purchases' },
  { primary: 'Exclusive Deals', secondary: 'Member-only discounts & offers' },
  {
    primary: 'Saved Prescriptions',
    secondary: 'Store your lens prescriptions',
  },
  { primary: 'Wishlist', secondary: 'Save your favourite frames' },
];

// Validates the signup form and returns a map of field -> error message.
// A field with no error is simply absent from the returned object.
function validateSignupForm(values) {
  const errors = {};

  if (!isRequired(values.firstName)) {
    errors.firstName = validationMessages.required;
  }

  if (!isRequired(values.lastName)) {
    errors.lastName = validationMessages.required;
  }

  if (!isRequired(values.email)) {
    errors.email = validationMessages.required;
  } else if (!isValidEmail(values.email)) {
    errors.email = validationMessages.email;
  }

  if (!isRequired(values.phone)) {
    errors.phone = validationMessages.required;
  } else if (!isValidPhone(values.phone)) {
    errors.phone = validationMessages.phone;
  }

  if (!isRequired(values.address)) {
    errors.address = validationMessages.required;
  }

  if (!isRequired(values.password)) {
    errors.password = validationMessages.required;
  } else if (!isValidPasswordLength(values.password)) {
    errors.password = validationMessages.passwordLength;
  }

  if (!isRequired(values.confirmPassword)) {
    errors.confirmPassword = validationMessages.required;
  } else if (!passwordsMatch(values.password, values.confirmPassword)) {
    errors.confirmPassword = validationMessages.passwordMismatch;
  }

  if (!values.agreedToTerms) {
    errors.agreedToTerms = AGREEMENT_ERROR_MESSAGE;
  }

  return errors;
}

// Public customer registration page.
// Valid form data is sent through the centralized authentication service.
function SignupPage() {
  useDocumentTitle('Sign Up | Darshana Opticals');

  const { register, isLoading } = useAuth();

  const [values, setValues] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [registrationSucceeded, setRegistrationSucceeded] = useState(false);

  function handleChange(field) {
    return (event) => {
      setValues((previous) => ({
        ...previous,
        [field]: event.target.value,
      }));

      setApiError('');
      setRegistrationSucceeded(false);
    };
  }

  function handleAgreementChange(event) {
    setValues((previous) => ({
      ...previous,
      agreedToTerms: event.target.checked,
    }));

    setApiError('');
    setRegistrationSucceeded(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    const validationErrors = validateSignupForm(values);
    setErrors(validationErrors);
    setApiError('');
    setRegistrationSucceeded(false);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    try {
      await register({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        address: values.address.trim(),
        password: values.password,
      });

      setRegistrationSucceeded(true);

      // Clear passwords after successful registration so credentials do not
      // remain unnecessarily in the form after the request completes.
      setValues((previous) => ({
        ...previous,
        password: '',
        confirmPassword: '',
      }));
    } catch (error) {
      setApiError(
        error.message || 'Unable to create your account. Please try again.',
      );
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-shell__form-section">
        <div className="auth-card">
          <div className="auth-card__header">
            <h1>Create account</h1>
            <p>Join Darshana Opticals today {'\u2014'} it&apos;s free</p>
          </div>

          <form onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
            <div className="auth-field-pair">
              <FormField
                id="firstName"
                label="First Name"
                value={values.firstName}
                onChange={handleChange('firstName')}
                error={errors.firstName}
                autoComplete="given-name"
                placeholder="Mahendra"
                icon={UserIcon}
              />

              <FormField
                id="lastName"
                label="Last Name"
                value={values.lastName}
                onChange={handleChange('lastName')}
                error={errors.lastName}
                autoComplete="family-name"
                placeholder="Perera"
              />
            </div>

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
              id="phone"
              label="Phone Number"
              type="tel"
              value={values.phone}
              onChange={handleChange('phone')}
              error={errors.phone}
              autoComplete="tel"
              placeholder="+94 77 123 4567"
              icon={PhoneIcon}
            />

            <FormField
              id="address"
              label="Registered Address"
              value={values.address}
              onChange={handleChange('address')}
              error={errors.address}
              autoComplete="street-address"
              placeholder="House number, street, city"
            />

            <FormField
              id="password"
              label="Password"
              type="password"
              value={values.password}
              onChange={handleChange('password')}
              error={errors.password}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              icon={LockIcon}
              revealable
              revealLabel="password"
            />

            <FormField
              id="confirmPassword"
              label="Confirm Password"
              type="password"
              value={values.confirmPassword}
              onChange={handleChange('confirmPassword')}
              error={errors.confirmPassword}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              icon={LockIcon}
              revealable
              revealLabel="confirmation"
            />

            <div className="auth-checkbox-group">
              <div className="auth-checkbox-row">
                <input
                  id="agreedToTerms"
                  type="checkbox"
                  checked={values.agreedToTerms}
                  onChange={handleAgreementChange}
                  aria-label="I agree to the Terms of Service and Privacy Policy"
                  aria-invalid={Boolean(errors.agreedToTerms)}
                  aria-describedby={
                    errors.agreedToTerms ? 'agreedToTerms-error' : undefined
                  }
                />

                <label htmlFor="agreedToTerms">
                  I agree to the{' '}
                  <a
                    href="#terms-of-service"
                    className="auth-inline-link"
                    onClick={(event) => event.preventDefault()}
                  >
                    Terms of Service
                  </a>
                  ...
                  <a
                    href="#privacy-policy"
                    className="auth-inline-link"
                    onClick={(event) => event.preventDefault()}
                  >
                    Privacy Policy
                  </a>
                </label>
              </div>

              {errors.agreedToTerms ? (
                <p
                  id="agreedToTerms-error"
                  className="auth-error-text"
                  role="alert"
                >
                  {errors.agreedToTerms}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              className="auth-submit-button"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
              {!isLoading ? <ArrowRightIcon /> : null}
            </button>

            {apiError ? (
              <p role="alert" className="auth-error-text">
                {apiError}
              </p>
            ) : null}

            {registrationSucceeded ? (
              <p role="status" className="signup-page__success">
                Account created successfully. You can now sign in.
              </p>
            ) : null}
          </form>

          <p className="auth-card__footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>

        <p className="auth-copyright">
          &copy; {new Date().getFullYear()} Darshana Opticals (PVT) LTD. All
          rights reserved.
        </p>
      </div>

      <AuthBrandPanel
        features={SIGNUP_FEATURES}
        sectionHeading="Why Join Us?"
      />
    </div>
  );
}

export default SignupPage;
