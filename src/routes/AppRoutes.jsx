import { Routes, Route } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import HomePage from '../pages/HomePage';
import SignupPage from '../pages/SignupPage';
import LoginPage from '../pages/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import ProductsPage from '../pages/ProductsPage';
import ProductDetailPage from '../pages/ProductDetailPage';
import ProfilePage from '../pages/ProfilePage';
import PrescriptionHistoryPage from '../pages/PrescriptionHistoryPage';
import ProtectedRoute from './ProtectedRoute';
import { CUSTOMER, OPTOMETRIST } from '../config/roles';
import OptometristPrescriptionPage from '../pages/OptometristPrescriptionPage';
import OrderHistoryPage from '../pages/OrderHistoryPage';
import OrderDetailsPage from '../pages/OrderDetailsPage';
import CartPage from '../pages/CartPage';
import CheckoutEntryPage from '../pages/CheckoutEntryPage';
import AppointmentBookingPage from '../pages/AppointmentBookingPage';
import AppointmentHistoryPage from '../pages/AppointmentHistoryPage';
import AppointmentDetailsPage from '../pages/AppointmentDetailsPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />

        <Route element={<ProtectedRoute allowedRoles={[CUSTOMER]} />}>
          <Route path="/profile" element={<ProfilePage />} />

          <Route
            path="/profile/prescriptions"
            element={<PrescriptionHistoryPage />}
          />

          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutEntryPage />} />

          <Route path="/orders" element={<OrderHistoryPage />} />
          <Route path="/orders/:id" element={<OrderDetailsPage />} />

          <Route path="/appointments" element={<AppointmentHistoryPage />} />

          <Route
            path="/appointments/book"
            element={<AppointmentBookingPage />}
          />

          <Route
            path="/appointments/:id"
            element={<AppointmentDetailsPage />}
          />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[OPTOMETRIST]} />}>
          <Route
            path="/clinical/prescriptions/new"
            element={<OptometristPrescriptionPage />}
          />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
