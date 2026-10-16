import { Link } from 'react-router-dom';
import useDocumentTitle from '../hooks/useDocumentTitle';
import './AdminDashboardPage.css';

const creationActions = [
  {
    title: 'Add Staff Member',
    description: 'Create a secure staff account with an approved designation and optional branch.',
    path: '/admin/staff/new',
    cta: 'Add Staff',
    icon: '01',
  },
  {
    title: 'Add Doctor',
    description: 'Register an external Doctor for appointment sessions without creating a login.',
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
            <p>Manage approved staff access and register doctors for the appointment service.</p>
          </div>
          <span className="admin-page__access-badge">System Admin Access</span>
        </div>
      </header>

      <section className="admin-page__section" aria-labelledby="admin-create-heading">
        <div className="admin-page__section-title">
          <h2 id="admin-create-heading">Quick actions</h2>
          <p>Select a creation workflow below.</p>
        </div>
        <div className="admin-page__cards">
          {creationActions.map(({ title, description, path, cta, icon }) => (
            <article className="admin-page__card" key={path}>
              <span className="admin-page__card-icon" aria-hidden="true">{icon}</span>
              <h3>{title}</h3>
              <p>{description}</p>
              <Link className="admin-page__action" to={path}>{cta} <span aria-hidden="true">&rarr;</span></Link>
            </article>
          ))}
        </div>
      </section>

      <p className="admin-page__note">
        Doctors are appointment providers, not OSMS login users. Staff permissions are determined by their assigned role.
      </p>
    </div>
  );
}

export default AdminDashboardPage;