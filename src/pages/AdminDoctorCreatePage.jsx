import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { createDoctor } from '../services/doctorAdminService';
import './AdminDoctorCreatePage.css';

const EMPTY_FORM = { name: '', specialization: '' };

function validateDoctor({ name, specialization }) {
  const errors = {};
  if (!name.trim()) {
    errors.name = 'Doctor name is required.';
  } else if ([...name.trim()].length > 100) {
    errors.name = 'Doctor name must be 100 characters or fewer.';
  }
  if (!specialization.trim()) {
    errors.specialization = 'Specialization is required.';
  } else if ([...specialization.trim()].length > 100) {
    errors.specialization = 'Specialization must be 100 characters or fewer.';
  }
  return errors;
}

function DoctorInput({
  name,
  label,
  value,
  error,
  onChange,
  disabled,
  placeholder,
}) {
  return (
    <div className="admin-doctor__field">
      <label htmlFor={`doctor-${name}`}>
        {label} <span aria-hidden="true">*</span>
      </label>
      <input
        id={`doctor-${name}`}
        name={name}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={101}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `doctor-${name}-error` : undefined}
      />
      {error ? (
        <p
          id={`doctor-${name}-error`}
          className="admin-doctor__field-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DoctorSuccess({ doctor, onAnother }) {
  return (
    <section
      className="admin-doctor__success"
      aria-labelledby="doctor-success-heading"
    >
      <h2 id="doctor-success-heading">Doctor Registered Successfully</h2>
      <p role="status">Doctor added successfully.</p>
      <dl className="admin-doctor__details">
        <div>
          <dt>Doctor Name</dt>
          <dd>{doctor.name}</dd>
        </div>
        <div>
          <dt>Specialization</dt>
          <dd>{doctor.specialization}</dd>
        </div>
      </dl>
      <div className="admin-doctor__actions admin-doctor__actions--center">
        <Link className="admin-doctor__secondary" to="/admin">
          Back to Dashboard
        </Link>
        <button
          className="admin-doctor__primary"
          type="button"
          onClick={onAnother}
        >
          Add Another Doctor
        </button>
      </div>
    </section>
  );
}

function AdminDoctorCreatePage() {
  useDocumentTitle('Add Doctor | Darshana Opticals');
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdDoctor, setCreatedDoctor] = useState(null);
  const submittingRef = useRef(false);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setRequestError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current || createdDoctor) return;

    const validationErrors = validateDoctor(values);
    setErrors(validationErrors);
    setRequestError('');
    if (Object.keys(validationErrors).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const doctor = await createDoctor({
        name: values.name.trim(),
        specialization: values.specialization.trim(),
      });
      setValues(EMPTY_FORM);
      setErrors({});
      setCreatedDoctor(doctor);
    } catch (error) {
      if (error.status === 401) {
        setValues(EMPTY_FORM);
        logout();
        navigate('/login', { replace: true });
        return;
      }
      if (error.status === 403) {
        setRequestError('You do not have permission to register doctors.');
      } else if (error.status === 422) {
        setRequestError(
          error.message || 'Please check the entered doctor information.',
        );
      } else if (error.status === 0) {
        setRequestError('Unable to reach the server. Please try again.');
      } else {
        setRequestError('Doctor could not be registered. Please try again.');
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-doctor">
      <nav className="admin-doctor__breadcrumb" aria-label="Breadcrumb">
        <Link to="/admin">Dashboard</Link>
        <span aria-hidden="true"> / </span>
        <span>{createdDoctor ? 'Doctor Created' : 'Add Doctor'}</span>
      </nav>
      <header className="admin-doctor__heading">
        <p className="admin-doctor__eyebrow">DOCTOR MANAGEMENT</p>
        <h1>{createdDoctor ? 'Doctor Created' : 'Add New Doctor'}</h1>
        <p>
          {createdDoctor
            ? 'Doctor registration has been confirmed.'
            : 'Register a doctor for the appointment service. Both fields are required.'}
        </p>
      </header>

      {createdDoctor ? (
        <DoctorSuccess
          doctor={createdDoctor}
          onAnother={() => setCreatedDoctor(null)}
        />
      ) : (
        <div className="admin-doctor__layout">
          <section
            className="admin-doctor__card"
            aria-labelledby="doctor-details-heading"
          >
            <div className="admin-doctor__card-head">
              <span className="admin-doctor__card-icon" aria-hidden="true">
                02
              </span>
              <div>
                <h2 id="doctor-details-heading">Doctor Information</h2>
                <p>Doctor details</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
              <DoctorInput
                name="name"
                label="Doctor Name"
                placeholder="e.g. Dr. Nimal Perera"
                value={values.name}
                error={errors.name}
                onChange={(value) => update('name', value)}
                disabled={submitting}
              />
              <DoctorInput
                name="specialization"
                label="Specialization"
                placeholder="e.g. Ophthalmologist"
                value={values.specialization}
                error={errors.specialization}
                onChange={(value) => update('specialization', value)}
                disabled={submitting}
              />
              {requestError ? (
                <p className="admin-doctor__request-error" role="alert">
                  {requestError}
                </p>
              ) : null}
              <div className="admin-doctor__actions">
                <Link className="admin-doctor__secondary" to="/admin">
                  Cancel
                </Link>
                <button
                  className="admin-doctor__primary"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Registering Doctor...' : 'Add Doctor'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default AdminDoctorCreatePage;
