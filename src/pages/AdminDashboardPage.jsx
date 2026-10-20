import { Link } from 'react-router-dom';
import useDocumentTitle from '../hooks/useDocumentTitle';
import './AdminDashboardPage.css';

const creationActions = [
  {
    title: 'Add Staff Member',
    description: 'Create a new staff account.',
    path: '/admin/staff/new',
    cta: 'Add Staff',
    icon: '01',
  },
  {
    title: 'Add Doctor',
    description: 'Add a new doctor.',
    path: '/admin/doctors/new',
    cta: 'Add Doctor',
    icon: '02',
  },
];

function AdminDashboardPage() {
  useDocumentTitle('Admin Dashboard | Darshana Opticals');

  return (
    <div className="admin-page">
      <header className="admin-page__hero">
        <p className="admin-page__eyebrow">TEAM &amp; ACCESS MANAGEMENT</p>
        <div className="admin-page__heading-row">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Manage staff members and doctors.</p>
          </div>
          <span className="admin-page__access-badge">System Admin Access</span>
        </div>
      </header>

      <section
        className="admin-page__section"
        aria-labelledby="admin-create-heading"
      >
        <div className="admin-page__section-title">
          <h2 id="admin-create-heading">Quick actions</h2>
          <p>Select a creation workflow below.</p>
        </div>
        <div className="admin-page__cards">
          {creationActions.map(({ title, description, path, cta, icon }) => (
            <article className="admin-page__card" key={path}>
              <span className="admin-page__card-icon" aria-hidden="true">
                {icon}
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
              <Link className="admin-page__action" to={path}>
                {cta} <span aria-hidden="true">&rarr;</span>
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section
        className="admin-page__section"
        aria-labelledby="admin-manage-heading"
      >
        <div className="admin-page__section-title">
          <h2 id="admin-manage-heading">Management</h2>
          <p>View and maintain existing Staff and Doctor records.</p>
        </div>
        <div className="admin-page__cards">
          <article className="admin-page__card">
            <span className="admin-page__card-icon" aria-hidden="true">
              03
            </span>
            <h3>Staff Management</h3>
            <p>View staff, edit details, and manage roles and status.</p>
            <Link className="admin-page__action" to="/admin/staff">
              Manage Staff
            </Link>
          </article>
          <article className="admin-page__card">
            <span className="admin-page__card-icon" aria-hidden="true">
              04
            </span>
            <h3>Doctor Management</h3>
            <p>View doctors, edit details, and manage active status.</p>
            <Link className="admin-page__action" to="/admin/doctors">
              Manage Doctors
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}

export default AdminDashboardPage;
