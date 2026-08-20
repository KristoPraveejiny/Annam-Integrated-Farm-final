import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { publicNavItems, roleDashboards } from './data/mock';
import AIAdvisoryPage from './pages/AIAdvisoryPage';
import DashboardPage from './pages/dashboards/DashboardPage';
import FarmManagerDashboard from './pages/dashboards/FarmManagerDashboard';
import AboutPage from './pages/AboutPage';
import DiseaseDetectionPage from './pages/DiseaseDetectionPage';
import DiseaseHistoryPage from './pages/DiseaseHistoryPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import LandingPage from './pages/LandingPage';
import LivestockManagementPage from './pages/LivestockManagementPage';
import LoginPage from './pages/auth/LoginPage';
import MarketplacePage from './pages/MarketplacePage';
import NotificationsPage from './pages/NotificationsPage';
import OtpVerificationPage from './pages/auth/OtpVerificationPage';
import RegisterPage from './pages/auth/RegisterPage';
import ReportsAnalyticsPage from './pages/ReportsAnalyticsPage';
import FarmExpensesPage from './pages/FarmExpensesPage';
import ProductionRecordsPage from './pages/ProductionRecordsPage';
import LivestockProductionPage from './pages/LivestockProductionPage';
import WorkforceManagementPage from './pages/WorkforceManagementPage';
import { AppShell } from './components/layout/AppShell';
import FarmManagerCropsPage from './pages/dashboards/FarmManagerCropsPage';
import FarmManagerLivestockPage from './pages/dashboards/FarmManagerLivestockPage';
import FarmManagerWorkforcePage from './pages/dashboards/FarmManagerWorkforcePage';
import FarmManagerTasksPage from './pages/dashboards/FarmManagerTasksPage';
import TaskReviewPage from './pages/dashboards/TaskReviewPage';
import FarmerTasksPage from './pages/dashboards/FarmerTasksPage';
import TaskActivityPage from './pages/dashboards/TaskActivityPage';
import FarmerCropUpdatesPage from './pages/dashboards/FarmerCropUpdatesPage';
import FarmerHarvestPage from './pages/dashboards/FarmerHarvestPage';
import FarmerLivestockPage from './pages/dashboards/FarmerLivestockPage';
import FarmerLivestockUpdatesPage from './pages/dashboards/FarmerLivestockUpdatesPage';
import FieldManagementPage from './pages/FarmManager/FieldManagementPage';
import FieldDetailsPage from './pages/FarmManager/FieldDetailsPage';


import AttendanceManagementPage from './pages/dashboards/AttendanceManagementPage';
import MyAttendancePage from './pages/dashboards/MyAttendancePage';
import FarmerProfilePage from './pages/dashboards/FarmerProfilePage';
import RecentFarmerUpdatesPage from './pages/dashboards/RecentFarmerUpdatesPage';
import SalaryApprovalPage from './pages/SalaryApprovalPage';
import SalaryPaymentPage from './pages/dashboards/SalaryPaymentPage';
import SalaryReportPage from './pages/SalaryReportPage';
import MyEarningsPage from './pages/MyEarningsPage';
import AIChatPage from './pages/dashboards/AIChatPage';
import CustomerDashboard from './pages/dashboards/CustomerDashboard';
import FeedbackPage from './pages/dashboards/FeedbackPage';

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
import FeedbackManagementPage from './pages/dashboards/superadmin/FeedbackManagementPage';
import ContactInquiriesPage from './pages/dashboards/superadmin/ContactInquiriesPage';
import SystemSettingsPage from './pages/dashboards/superadmin/SystemSettingsPage';
import AuditLogsPage from './pages/dashboards/superadmin/AuditLogsPage';

import FarmerProductsPage from './pages/marketplace/FarmerProductsPage';
import ProductApprovalPage from './pages/marketplace/ProductApprovalPage';
import CustomerMarketplacePage from './pages/marketplace/CustomerMarketplacePage';
import CartPage from './pages/marketplace/CartPage';
import OrdersPage from './pages/marketplace/OrdersPage';

export default function App() {
  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
      />
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
      <Route path="/dashboard/super-admin/expenses" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <FarmExpensesPage scope="admin" />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/production-records" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <ProductionRecordsPage scope="admin" />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/livestock-production" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <LivestockProductionPage scope="admin" />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/notifications" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <NotificationManagementPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/feedback" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <FeedbackManagementPage />
        </AppShell>
      } />
      <Route path="/dashboard/super-admin/inquiries" element={
        <AppShell role="super-admin" items={publicNavItems['super-admin']}>
          <ContactInquiriesPage />
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
      <Route path="/dashboard/farm-manager/expenses" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <FarmExpensesPage scope="manager" />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/production-records" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <ProductionRecordsPage scope="manager" />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/livestock-production" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <LivestockProductionPage scope="manager" />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/tasks" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <FarmManagerTasksPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/tasks/:id/review" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <TaskReviewPage />
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
      <Route path="/dashboard/farm-manager/disease-history" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <DiseaseHistoryPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/recent-updates" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <RecentFarmerUpdatesPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/attendance" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <AttendanceManagementPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/salary-approval" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <SalaryApprovalPage />
        </AppShell>
      } />
      <Route path="/dashboard/farm-manager/salary-payment" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <SalaryPaymentPage />
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
      <Route path="/dashboard/farm-manager/feedback" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <FeedbackManagementPage readOnly />
        </AppShell>
      } />
      {/* Farmer Worker subpages */}
      <Route path="/dashboard/farmer-worker/tasks" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <FarmerTasksPage />
        </AppShell>
      } />
      <Route path="/dashboard/farmer-worker/tasks/:id/activity" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <TaskActivityPage />
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
      <Route path="/dashboard/farmer-worker/harvest" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <FarmerHarvestPage />
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
          <MyAttendancePage />
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

      <Route path="/dashboard/farmer-worker/feedback" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <FeedbackPage role="farmer-worker" />
        </AppShell>
      } />
      
      <Route path="/dashboard/customer/marketplace" element={
        <AppShell role="customer" items={publicNavItems['customer']}>
          <CustomerMarketplacePage />
        </AppShell>
      } />
      <Route path="/dashboard/customer/feedback" element={
        <AppShell role="customer" items={publicNavItems['customer']}>
          <FeedbackPage role="customer" />
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
        if (dashboard.role === 'farm-manager') {
          return (
            <Route
              key={dashboard.slug}
              path={dashboard.path}
              element={
                <AppShell role={dashboard.role} items={publicNavItems[dashboard.role]}>
                  <FarmManagerDashboard />
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
    </>
  );
}
