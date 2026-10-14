import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import prescriptionService from '../services/prescription/prescriptionService';
import './PrescriptionHistoryPage.css';

function displayValue(value) {
  return value === null || value === undefined || value === ''
    ? 'Not recorded'
    : String(value);
}

function displayDate(value) {
  if (!value) return 'Date unavailable';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function EyeMeasurements({ title, eye }) {
  const distance = eye?.distance ?? {};
  const reading = eye?.reading ?? {};

  return (
    <section className="prescription-eye" aria-label={title}>
      <h3>{title}</h3>

      <h4>Distance</h4>
      <dl className="prescription-measurements">
        <div>
          <dt>SPH</dt>
          <dd>{displayValue(distance.sph)}</dd>
        </div>
        <div>
          <dt>CYL</dt>
          <dd>{displayValue(distance.cyl)}</dd>
        </div>
        <div>
          <dt>Axis</dt>
          <dd>{displayValue(distance.axis)}</dd>
        </div>
        <div>
          <dt>VA</dt>
          <dd>{displayValue(distance.va)}</dd>
        </div>
      </dl>

      <h4>Reading</h4>
      <dl className="prescription-measurements">
        <div>
          <dt>Add Power</dt>
          <dd>{displayValue(reading.add)}</dd>
        </div>
        <div>
          <dt>Near VA</dt>
          <dd>{displayValue(reading.nearVa)}</dd>
        </div>
      </dl>
    </section>
  );
}

export default function PrescriptionHistoryPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      setLoading(true);
      setErrorMessage('');

      try {
        const history = await prescriptionService.getMyPrescriptions();

        if (active) setPrescriptions(history);
      } catch (error) {
        if (!active) return;

        if (error?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }

        if (error?.status === 403) {
          setErrorMessage(
            'You do not have permission to view this prescription history.',
          );
        } else {
          setErrorMessage(
            'Unable to load your prescription history. Please try again.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHistory();

    return () => {
      active = false;
    };
  }, [logout, navigate, retryCount]);

  return (
    <main className="prescription-history">
      <Link className="prescription-history__back" to="/profile">
        &larr; Back to My Profile
      </Link>

      <header className="prescription-history__header">
        <h1>Prescription History</h1>
        <p>View your previously recorded optical prescriptions.</p>
      </header>

      {loading ? (
        <p role="status">Loading your prescription history...</p>
      ) : errorMessage ? (
        <div className="prescription-history__message" role="alert">
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
          >
            Try Again
          </button>
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="prescription-history__empty" role="status">
          <h2>No prescriptions yet</h2>
          <p>
            Your prescription history will appear here after an Optometrist
            records it.
          </p>
        </div>
      ) : (
        <div className="prescription-history__list">
          {prescriptions.map((prescription, index) => (
            <article
              key={prescription.id ?? index}
              className="prescription-card"
              aria-label={`Prescription ${index + 1}`}
            >
              <header className="prescription-card__header">
                <div>
                  <h2>Prescription {index + 1}</h2>
                  <p>Recorded: {displayDate(prescription.recordedAt)}</p>
                </div>
                {prescription.recordedBy?.name && (
                  <p className="prescription-card__optometrist">
                    Optometrist: {prescription.recordedBy.name}
                  </p>
                )}
              </header>

              <div className="prescription-card__eyes">
                <EyeMeasurements
                  title="Right Eye"
                  eye={prescription.rightEye}
                />
                <EyeMeasurements title="Left Eye" eye={prescription.leftEye} />
              </div>

              <section className="prescription-card__remarks">
                <h3>Remarks</h3>
                <p>{prescription.remarks || 'No remarks recorded.'}</p>
              </section>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
