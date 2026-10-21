import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import prescriptionService from '../../services/prescription/prescriptionService';
import './PrescriptionEntryForm.css';

const EYES = [
  { key: 'rightEye', title: 'Right Eye' },
  { key: 'leftEye', title: 'Left Eye' },
];

const FIELD_GROUPS = [
  {
    key: 'distance',
    title: 'Distance',
    fields: [
      { key: 'sph', label: 'SPH', type: 'number' },
      { key: 'cyl', label: 'CYL', type: 'number' },
      { key: 'axis', label: 'Axis', type: 'number' },
      { key: 'va', label: 'VA', type: 'text' },
    ],
  },
  {
    key: 'reading',
    title: 'Reading',
    fields: [
      { key: 'add', label: 'Add Power', type: 'number' },
      { key: 'nearVa', label: 'Near VA', type: 'text' },
    ],
  },
];

function createEmptyValues() {
  const values = { remarks: '' };

  for (const eye of EYES) {
    for (const group of FIELD_GROUPS) {
      for (const field of group.fields) {
        values[`${eye.key}.${group.key}.${field.key}`] = '';
      }
    }
  }

  return values;
}

function buildValidatedPayload(values, customerId) {
  const errors = {};

  const payload = {
    customerId,
    rightEye: { distance: {}, reading: {} },
    leftEye: { distance: {}, reading: {} },
    remarks: values.remarks.trim(),
  };

  if (!customerId) {
    errors.customerId = 'Please select a customer.';
  }

  for (const eye of EYES) {
    for (const group of FIELD_GROUPS) {
      for (const field of group.fields) {
        const path = `${eye.key}.${group.key}.${field.key}`;
        const rawValue = (values[path] ?? '').trim();

        // Empty clinical fields are optional according to the backend.
        if (!rawValue) continue;

        if (field.type === 'number') {
          const number = Number(rawValue);

          if (!Number.isFinite(number)) {
            errors[path] = 'Enter a valid number.';
            continue;
          }

          if (field.key === 'axis' && (number < 0 || number > 180)) {
            errors[path] = 'Axis must be between 0 and 180.';
            continue;
          }

          payload[eye.key][group.key][field.key] = number;
        } else {
          payload[eye.key][group.key][field.key] = rawValue;
        }
      }
    }
  }

  if (values.remarks.length > 1000) {
    errors.remarks = 'Remarks cannot exceed 1000 characters.';
  }

  return { payload, errors };
}

export default function PrescriptionEntryForm({ customer, onSaved }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [values, setValues] = useState(createEmptyValues);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [savedPrescription, setSavedPrescription] = useState(null);

  function handleChange(event) {
    const { name, value } = event.target;

    setValues((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: '',
    }));

    setSubmitError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting || savedPrescription) return;

    const result = buildValidatedPayload(values, customer?.id);

    if (Object.keys(result.errors).length > 0) {
      setErrors(result.errors);
      setSubmitError('Please correct the highlighted fields.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const recorded = await prescriptionService.createPrescription(
        result.payload,
      );

      if (onSaved) {
        onSaved(recorded);
      } else {
        setSavedPrescription(recorded);
      }
    } catch (error) {
      if (error?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }

      if (error?.status === 403) {
        setSubmitError('You do not have permission to record prescriptions.');
      } else if (error?.status === 404) {
        setSubmitError(
          'The selected customer could not be found. Please search again.',
        );
      } else if (error?.status === 400 || error?.status === 422) {
        setSubmitError(
          'The prescription could not be saved. Please check your measurements.',
        );
      } else {
        setSubmitError('Unable to save the prescription. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleRecordAnother() {
    setValues(createEmptyValues());
    setErrors({});
    setSubmitError('');
    setSavedPrescription(null);
  }

  const locked = submitting || Boolean(savedPrescription);

  return (
    <section className="clinical-panel" aria-labelledby="entry-title">
      <h2 id="entry-title">New Prescription</h2>

      <p className="clinical-entry__customer">
        Recording for: <strong>{customer.name}</strong>
      </p>

      <p className="clinical-entry__note">
        Enter the measurements exactly as recorded. Leave optional measurements
        blank when unavailable.
      </p>

      <form className="clinical-entry" onSubmit={handleSubmit} noValidate>
        <div className="clinical-entry__eyes">
          {EYES.map((eye) => (
            <fieldset className="clinical-entry__eye" key={eye.key}>
              <legend>{eye.title}</legend>

              {FIELD_GROUPS.map((group) => (
                <section key={group.key}>
                  <h3>{group.title}</h3>

                  <div className="clinical-entry__fields">
                    {group.fields.map((field) => {
                      const path = `${eye.key}.${group.key}.${field.key}`;
                      const inputId = path.replaceAll('.', '-');
                      const errorId = `${inputId}-error`;

                      return (
                        <div className="clinical-entry__field" key={path}>
                          <label htmlFor={inputId}>{field.label}</label>

                          <input
                            id={inputId}
                            name={path}
                            aria-label={`${eye.title} ${field.label}`}
                            type={field.type}
                            step={field.type === 'number' ? 'any' : undefined}
                            min={field.key === 'axis' ? 0 : undefined}
                            max={field.key === 'axis' ? 180 : undefined}
                            value={values[path]}
                            onChange={handleChange}
                            disabled={locked}
                            aria-invalid={Boolean(errors[path])}
                            aria-describedby={
                              errors[path] ? errorId : undefined
                            }
                          />

                          {errors[path] && (
                            <p
                              className="clinical-entry__field-error"
                              id={errorId}
                            >
                              {errors[path]}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </fieldset>
          ))}
        </div>

        <div className="clinical-entry__remarks">
          <label htmlFor="prescription-remarks">Remarks</label>
          <textarea
            id="prescription-remarks"
            name="remarks"
            rows={4}
            maxLength={1000}
            value={values.remarks}
            onChange={handleChange}
            disabled={locked}
            aria-invalid={Boolean(errors.remarks)}
            aria-describedby={
              errors.remarks ? 'prescription-remarks-error' : undefined
            }
          />

          {errors.remarks && (
            <p
              className="clinical-entry__field-error"
              id="prescription-remarks-error"
            >
              {errors.remarks}
            </p>
          )}
        </div>

        {submitError && (
          <p className="clinical-entry__error" role="alert">
            {submitError}
          </p>
        )}

        {submitting && <p role="status">Saving prescription...</p>}

        {savedPrescription && (
          <div className="clinical-entry__success" role="status">
            <p>Prescription recorded successfully.</p>
            <p>
              A new historical prescription has been created for {customer.name}
              .
            </p>

            <button type="button" onClick={handleRecordAnother}>
              Record Another Prescription
            </button>
          </div>
        )}

        <div className="clinical-entry__actions">
          <button type="submit" disabled={locked}>
            {submitting ? 'Saving...' : 'Record Prescription'}
          </button>
        </div>
      </form>
    </section>
  );
}
