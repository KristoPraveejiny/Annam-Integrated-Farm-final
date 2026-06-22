import { Navigate, Route, Routes } from 'react-router-dom';
import { publicNavItems, roleDashboards } from './data/mock';
import AIAdvisoryPage from './pages/AIAdvisoryPage';
import DashboardPage from './pages/dashboards/DashboardPage';
import AboutPage from './pages/AboutPage';
import DiseaseDetectionPage from './pages/DiseaseDetectionPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import LandingPage from './pages/LandingPage';
import LivestockManagementPage from './pages/LivestockManagementPage';
import LoginPage from './pages/auth/LoginPage';
import MarketplacePage from './pages/MarketplacePage';
import NotificationsPage from './pages/NotificationsPage';
import OtpVerificationPage from './pages/auth/OtpVerificationPage';
import RegisterPage from './pages/auth/RegisterPage';
import ReportsAnalyticsPage from './pages/ReportsAnalyticsPage';
import WorkforceManagementPage from './pages/WorkforceManagementPage';
import { AppShell } from './components/layout/AppShell';
import FarmManagerCropsPage from './pages/dashboards/FarmManagerCropsPage';
import FarmManagerLivestockPage from './pages/dashboards/FarmManagerLivestockPage';
import FarmManagerWorkforcePage from './pages/dashboards/FarmManagerWorkforcePage';
import FarmManagerTasksPage from './pages/dashboards/FarmManagerTasksPage';
import FarmerTasksPage from './pages/dashboards/FarmerTasksPage';
import FarmerCropUpdatesPage from './pages/dashboards/FarmerCropUpdatesPage';
import FarmerLivestockPage from './pages/dashboards/FarmerLivestockPage';
import FarmerLivestockUpdatesPage from './pages/dashboards/FarmerLivestockUpdatesPage';
import FieldManagementPage from './pages/FarmManager/FieldManagementPage';
import FieldDetailsPage from './pages/FarmManager/FieldDetailsPage';


import FarmerAttendancePage from './pages/dashboards/FarmerAttendancePage';
import FarmerProfilePage from './pages/dashboards/FarmerProfilePage';
import RecentFarmerUpdatesPage from './pages/dashboards/RecentFarmerUpdatesPage';
import SalaryApprovalPage from './pages/SalaryApprovalPage';
import SalaryReportPage from './pages/SalaryReportPage';
import MyEarningsPage from './pages/MyEarningsPage';
import AIChatPage from './pages/dashboards/AIChatPage';
import CustomerDashboard from './pages/dashboards/CustomerDashboard';

// Super Admin Pages
import SuperAdminDashboard from './pages/dashboards/SuperAdminDashboard';
import UserManagementPage from './pages/dashboards/superadmin/UserManagementPage';
import FarmManagementPage from './pages/dashboards/superadmin/FarmManagementPage';
import FarmManagerManagementPage from './pages/dashboards/superadmin/FarmManagerManagementPage';
import FarmerManagementPage from './pages/dashboards/superadmin/FarmerManagementPage';
import CropMonitoringPage from './pages/dashboards/superadmin/CropMonitoringPage';
import LivestockMonitoringPage from './pages/dashboards/superadmin/LivestockMonitoringPage';
import AIAdvisoryMonitoringPage from './pages/dashboards/superadmin/AIAdvisoryMonitoringPage';
import DiseaseDetectionMonitoringPage from './pages/dashboards/superadmin/DiseaseDetectionMonitoringPage';
import TaskAttendanceMonitoringPage from './pages/dashboards/superadmin/TaskAttendanceMonitoringPage';
import SalaryPaymentMonitoringPage from './pages/dashboards/superadmin/SalaryPaymentMonitoringPage';
import MarketplaceManagementPage from './pages/dashboards/superadmin/MarketplaceManagementPage';
import NotificationManagementPage from './pages/dashboards/superadmin/NotificationManagementPage';
import SystemSettingsPage from './pages/dashboards/superadmin/SystemSettingsPage';
import AuditLogsPage from './pages/dashboards/superadmin/AuditLogsPage';

