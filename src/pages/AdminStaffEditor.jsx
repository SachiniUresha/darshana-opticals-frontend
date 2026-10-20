import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BranchSelect from '../components/common/BranchSelect';
import useAuth from '../hooks/useAuth';
import { BRANCH_ASSISTANT, BRANCH_MANAGER, OPTOMETRIST } from '../config/roles';
import {
  getStaffMember,
  updateStaffProfile,
  updateStaffRole,
  reassignStaffBranch,
} from '../services/staffAdminService';
import './AdminStaffEditor.css';

const ROLES = [
  { value: BRANCH_MANAGER, label: 'Branch Manager' },
  { value: BRANCH_ASSISTANT, label: 'Branch Assistant' },
  { value: OPTOMETRIST, label: 'Optometrist' },
];

function profileFrom(staff) {
  return {
    name: staff.name || '',
    email: staff.email || '',
    phone: staff.phone || '',
    address: staff.address || '',
  };
}

function validateProfile(profile) {
  const errors = {};
  const name = profile.name.trim();
  const phone = profile.phone.trim();
  const digits = phone.match(/[0-9]/g)?.length ?? 0;
  if (
    [...name].length < 2 ||
    [...name].length > 100 ||
    !/^[\p{L}\p{M} .'-]+$/u.test(name) ||
    !/\p{L}/u.test(name)
  ) {
    errors.name = 'Enter a valid name (2-100 alphabetic characters).';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) {
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
  if (profile.address.trim().length < 5) {
    errors.address = 'Enter an address of at least 5 characters.';
  }
  return errors;
}

function safeError(error) {
  if (error?.status === 403)
    return 'You do not have permission to manage this staff member.';
  if (error?.status === 404)
    return 'The staff record or management endpoint is unavailable.';
  if (error?.status === 409)
    return 'This change conflicts with an existing account or assignment.';
  if (error?.status === 400 || error?.status === 422)
    return 'The change was rejected. Please check the information and try again.';
  return 'Unable to save the staff change. Please try again.';
}

function Field({ name, label, value, onChange, error, ...inputProps }) {
  const id = `edit-staff-${name}`;
  return (
    <div className="staff-editor__field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...inputProps}
      />
      {error && (
        <p role="alert" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function AdminStaffEditor({
  staffId,
  branches,
  onClose,
  onUpdated,
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [load, setLoad] = useState({ status: 'loading', record: null });
  const [retry, setRetry] = useState(0);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState('');
  const [branchId, setBranchId] = useState('');
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState('');

  useEffect(() => {
    let active = true;
    setLoad({ status: 'loading', record: null });
    setProfile(null);
    setErrors({});
    setNotice('');
    getStaffMember(staffId)
      .then((record) => {
        if (!active) return;
        setLoad({ status: 'success', record });
        setProfile(profileFrom(record));
        setRole(record.role || '');
        setBranchId(record.branchId || '');
      })
      .catch((error) => {
        if (!active) return;
        if (error?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        setLoad({ status: 'error', message: safeError(error), record: null });
      });
    return () => {
      active = false;
    };
  }, [staffId, retry, logout, navigate]);

  const record = load.record;
  const selectedBranch =
    branchId === '' || branches.some((branch) => branch.id === branchId);

  async function perform(action, operation) {
    if (saving) return;
    setNotice('');
    setSaving(action);
    try {
      await operation();
      onUpdated();
    } catch (error) {
      if (error?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      setNotice(safeError(error));
    } finally {
      setSaving('');
    }
  }

  function saveProfile(event) {
    event.preventDefault();
    if (!record || !profile || saving) return;
    const next = Object.fromEntries(
      Object.entries(profile).map(([key, value]) => [key, value.trim()]),
    );
    const found = validateProfile(next);
    setErrors(found);
    if (Object.keys(found).length) return;
    const previous = profileFrom(record);
    if (Object.keys(next).every((key) => next[key] === previous[key])) {
      setNotice('No profile changes to save.');
      return;
    }
    void perform('profile', () => updateStaffProfile(staffId, next));
  }

  function saveRole(event) {
    event.preventDefault();
    if (!record || saving) return;
    if (!ROLES.some((entry) => entry.value === role)) {
      setNotice('Choose an approved staff role.');
      return;
    }
    if (role === record.role) {
      setNotice('No role changes to save.');
      return;
    }
    if (
      !window.confirm(
        "Change this staff member's role? This may change their system access.",
      )
    )
      return;
    void perform('role', () => updateStaffRole(staffId, role));
  }

  function saveBranch(event) {
    event.preventDefault();
    if (!record || saving) return;
    if (!selectedBranch) {
      setNotice('Choose an existing branch before reassigning.');
      return;
    }
    if (branchId === (record.branchId || '')) {
      setNotice('No branch changes to save.');
      return;
    }
    if (
      !window.confirm(
        'Reassign this staff member to the selected branch? Their access may change.',
      )
    )
      return;
    void perform('branch', () =>
      reassignStaffBranch(staffId, branchId || null),
    );
  }

  return (
    <section className="staff-editor" aria-label="Edit staff member">
      <div className="staff-editor__heading">
        <div>
          <h3>Edit staff member</h3>
          <p>
            Update an existing staff account. Historical records are preserved
            by the backend.
          </p>
        </div>
        <button type="button" onClick={onClose} disabled={Boolean(saving)}>
          Close editor
        </button>
      </div>
      {load.status === 'loading' ? (
        <p role="status">Loading staff details...</p>
      ) : load.status === 'error' ? (
        <div role="alert">
          <p>{load.message}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Retry details
          </button>
        </div>
      ) : record && profile ? (
        <>
          <p className="staff-editor__identity">
            Editing: <strong>{record.name}</strong>
          </p>
          <div className="staff-editor__forms">
            <form
              onSubmit={saveProfile}
              noValidate
              aria-label="Edit staff details"
            >
              <h4>Personal and contact details</h4>
              <Field
                name="name"
                label="Full name"
                value={profile.name}
                error={errors.name}
                onChange={(value) =>
                  setProfile((current) => ({ ...current, name: value }))
                }
              />
              <Field
                name="email"
                label="Email address"
                type="email"
                value={profile.email}
                error={errors.email}
                onChange={(value) =>
                  setProfile((current) => ({ ...current, email: value }))
                }
              />
              <Field
                name="phone"
                label="Phone number"
                type="tel"
                value={profile.phone}
                error={errors.phone}
                onChange={(value) =>
                  setProfile((current) => ({ ...current, phone: value }))
                }
              />
              <div className="staff-editor__field">
                <label htmlFor="edit-staff-address">Address</label>
                <textarea
                  id="edit-staff-address"
                  rows={2}
                  value={profile.address}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
                  }
                  aria-invalid={Boolean(errors.address)}
                  aria-describedby={
                    errors.address ? 'edit-staff-address-error' : undefined
                  }
                />
                {errors.address && (
                  <p role="alert" id="edit-staff-address-error">
                    {errors.address}
                  </p>
                )}
              </div>
              <button type="submit" disabled={Boolean(saving)}>
                {saving === 'profile' ? 'Saving...' : 'Save details'}
              </button>
            </form>
            <form onSubmit={saveRole} aria-label="Change staff role">
              <h4>Role management</h4>
              <p>Changing a role can change access permissions.</p>
              <label htmlFor="edit-staff-role">Role</label>
              <select
                id="edit-staff-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                {!ROLES.some((entry) => entry.value === role) && (
                  <option value="">Select approved role</option>
                )}
                {ROLES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={Boolean(saving)}>
                {saving === 'role' ? 'Saving...' : 'Change role'}
              </button>
            </form>
            <form onSubmit={saveBranch} aria-label="Reassign staff branch">
              <h4>Branch assignment</h4>
              <p>
                Historical orders and prescriptions remain linked to their
                original branches.
              </p>
              <BranchSelect
                id="edit-staff-branch"
                label="Assign branch"
                value={branchId}
                branches={branches}
                onChange={setBranchId}
                disabled={Boolean(saving)}
                placeholder="No branch assignment"
              />
              <button
                type="submit"
                disabled={Boolean(saving) || branches.length === 0}
              >
                {saving === 'branch' ? 'Saving...' : 'Reassign branch'}
              </button>
            </form>
          </div>
          {notice && (
            <p role="alert" className="staff-editor__notice">
              {notice}
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
