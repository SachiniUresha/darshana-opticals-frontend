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
