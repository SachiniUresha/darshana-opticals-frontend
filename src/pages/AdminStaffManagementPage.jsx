import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import useDocumentTitle from '../hooks/useDocumentTitle';
import {
  listStaffMembers,
  updateStaffStatus,
} from '../services/staffAdminService';
import AdminStaffEditor from './AdminStaffEditor';
import './AdminDashboardPage.css';
import './AdminStaffManagementPage.css';

const PAGE_SIZE = 20;
const ROLE_LABELS = {
  BRANCH_MANAGER: 'Branch Manager',
  BRANCH_ASSISTANT: 'Branch Assistant',
  OPTOMETRIST: 'Optometrist',
};

function staffStatus(staff) {
  const active =
    typeof staff.isActive === 'boolean' ? staff.isActive : staff.active;
  if (active === true) return 'Active';
  if (active === false) return 'Inactive';
  return 'Unavailable';
}

function branchName(staff, branches) {
  if (!staff.branchId) return 'Not assigned';
  const branch = branches.find((item) => item.id === staff.branchId);
  return branch?.address || 'Assigned branch unavailable';
}

function safeError(error) {
  if (error?.status === 403)
    return 'You do not have permission to view staff members.';
  if (error?.status === 404)
    return 'The staff directory is not available yet. Please try again after the backend update.';
  return 'Unable to load staff members. Please try again.';
}

