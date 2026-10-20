import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import {
  listManagedDoctors,
  updateDoctorDetails,
  updateDoctorStatus,
} from '../services/doctorAdminService';
import './AdminDashboardPage.css';
import './AdminDoctorManagementPage.css';

function activeState(doctor) {
  if (doctor.isActive === true) return 'Active';
  if (doctor.isActive === false) return 'Inactive';
  return 'Unavailable';
}

function messageFor(error, action) {
  if (error?.status === 403) return `You do not have permission to ${action}.`;
  if (error?.status === 404) {
    return action === 'view doctors'
      ? 'Doctor management is unavailable until the backend is updated.'
      : 'The Doctor record or management endpoint is unavailable.';
  }
  if (error?.status === 409) {
    return 'The change conflicts with existing Doctor sessions or management rules. Review the record before retrying.';
  }
  if (error?.status === 400 || error?.status === 422) {
    return 'The server rejected the details. Please review the entered information.';
  }
  if (error?.status === 0)
    return 'Unable to reach the server. Please try again.';
  return `Unable to ${action}. Please try again.`;
}

function DoctorEditor({ doctor, busy, error, onCancel, onSave }) {
  const [name, setName] = useState(doctor.name);
  const [specialization, setSpecialization] = useState(doctor.specialization);
  const [validation, setValidation] = useState('');

  function submit(event) {
    event.preventDefault();
    const nextName = name.trim();
    const nextSpecialization = specialization.trim();
    if (
      !nextName ||
      !nextSpecialization ||
      [...nextName].length > 100 ||
      [...nextSpecialization].length > 100
    ) {
      setValidation(
        'Doctor name and specialization are required (maximum 100 characters each).',
      );
      return;
    }
    if (
      nextName === doctor.name &&
      nextSpecialization === doctor.specialization
    ) {
      setValidation('No changes to save.');
      return;
    }
    setValidation('');
    onSave(doctor.id, { name: nextName, specialization: nextSpecialization });
  }

  return (
    <section
      className="doctor-management__editor"
      aria-label={`Edit ${doctor.name}`}
    >
      <h3>Edit Doctor</h3>
      <p>Changes to Doctor details do not delete historical appointments.</p>
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <div className="doctor-management__fields">
          <div>
            <label htmlFor="managed-doctor-name">Doctor Name</label>
            <input
              id="managed-doctor-name"
              type="text"
              maxLength={100}
              value={name}
              disabled={busy}
              onChange={(event) => {
                setName(event.target.value);
                setValidation('');
              }}
              required
            />
          </div>
          <div>
            <label htmlFor="managed-doctor-specialization">
              Specialization
            </label>
            <input
              id="managed-doctor-specialization"
              type="text"
              maxLength={100}
              value={specialization}
              disabled={busy}
              onChange={(event) => {
                setSpecialization(event.target.value);
                setValidation('');
              }}
              required
            />
          </div>
        </div>
        {validation && <p role="alert">{validation}</p>}
        {error && <p role="alert">{error}</p>}
        <div className="doctor-management__buttons">
          <button type="submit" disabled={busy}>
            {busy ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

export default function AdminDoctorManagementPage() {
  useDocumentTitle('Doctor Management | Darshana Opticals');
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusTab, setStatusTab] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const activeFilter = statusTab === 'active';
  const search = searchTerm.trim();
  const [list, setList] = useState({ status: 'loading', doctors: [] });
  const [editing, setEditing] = useState(null);
  const [mutation, setMutation] = useState(null);
  const [mutationError, setMutationError] = useState('');
  const [notice, setNotice] = useState('');
  const busyRef = useRef(false);

  useEffect(() => {
    if (editing) {
      document.querySelector('.doctor-management__editor')?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [editing]);

  useEffect(() => {
    let alive = true;
    setList({ status: 'loading', doctors: [] });
    listManagedDoctors({ isActive: activeFilter, search })
      .then((doctors) => {
        if (alive) setList({ status: 'success', doctors });
      })
      .catch((error) => {
        if (!alive) return;
        if (error?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        setList({
          status: 'error',
          doctors: [],
          error: messageFor(error, 'view doctors'),
        });
      });
    return () => {
      alive = false;
    };
  }, [refreshKey, activeFilter, search, logout, navigate]);

  async function runMutation(action, successMessage, request) {
    if (busyRef.current) return;
    busyRef.current = true;
    setMutation(action);
    setMutationError('');
    setNotice('');
    try {
      await request();
      setEditing(null);
      setNotice(successMessage);
      setRefreshKey((count) => count + 1);
    } catch (error) {
      if (error?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      setMutationError(messageFor(error, 'update this Doctor'));
    } finally {
      busyRef.current = false;
      setMutation(null);
    }
  }

  function saveDetails(id, fields) {
    void runMutation('edit', 'Doctor details updated successfully.', () =>
      updateDoctorDetails(id, fields),
    );
  }

  function changeStatus(doctor) {
    if (busyRef.current || editing || typeof doctor.isActive !== 'boolean')
      return;
    const makeActive = !doctor.isActive;
    if (
      !makeActive &&
      !window.confirm(
        `Deactivate ${doctor.name}? They will not be eligible for new Doctor Sessions. Existing appointments are not automatically cancelled.`,
      )
    )
      return;
    void runMutation(
      `status-${doctor.id}`,
      makeActive
        ? 'Doctor activated successfully.'
        : 'Doctor deactivated successfully.',
      () => updateDoctorStatus(doctor.id, makeActive),
    );
  }

  return (
    <div className="admin-page doctor-management">
      <header className="admin-page__hero">
        <p className="admin-page__eyebrow">DOCTOR MANAGEMENT</p>
        <h1>Doctor Management</h1>
        <p>
          View Doctors, update approved details, and manage scheduling
          eligibility.
        </p>
      </header>
      <section
        className="admin-page__section"
        aria-labelledby="doctor-management-heading"
      >
        <div className="doctor-management__heading">
          <div className="admin-page__section-title">
            <h2 id="doctor-management-heading">Doctors</h2>
          </div>
          <Link className="admin-page__action" to="/admin/doctors/new">
            Add Doctor
          </Link>
        </div>
        {editing && list.status === 'success' && (
          <DoctorEditor
            key={editing.id}
            doctor={editing}
            busy={Boolean(mutation)}
            error={mutationError}
            onCancel={() => {
              setEditing(null);
              setMutationError('');
            }}
            onSave={saveDetails}
          />
        )}
        <div className="doctor-management__tools">
          <div
            className="doctor-management__tabs"
            role="group"
            aria-label="Doctor account status"
          >
            <button
              type="button"
              aria-pressed={statusTab === 'active'}
              onClick={() => {
                setStatusTab('active');
                setEditing(null);
                setMutationError('');
                setNotice('');
              }}
            >
              Active Doctors
            </button>
            <button
              type="button"
              aria-pressed={statusTab === 'inactive'}
              onClick={() => {
                setStatusTab('inactive');
                setEditing(null);
                setMutationError('');
                setNotice('');
              }}
            >
              Inactive Doctors
            </button>
          </div>
          <div className="doctor-management__search">
            <label htmlFor="admin-doctor-search">Search doctors</label>
            <input
              id="admin-doctor-search"
              type="search"
              value={searchTerm}
              placeholder="Search name or specialization in both tabs"
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setEditing(null);
              }}
            />
          </div>
        </div>
        {notice && (
          <p role="status" className="doctor-management__notice">
            {notice}
          </p>
        )}
        {mutationError && !editing && <p role="alert">{mutationError}</p>}
        {list.status === 'loading' ? (
          <p role="status">Loading Doctors...</p>
        ) : list.status === 'error' ? (
          <div className="doctor-management__feedback" role="alert">
            <p>{list.error}</p>
            <button
              type="button"
              onClick={() => setRefreshKey((count) => count + 1)}
            >
              Try again
            </button>
          </div>
        ) : list.doctors.length === 0 ? (
          <p role="status" className="doctor-management__feedback">
            No Doctors found.
          </p>
        ) : (
          <div
            className="doctor-management__table-wrap"
            role="region"
            aria-label="Doctor directory table"
            tabIndex={0}
          >
            <table className="doctor-management__table">
              <caption>Existing Doctor records</caption>
              <thead>
                <tr>
                  <th scope="col">Doctor name</th>
                  <th scope="col">Specialization</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.doctors.map((doctor) => (
                  <tr key={doctor.id}>
                    <th scope="row">{doctor.name}</th>
                    <td>{doctor.specialization}</td>
                    <td>
                      <span className="doctor-management__status">
                        {activeState(doctor)}
                      </span>
                    </td>
                    <td>
                      <div className="doctor-management__buttons">
                        <button
                          type="button"
                          disabled={Boolean(mutation) || Boolean(editing)}
                          onClick={() => {
                            setEditing(doctor);
                            setMutationError('');
                            setNotice('');
                          }}
                          aria-label={`Edit ${doctor.name}`}
                        >
                          Edit
                        </button>
                        {typeof doctor.isActive === 'boolean' && (
                          <button
                            type="button"
                            disabled={Boolean(mutation) || Boolean(editing)}
                            onClick={() => changeStatus(doctor)}
                            aria-label={`${doctor.isActive ? 'Deactivate' : 'Activate'} ${doctor.name}`}
                          >
                            {mutation === `status-${doctor.id}`
                              ? 'Updating...'
                              : doctor.isActive
                                ? 'Deactivate'
                                : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.status === 'success' && !editing && (
          <button
            type="button"
            className="doctor-management__refresh"
            disabled={Boolean(mutation)}
            onClick={() => {
              setNotice('');
              setRefreshKey((count) => count + 1);
            }}
          >
            Refresh Doctors
          </button>
        )}
      </section>
    </div>
  );
}
