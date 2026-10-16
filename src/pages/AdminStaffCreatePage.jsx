import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BranchSelect from '../components/common/BranchSelect';
import { BRANCH_ASSISTANT, BRANCH_MANAGER, OPTOMETRIST } from '../config/roles';
import useAuth from '../hooks/useAuth';
import useBranches from '../hooks/useBranches';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { provisionStaff } from '../services/staffAdminService';
import './AdminStaffCreatePage.css';

const STAFF_ROLES = [
  {
    value: BRANCH_MANAGER,
    label: 'Branch Manager',
    description: 'Branch operations',
  },
  {
    value: OPTOMETRIST,
    label: 'Optometrist',
    description: 'Clinical services',
  },
  {
    value: BRANCH_ASSISTANT,
    label: 'Branch Assistant',
    description: 'Branch operations',
  },
];

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  address: '',
  role: '',
  branchId: '',
  password: '',
  confirmPassword: '',
};

function validateStaff(values) {
  const errors = {};
  const name = values.name.trim();
  const phone = values.phone.trim();
  const address = values.address.trim();
  const digits = phone.match(/[0-9]/g)?.length ?? 0;

  if (
    [...name].length < 2 ||
    [...name].length > 100 ||
    !/^[\p{L}\p{M} .'-]+$/u.test(name) ||
    !/\p{L}/u.test(name)
  ) {
    errors.name = 'Enter a valid name (2-100 alphabetic characters).';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (
    !/^\+?[0-9\s()-]{7,20}$/.test(phone) ||
    digits < 10 ||
    digits > 15 ||
    !/[0-9]$/.test(phone)
  ) {
    errors.phone = 'Enter a valid phone number with 10-15 digits.';
  }
  if (address.length < 5) {
    errors.address = 'Enter an address of at least 5 characters.';
  }
  if (!STAFF_ROLES.some((role) => role.value === values.role)) {
    errors.role = 'Select an approved staff designation.';
  }
  if (
    values.password.length < 8 ||
    !/[A-Z]/.test(values.password) ||
    !/[a-z]/.test(values.password) ||
    !/[0-9]/.test(values.password)
  ) {
    errors.password =
      'Use 8+ characters with uppercase, lowercase and a number.';
  }
  if (!values.confirmPassword || values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords must match.';
  }
  return errors;
}

function StaffField({
  id,
  label,
  value,
  onChange,
  error,
  required = true,
  ...rest
}) {
  return (
    <div className="admin-staff__field">
      <label htmlFor={id}>
        {label} {required ? <span aria-hidden="true">*</span> : null}
      </label>
      <input
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        required={required}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="admin-staff__field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function StaffSuccess({ staff, onAnother }) {
  const designation =
    STAFF_ROLES.find((role) => role.value === staff.role)?.label || staff.role;

  return (
    <section
      className="admin-staff__success"
      aria-labelledby="staff-success-heading"
    >
      <span className="admin-staff__success-mark" aria-hidden="true">
        OK
      </span>
      <h2 id="staff-success-heading">Staff Account Created</h2>
      <p role="status">
        Staff member added successfully. Share initial login details securely
        outside this screen.
      </p>
      <dl className="admin-staff__summary">
        <div>
          <dt>Full Name</dt>
          <dd>{staff.name}</dd>
        </div>
        <div>
          <dt>Email Address</dt>
          <dd>{staff.email}</dd>
        </div>
        <div>
          <dt>Designation</dt>
          <dd>{designation}</dd>
        </div>
        <div>
          <dt>Branch</dt>
          <dd>{staff.branchId ? 'Assigned' : 'Not assigned (optional)'}</dd>
        </div>
      </dl>
      <p className="admin-staff__notice">
        For security, passwords are never displayed on this confirmation screen.
      </p>
      <div className="admin-staff__actions admin-staff__actions--center">
        <Link className="admin-staff__secondary" to="/admin">
          Back to Dashboard
        </Link>
        <button
          className="admin-staff__primary"
          type="button"
          onClick={onAnother}
        >
          Create Another Account
        </button>
      </div>
    </section>
  );
}

function AdminStaffCreatePage() {
  useDocumentTitle('Add Staff | Darshana Opticals');
  const navigate = useNavigate();
  const { logout } = useAuth();
  const {
    branches,
    loading: branchesLoading,
    error: branchesError,
    retry,
  } = useBranches();
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdStaff, setCreatedStaff] = useState(null);
  const submittingRef = useRef(false);

  function update(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setRequestError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return;

    const foundErrors = validateStaff(values);
    setErrors(foundErrors);
    setRequestError('');
    if (Object.keys(foundErrors).length) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const payload = {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        role: values.role,
        password: values.password,
        ...(values.branchId ? { branchId: values.branchId } : {}),
      };
      const staff = await provisionStaff(payload);
      setValues(EMPTY_FORM);
      setErrors({});
      setCreatedStaff(staff);
    } catch (error) {
      if (error.status === 401) {
        setValues(EMPTY_FORM);
        logout();
        navigate('/login', { replace: true });
        return;
      }
      if (error.status === 403) {
        setRequestError('You do not have permission to create staff accounts.');
      } else if (error.status === 409) {
        setRequestError('An account with this email already exists.');
      } else if (error.status === 422) {
        setRequestError(error.message || 'Please review the entered details.');
      } else if (error.status === 0) {
        setRequestError('Unable to reach the server. Please try again.');
      } else {
        setRequestError(
          'Staff account could not be created. Please try again.',
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-staff">
      <nav className="admin-staff__breadcrumb" aria-label="Breadcrumb">
        <Link to="/admin">Dashboard</Link>
        <span aria-hidden="true"> / </span>
        <span>{createdStaff ? 'Staff Created' : 'Create Staff'}</span>
      </nav>
      <header className="admin-staff__heading">
        <p className="admin-staff__eyebrow">TEAM &amp; ACCESS MANAGEMENT</p>
        <h1>
          {createdStaff ? 'Staff Account Created' : 'Add New Staff Member'}
        </h1>
        <p>
          {createdStaff
            ? 'Confirmation of a successful account provisioning request.'
            : 'Create a secure staff account. Required details are marked with *.'}
        </p>
      </header>
      {createdStaff ? (
        <StaffSuccess
          staff={createdStaff}
          onAnother={() => setCreatedStaff(null)}
        />
      ) : (
        <div className="admin-staff__layout">
          <section
            className="admin-staff__card"
            aria-labelledby="staff-details-heading"
          >
            <div className="admin-staff__card-head">
              <span aria-hidden="true" className="admin-staff__card-icon">
                01
              </span>
              <div>
                <h2 id="staff-details-heading">Staff Account Details</h2>
                <p>Personal and workplace information</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
              <div className="admin-staff__grid">
                <StaffField
                  id="name"
                  label="Full Name"
                  placeholder="Enter staff member's full name"
                  autoComplete="name"
                  value={values.name}
                  onChange={(e) => update('name', e.target.value)}
                  error={errors.name}
                />
                <StaffField
                  id="email"
                  label="Email Address"
                  type="email"
                  placeholder="staff@example.com"
                  autoComplete="off"
                  value={values.email}
                  onChange={(e) => update('email', e.target.value)}
                  error={errors.email}
                />
                <StaffField
                  id="phone"
                  label="Phone Number"
                  type="tel"
                  placeholder="Enter contact number"
                  autoComplete="tel"
                  value={values.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  error={errors.phone}
                />
                <div className="admin-staff__field">
                  <label htmlFor="role">
                    Designation <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="role"
                    name="role"
                    value={values.role}
                    onChange={(e) => update('role', e.target.value)}
                    aria-invalid={Boolean(errors.role)}
                    aria-describedby={errors.role ? 'role-error' : undefined}
                    required
                  >
                    <option value="">Select approved designation</option>
                    {STAFF_ROLES.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {errors.role ? (
                    <p
                      id="role-error"
                      role="alert"
                      className="admin-staff__field-error"
                    >
                      {errors.role}
                    </p>
                  ) : null}
                </div>
                <div className="admin-staff__span2 admin-staff__field">
                  <label htmlFor="address">
                    Address <span aria-hidden="true">*</span>
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    rows={2}
                    value={values.address}
                    onChange={(e) => update('address', e.target.value)}
                    aria-invalid={Boolean(errors.address)}
                    aria-describedby={
                      errors.address ? 'address-error' : undefined
                    }
                    placeholder="Enter staff member's address"
                    required
                  />
                  {errors.address ? (
                    <p
                      id="address-error"
                      role="alert"
                      className="admin-staff__field-error"
                    >
                      {errors.address}
                    </p>
                  ) : null}
                </div>
                <div className="admin-staff__span2">
                  <BranchSelect
                    id="branchId"
                    name="branchId"
                    label="Branch (optional)"
                    value={values.branchId}
                    branches={branches}
                    loading={branchesLoading}
                    error={branchesError}
                    onRetry={retry}
                    onChange={(value) => update('branchId', value)}
                    disabled={submitting}
                    placeholder="Select an existing branch"
                  />
                  <p className="admin-staff__hint">
                    Branch assignment is optional and uses the current approved
                    branch records.
                  </p>
                </div>
              </div>
              <h3 className="admin-staff__subheading">
                Initial Login Credentials
              </h3>
              <div className="admin-staff__grid">
                <StaffField
                  id="password"
                  label="Initial Password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Enter a secure password"
                  value={values.password}
                  onChange={(e) => update('password', e.target.value)}
                  error={errors.password}
                />
                <StaffField
                  id="confirmPassword"
                  label="Confirm Password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={values.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  error={errors.confirmPassword}
                />
              </div>
              <p className="admin-staff__notice">
                Only approved staff roles can be assigned. Passwords are never
                displayed in the created-account record.
              </p>
              {requestError ? (
                <p className="admin-staff__request-error" role="alert">
                  {requestError}
                </p>
              ) : null}
              <div className="admin-staff__actions">
                <Link className="admin-staff__secondary" to="/admin">
                  Cancel
                </Link>
                <button
                  className="admin-staff__primary"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </section>
          <aside
            className="admin-staff__aside"
            aria-label="Staff creation information"
          >
            <section className="admin-staff__card admin-staff__side-card">
              <h2>Approved Designations</h2>
              <p>Only current canonical staff roles are available.</p>
              <ul>
                {STAFF_ROLES.map(({ value, label, description }) => (
                  <li key={value}>
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="admin-staff__card admin-staff__side-card">
              <h2>Account Security</h2>
              <p>Only System Administrators may create staff accounts.</p>
              <ul className="admin-staff__security-list">
                <li>One approved role per account</li>
                <li>Duplicate emails are rejected</li>
                <li>Passwords are securely handled</li>
                <li>Branch selection is optional</li>
              </ul>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

export default AdminStaffCreatePage;
