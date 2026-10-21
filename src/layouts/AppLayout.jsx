import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import AdminSidebar from '../components/admin/AdminSidebar';
import RoleSidebar from '../components/staff/RoleSidebar';
import Footer from '../components/common/Footer';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import useAuth from '../hooks/useAuth';
import {
  SYSTEM_ADMIN,
  BRANCH_MANAGER,
  BRANCH_ASSISTANT,
  OPTOMETRIST,
} from '../config/roles';
import './AppLayout.css';

// Base application shell: Navbar + main content area + Footer.
// Page content is rendered via the nested route <Outlet />.
function AppLayout() {
  const { isAuthenticated, user } = useAuth();
  const { pathname } = useLocation();

  const isAdminWorkspace =
    isAuthenticated &&
    user?.role === SYSTEM_ADMIN &&
    (pathname === '/admin' || pathname.startsWith('/admin/'));

  const isRoleWorkspace =
    isAuthenticated &&
    (((user?.role === BRANCH_MANAGER || user?.role === BRANCH_ASSISTANT) &&
      pathname.startsWith('/staff/')) ||
      (user?.role === OPTOMETRIST && pathname.startsWith('/clinical/')));

  const isCustomerAppointmentPage =
    pathname === '/appointments' || pathname === '/appointments/book';

  return (
    <div
      className={
        isAdminWorkspace
          ? 'app-shell app-shell--admin'
          : isRoleWorkspace
            ? 'app-shell app-shell--role'
            : 'app-shell'
      }
    >
      {isAdminWorkspace ? (
        <AdminSidebar />
      ) : isRoleWorkspace ? (
        <RoleSidebar />
      ) : (
        <Navbar />
      )}

      <main
        className={
          isAdminWorkspace
            ? 'app-main app-main--admin'
            : isRoleWorkspace
              ? 'app-main app-main--role'
              : isCustomerAppointmentPage
                ? 'app-main app-main--customer-appointments'
                : 'app-main'
        }
      >
        <Outlet />
      </main>

      {!isAdminWorkspace ? <Footer /> : null}
      {!isAdminWorkspace ? <ChatbotWidget /> : null}
    </div>
  );
}

export default AppLayout;
