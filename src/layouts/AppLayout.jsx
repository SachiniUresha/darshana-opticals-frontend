import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import AdminSidebar from '../components/admin/AdminSidebar';
import Footer from '../components/common/Footer';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import useAuth from '../hooks/useAuth';
import { SYSTEM_ADMIN } from '../config/roles';
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

  return (
    <div
      className={isAdminWorkspace ? 'app-shell app-shell--admin' : 'app-shell'}
    >
      {isAdminWorkspace ? <AdminSidebar /> : <Navbar />}
      <main
        className={isAdminWorkspace ? 'app-main app-main--admin' : 'app-main'}
      >
        <Outlet />
      </main>
      {!isAdminWorkspace ? <Footer /> : null}
      {!isAdminWorkspace ? <ChatbotWidget /> : null}
    </div>
  );
}

export default AppLayout;