import FarmerProductsPage from './pages/marketplace/FarmerProductsPage';
import ProductApprovalPage from './pages/marketplace/ProductApprovalPage';
import CustomerMarketplacePage from './pages/marketplace/CustomerMarketplacePage';
import CartPage from './pages/marketplace/CartPage';
import OrdersPage from './pages/marketplace/OrdersPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/otp-verification" element={<OtpVerificationPage />} />
      <Route path="/marketplace" element={<MarketplacePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/ai-advisory" element={<AIAdvisoryPage />} />
      <Route path="/disease-detection" element={<DiseaseDetectionPage />} />
      <Route path="/livestock" element={<LivestockManagementPage />} />
      <Route path="/workforce" element={<WorkforceManagementPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/reports" element={<ReportsAnalyticsPage />} />
      {/* Super Admin subpages */}
      <Route path="/dashboard/super-admin" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <SuperAdminDashboard />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/users" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <UserManagementPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/farms" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <FarmManagementPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/farm-managers" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <FarmManagerManagementPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/farmers" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <FarmerManagementPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/crops" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <CropMonitoringPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/livestock" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <LivestockMonitoringPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/ai-advisory" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <AIAdvisoryMonitoringPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/disease-detection" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <DiseaseDetectionMonitoringPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/tasks-attendance" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <TaskAttendanceMonitoringPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/salary-payment" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <SalaryPaymentMonitoringPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/marketplace" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <MarketplaceManagementPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/reports" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <ReportsAnalyticsPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/notifications" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <NotificationManagementPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/settings" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <SystemSettingsPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/audit-logs" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <AuditLogsPage />
        </AppShell>
      } />
      {/* Farm Manager subpages */}
      <Route path="/dashboard/farm-manager/fields" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <FieldManagementPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/fields/:id" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <FieldDetailsPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/crops" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <FarmManagerCropsPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/marketplace-approvals" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <ProductApprovalPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/orders" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <OrdersPage role="farm-manager" />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/livestock" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <FarmManagerLivestockPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/workforce" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <FarmManagerWorkforcePage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/reports" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <ReportsAnalyticsPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/tasks" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <FarmManagerTasksPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/ai-advisory" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <AIAdvisoryPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/disease-detection" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <DiseaseDetectionPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/recent-updates" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <RecentFarmerUpdatesPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/salary-approval" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <SalaryApprovalPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/salary-report" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <SalaryReportPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/ai-chat" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <AIChatPage />
        </AppShell>
      } />
      {/* Farmer Worker subpages */}
      <Route path="/dashboard/farmer-worker/tasks" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <FarmerTasksPage />
        </AppShell>
      } />
      <Route path="/dashboard/farmer-worker/marketplace" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <FarmerProductsPage />
        </AppShell>
      } />
      <Route path="/dashboard/farmer-worker/crop-updates" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <FarmerCropUpdatesPage />
        </AppShell>
      } />
      <Route path="/dashboard/farmer-worker/livestock" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <FarmerLivestockPage />
        </AppShell>
      } />
      <Route path="/dashboard/farmer-worker/livestock-updates" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <FarmerLivestockUpdatesPage />
        </AppShell>
      } />
      <Route path="/dashboard/farmer-worker/attendance" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <FarmerAttendancePage />
        </AppShell>
      } />
      <Route path="/dashboard/farmer-worker/profile" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <FarmerProfilePage />
        </AppShell>
      } />
      <Route path="/dashboard/farmer-worker/earnings" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <MyEarningsPage />
        </AppShell>
      } />
      <Route path="/dashboard/farmer-worker/ai-chat" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <AIChatPage />
        </AppShell>
      } />
      <Route path="/dashboard/farmer-worker/ai-advisory" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <AIAdvisoryPage />
        </AppShell>
      } />
      <Route path="/dashboard/farmer-worker/notifications" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <NotificationsPage />
        </AppShell>
      } />
      
      <Route path="/dashboard/customer/marketplace" element={
        <AppShell role="customer" items={publicNavItems['customer']}>
          <CustomerMarketplacePage />
        </AppShell>
      } />
      <Route path="/dashboard/customer/cart" element={
        <AppShell role="customer" items={publicNavItems['customer']}>
          <CartPage />
        </AppShell>
      } />
      <Route path="/dashboard/customer/orders" element={
        <AppShell role="customer" items={publicNavItems['customer']}>
          <OrdersPage role="customer" />
        </AppShell>
      } />

      {roleDashboards.map((dashboard) => {
        if (dashboard.role === 'customer') {
          return (
            <Route
              key={dashboard.slug}
              path={dashboard.path}
              element={
                <AppShell role={dashboard.role} items={publicNavItems[dashboard.role]}>
                  <CustomerDashboard />
                </AppShell>
              }
            />
          );
        }
        return (
          <Route
            key={dashboard.slug}
            path={dashboard.path}
            element={
              <AppShell role={dashboard.role} items={publicNavItems[dashboard.role]}>
                <DashboardPage dashboard={dashboard} />
              </AppShell>
            }
          />
        );
      })}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}