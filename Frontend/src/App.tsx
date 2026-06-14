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


import FarmerAttendancePage from './pages/dashboards/FarmerAttendancePage';
import FarmerProfilePage from './pages/dashboards/FarmerProfilePage';
import RecentFarmerUpdatesPage from './pages/dashboards/RecentFarmerUpdatesPage';

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
      {/* Farm Manager subpages */}
      <Route path="/dashboard/farm-manager/crops" element={
        <AppShell role="farm-manager" items={publicNavItems['farm-manager']}>
          <FarmManagerCropsPage />
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
      {/* Farmer Worker subpages */}
      <Route path="/dashboard/farmer-worker/tasks" element={
        <AppShell role="farmer-worker" items={publicNavItems['farmer-worker']}>
          <FarmerTasksPage />
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
      {roleDashboards.map((dashboard) => (
        <Route
          key={dashboard.slug}
          path={dashboard.path}
          element={
            <AppShell role={dashboard.role} items={publicNavItems[dashboard.role]}>
              <DashboardPage dashboard={dashboard} />
            </AppShell>
          }
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}