export default function AdminStaffManagementPage() {
  useDocumentTitle('Staff Management | Darshana Opticals');
  const { logout } = useAuth();
  const navigate = useNavigate();
  const {
    branches,
    loading: branchesLoading,
    error: branchesError,
    retry: retryBranches,
    unauthorized: branchesUnauthorized,
  } = useBranches();
  const [page, setPage] = useState(1);
  const [statusTab, setStatusTab] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [statusBusy, setStatusBusy] = useState(null);
  const [statusFeedback, setStatusFeedback] = useState(null);
  const [retry, setRetry] = useState(0);
  const [loadState, setLoadState] = useState({ key: '', status: 'loading' });
  const activeFilter = statusTab === 'active';
  const search = searchTerm.trim();
  const requestKey = `${page}:${retry}:${statusTab}:${search}`;
  const current =
    loadState.key === requestKey ? loadState : { status: 'loading' };

  useEffect(() => {
    if (branchesUnauthorized) {
      logout();
      navigate('/login', { replace: true });
    }
  }, [branchesUnauthorized, logout, navigate]);

  useEffect(() => {
    let active = true;
    setLoadState({ key: requestKey, status: 'loading' });
    listStaffMembers({ page, limit: PAGE_SIZE, isActive: activeFilter, search })
      .then((data) => {
        if (active) setLoadState({ key: requestKey, status: 'success', data });
      })
      .catch((error) => {
        if (!active) return;
        if (error?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        setLoadState({
          key: requestKey,
          status: 'error',
          message: safeError(error),
        });
      });
    return () => {
      active = false;
    };
  }, [page, retry, requestKey, activeFilter, search, logout, navigate]);

  async function changeStaffStatus(member) {
    if (statusBusy || selectedStaff || !member?.id) return;
    const status = staffStatus(member);
    if (status === 'Unavailable') return;

    const nextActive = status === 'Inactive';
    if (
      !nextActive &&
      !window.confirm(
        `Deactivate ${member.name || 'this staff member'}? This will restrict their account access. Existing business records will be preserved.`,
      )
    ) {
      return;
    }

    setStatusBusy(member.id);
    setStatusFeedback(null);
    try {
      await updateStaffStatus(member.id, nextActive);
      setSelectedStaff(null);
      setStatusFeedback({
        type: 'success',
        message: nextActive
          ? 'Staff account activated successfully.'
          : 'Staff account deactivated successfully.',
      });
      setRetry((count) => count + 1);
    } catch (error) {
      if (error?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      let message = 'Unable to update staff account status. Please try again.';
      if (error?.status === 403) {
        message = 'You do not have permission to update this staff account.';
      } else if (error?.status === 404) {
        message = 'The staff record or management endpoint is unavailable.';
      } else if (error?.status === 409) {
        message =
          'This staff account cannot be changed due to a management restriction or conflict.';
      } else if (error?.status === 400 || error?.status === 422) {
        message =
          'The status change was rejected. Please review the account and try again.';
      }
      setStatusFeedback({ type: 'error', message });
    } finally {
      setStatusBusy(null);
    }
  }
  const staff = current.data?.staff ?? [];
  const selectedMember = staff.find((member) => member.id === selectedStaff);

  useEffect(() => {
    if (selectedStaff) {
      document.querySelector('.staff-editor')?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [selectedStaff]);
  const totalPages = current.data?.pagination?.totalPages;
  const paginated = Number.isInteger(totalPages) && totalPages > 0;

  return (
    <div className="admin-page staff-management">
      <header className="admin-page__hero">
        <p className="admin-page__eyebrow">TEAM &amp; ACCESS MANAGEMENT</p>
        <h1>Staff Management</h1>
        <p>Review existing staff, assigned branches, and account status.</p>
      </header>
      <section
        className="admin-page__section"
        aria-labelledby="staff-management-heading"
      >
        <div className="staff-management__heading">
          <div className="admin-page__section-title">
            <h2 id="staff-management-heading">Staff members</h2>
          </div>
          <Link className="admin-page__action" to="/admin/staff/new">
            Add Staff Member
          </Link>
        </div>
        {!branchesUnauthorized && branchesLoading && (
          <p
            className="staff-management__feedback"
            role="status"
            aria-label="Branch lookup status"
          >
            Loading branch details...
          </p>
        )}
        {!branchesUnauthorized && !branchesLoading && branchesError && (
          <div
            className="staff-management__feedback"
            role="alert"
            aria-label="Branch lookup failed"
          >
            <p>{branchesError}</p>
            <button type="button" onClick={retryBranches}>
              Retry branches
            </button>
          </div>
        )}
        {selectedMember && (
          <AdminStaffEditor
            key={selectedMember.id}
            staffId={selectedMember.id}
            branches={branches}
            onClose={() => setSelectedStaff(null)}
            onUpdated={() => {
              setSelectedStaff(null);
              setRetry((count) => count + 1);
            }}
          />
        )}
        <div className="staff-management__tools">
          <div
            className="staff-management__tabs"
            role="group"
            aria-label="Staff account status"
          >
            <button
              type="button"
              aria-pressed={statusTab === 'active'}
              onClick={() => {
                setStatusTab('active');
                setPage(1);
                setSelectedStaff(null);
                setStatusFeedback(null);
              }}
            >
              Active Staff
            </button>
            <button
              type="button"
              aria-pressed={statusTab === 'inactive'}
              onClick={() => {
                setStatusTab('inactive');
                setPage(1);
                setSelectedStaff(null);
                setStatusFeedback(null);
              }}
            >
              Inactive Staff
            </button>
          </div>
          <div className="staff-management__search">
            <label htmlFor="admin-staff-search">Search staff</label>
            <input
              id="admin-staff-search"
              type="search"
              value={searchTerm}
              placeholder="Search name or email in both tabs"
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
                setSelectedStaff(null);
              }}
            />
          </div>
        </div>
        {statusFeedback && (
          <p
            className="staff-management__feedback"
            role={statusFeedback.type === 'error' ? 'alert' : 'status'}
          >
            {statusFeedback.message}
          </p>
        )}
        {current.status === 'loading' ? (
          <p role="status">Loading staff members...</p>
        ) : current.status === 'error' ? (
          <div className="staff-management__feedback" role="alert">
            <p>{current.message}</p>
            {current.message !==
              'You do not have permission to view staff members.' && (
              <button
                type="button"
                onClick={() => setRetry((count) => count + 1)}
              >
                Try again
              </button>
            )}
          </div>
        ) : staff.length === 0 ? (
          <p role="status" className="staff-management__feedback">
            No staff members found.
          </p>
        ) : (
          <div
            className="staff-management__table-wrap"
            role="region"
            aria-label="Staff directory table"
            tabIndex={0}
          >
            <table className="staff-management__table">
              <caption>Existing staff accounts</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Assigned branch</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id}>
                    <th scope="row">{member.name || 'Unavailable'}</th>
                    <td>{member.email || 'Unavailable'}</td>
                    <td>{ROLE_LABELS[member.role] || 'Unavailable'}</td>
                    <td>{branchName(member, branches)}</td>
                    <td>
                      <span className="staff-management__status">
                        {staffStatus(member)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="staff-management__edit"
                        onClick={() => setSelectedStaff(member.id)}
                        aria-label={`Edit ${member.name || 'staff member'}`}
                      >
                        Edit
                      </button>
                      {staffStatus(member) !== 'Unavailable' && (
                        <button
                          type="button"
                          className="staff-management__status-action"
                          disabled={
                            Boolean(statusBusy) || Boolean(selectedStaff)
                          }
                          onClick={() => void changeStaffStatus(member)}
                          aria-label={`${staffStatus(member) === 'Active' ? 'Deactivate' : 'Activate'} ${member.name || 'staff member'}`}
                        >
                          {statusBusy === member.id
                            ? 'Updating...'
                            : staffStatus(member) === 'Active'
                              ? 'Deactivate'
                              : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {current.status === 'success' && paginated && (
          <nav
            className="staff-management__pagination"
            aria-label="Staff list pages"
          >
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((n) => Math.max(1, n - 1))}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((n) => n + 1)}
            >
              Next
            </button>
          </nav>
        )}
        <p className="staff-management__note">
          Deactivating a staff account restricts system access. Historical
          records remain preserved.
        </p>
      </section>
    </div>
  );
}
