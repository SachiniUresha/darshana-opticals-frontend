import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import './AppLayout.css';

// Base application shell: Navbar + main content area + Footer.
// Page content is rendered via the nested route <Outlet />.
function AppLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
      <ChatbotWidget />
    </div>
  );
}

export default AppLayout;
