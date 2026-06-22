import { FiBarChart2, FiBell, FiBox, FiCloud, FiDollarSign, FiHome, FiLayers, FiMessageCircle, FiSettings, FiShield, FiShoppingBag, FiUser, FiUsers, FiAlertTriangle, FiCheckCircle, FiMapPin, FiDroplet, FiHeart, FiActivity, FiClipboard } from 'react-icons/fi';

export const metrics = [
  { label: 'Total Farms', value: '48', delta: '+12%', color: 'from-emerald-500 to-lime-400' },
  { label: 'Farmers', value: '1,264', delta: '+8%', color: 'from-green-600 to-emerald-400' },
  { label: 'Products', value: '284', delta: '+19%', color: 'from-lime-500 to-green-300' },
  { label: 'Orders', value: '9,420', delta: '+24%', color: 'from-teal-500 to-emerald-300' },
];

export const landingStats = [
  { value: '12K+', label: 'Active Farmers' },
  { value: '180+', label: 'Smart Farms' },
  { value: '98%', label: 'Task Completion' },
  { value: '24/7', label: 'AI Advisory' },
];

export const features = [
  'Unified farm, workforce, livestock, and marketplace management',
  'AI crop guidance, weather intelligence, and disease detection',
  'Real-time notifications, QR verification, and secure analytics',
  'Responsive dashboards for every user role',
];

export const roleDashboards = [
  {
    slug: 'farm-manager',
    path: '/dashboard/farm-manager',
    role: 'farm-manager' as const,
    title: 'Farm Manager Dashboard',
    description: 'Farm operations, workforce planning, crop and livestock tracking.',
  },
  {
    slug: 'farmer-worker',
    path: '/dashboard/farmer-worker',
    role: 'farmer-worker' as const,
    title: 'Farmer / Worker Dashboard',
    description: 'Daily tasks, attendance, alerts, and progress tracking.',
  },
  {
    slug: 'customer',
    path: '/dashboard/customer',
    role: 'customer' as const,
    title: 'Customer Dashboard',
    description: 'Browse products, checkout, orders, QR verification, and reviews.',
  },
  {
    slug: 'guest',
    path: '/dashboard/guest',
    role: 'guest' as const,
    title: 'Guest User Dashboard',
    description: 'Preview the platform, explore featured products, and learn more.',
  },
];

export const publicNavItems = {
  'super-admin': [
    { label: 'Dashboard Overview', href: '/dashboard/super-admin', icon: FiHome },
    { label: 'User Management', href: '/dashboard/super-admin/users', icon: FiUsers },
    { label: 'Farm Management', href: '/dashboard/super-admin/farms', icon: FiLayers },
    { label: 'Farm Manager Management', href: '/dashboard/super-admin/farm-managers', icon: FiUser },
    { label: 'Farmer Management', href: '/dashboard/super-admin/farmers', icon: FiUser },
    { label: 'Crop Monitoring', href: '/dashboard/super-admin/crops', icon: FiLayers },
    { label: 'Livestock Monitoring', href: '/dashboard/super-admin/livestock', icon: FiHeart },
    { label: 'AI Advisory Monitoring', href: '/dashboard/super-admin/ai-advisory', icon: FiCloud },
    { label: 'Disease Detection Monitoring', href: '/dashboard/super-admin/disease-detection', icon: FiAlertTriangle },
    { label: 'Task & Attendance Monitoring', href: '/dashboard/super-admin/tasks-attendance', icon: FiCheckCircle },
    { label: 'Salary & Payment Monitoring', href: '/dashboard/super-admin/salary-payment', icon: FiDollarSign },
    { label: 'Marketplace Management', href: '/dashboard/super-admin/marketplace', icon: FiShoppingBag },
    { label: 'Reports & Analytics', href: '/dashboard/super-admin/reports', icon: FiBarChart2 },
    { label: 'Notification Management', href: '/dashboard/super-admin/notifications', icon: FiBell },
    { label: 'System Settings', href: '/dashboard/super-admin/settings', icon: FiSettings },
    { label: 'Audit Logs', href: '/dashboard/super-admin/audit-logs', icon: FiClipboard },
    { label: 'Logout', href: '/', icon: FiMessageCircle },
  ],
  'farm-manager': [
    { label: 'Dashboard', href: '/dashboard/farm-manager', icon: FiHome },
    { label: 'Field Management', href: '/dashboard/farm-manager/fields', icon: FiMapPin },
    { label: 'Crops', href: '/dashboard/farm-manager/crops', icon: FiLayers },
    { label: 'Tasks', href: '/dashboard/farm-manager/tasks', icon: FiCheckCircle },
    { label: 'Livestock', href: '/dashboard/farm-manager/livestock', icon: FiUser },
    { label: 'Farmer Updates', href: '/dashboard/farm-manager/recent-updates', icon: FiClipboard },
    { label: 'Disease Detection', href: '/dashboard/farm-manager/disease-detection', icon: FiAlertTriangle },
    { label: 'Marketplace Approvals', href: '/dashboard/farm-manager/marketplace-approvals', icon: FiShoppingBag },
    { label: 'Marketplace', href: '/marketplace', icon: FiShoppingBag },
    { label: 'Marketplace Orders', href: '/dashboard/farm-manager/orders', icon: FiBox },
    { label: 'Salary Approval', href: '/dashboard/farm-manager/salary-approval', icon: FiDollarSign },
    { label: 'Salary Report', href: '/dashboard/farm-manager/salary-report', icon: FiBarChart2 },
    { label: 'Analytics', href: '/dashboard/farm-manager/reports', icon: FiBarChart2 },
    { label: 'Weather', href: '/dashboard/farm-manager/ai-advisory', icon: FiCloud },
    { label: 'AI Chatbot', href: '/dashboard/farm-manager/ai-chat', icon: FiMessageCircle },
    { label: 'Logout', href: '/', icon: FiMessageCircle },
  ],
  'farmer-worker': [
    { label: 'Dashboard', href: '/dashboard/farmer-worker', icon: FiHome },
    { label: 'My Tasks', href: '/dashboard/farmer-worker/tasks', icon: FiCheckCircle },
    { label: 'My Products', href: '/dashboard/farmer-worker/marketplace', icon: FiShoppingBag },
    { label: 'Crop Updates', href: '/dashboard/farmer-worker/crop-updates', icon: FiLayers },
    { label: 'Livestock Updates', href: '/dashboard/farmer-worker/livestock-updates', icon: FiHeart },
    { label: 'Livestock Management', href: '/dashboard/farmer-worker/livestock', icon: FiHeart },
    { label: 'Weather Updates', href: '/dashboard/farmer-worker/ai-advisory', icon: FiCloud },
    { label: 'Attendance', href: '/dashboard/farmer-worker/attendance', icon: FiActivity },
    { label: 'My Earnings', href: '/dashboard/farmer-worker/earnings', icon: FiDollarSign },
    { label: 'Notifications', href: '/dashboard/farmer-worker/notifications', icon: FiBell },
    { label: 'AI Chatbot', href: '/dashboard/farmer-worker/ai-chat', icon: FiMessageCircle },
    { label: 'Profile', href: '/dashboard/farmer-worker/profile', icon: FiUser },
    { label: 'Logout', href: '/', icon: FiMessageCircle },
  ],
  'customer': [
    { label: 'Dashboard', href: '/dashboard/customer', icon: FiHome },
    { label: 'Marketplace', href: '/dashboard/customer/marketplace', icon: FiShoppingBag },
    { label: 'Cart', href: '/dashboard/customer/cart', icon: FiShoppingBag },
    { label: 'Orders & Payments', href: '/dashboard/customer/orders', icon: FiBox },
    { label: 'QR Verify', href: '/dashboard/customer#qr', icon: FiShield },
    { label: 'Logout', href: '/', icon: FiMessageCircle },
  ],
  'guest': [
    { label: 'Overview', href: '/dashboard/guest', icon: FiHome },
    { label: 'Marketplace', href: '/marketplace', icon: FiShoppingBag },
    { label: 'AI Advisory', href: '/ai-advisory', icon: FiCloud },
    { label: 'Login', href: '/login', icon: FiUser },
    { label: 'Register', href: '/register', icon: FiUsers },
  ],
} as const;

export const marketplaceProducts = [
  { name: 'Organic Spinach', category: 'Vegetables', price: '$4.50', rating: 4.9, badge: 'Fresh' },
  { name: 'Mango Basket', category: 'Fruits', price: '$10.00', rating: 4.8, badge: 'Seasonal' },
  { name: 'Fresh Milk', category: 'Milk', price: '$2.80', rating: 4.7, badge: 'Daily' },
  { name: 'Farm Eggs', category: 'Eggs', price: '$5.10', rating: 5.0, badge: 'Popular' },
  { name: 'Herbal Compost', category: 'Organic', price: '$7.20', rating: 4.8, badge: 'Eco' },
  { name: 'Tomato Pack', category: 'Vegetables', price: '$3.25', rating: 4.6, badge: 'Best Seller' },
];

export const alerts = [
  { title: 'Weather Alert', description: 'Rain expected tomorrow at 2 PM. Delay spraying operations.', tone: 'emerald' },
  { title: 'Disease Risk', description: 'Leaf blight risk detected in Block C. Review crop scans.', tone: 'amber' },
  { title: 'Order Update', description: '12 customer orders are pending dispatch this morning.', tone: 'sky' },
  { title: 'Task Reminder', description: 'Irrigation inspection due before 10:30 AM.', tone: 'lime' },
];

export const tasks = [
  { title: 'Inspect irrigation lines', progress: 72, assignee: 'Team A' },
  { title: 'Update crop stage report', progress: 48, assignee: 'Ravi' },
  { title: 'Check livestock feed stock', progress: 91, assignee: 'Meena' },
  { title: 'Pack marketplace produce', progress: 65, assignee: 'Dispatch' },
];

export const chartSeries = [
  { month: 'Jan', revenue: 30, productivity: 55, livestock: 24 },
  { month: 'Feb', revenue: 42, productivity: 60, livestock: 32 },
  { month: 'Mar', revenue: 38, productivity: 68, livestock: 28 },
  { month: 'Apr', revenue: 52, productivity: 71, livestock: 40 },
  { month: 'May', revenue: 61, productivity: 76, livestock: 44 },
  { month: 'Jun', revenue: 74, productivity: 84, livestock: 48 },
];

export const testimonials = [
  {
    name: 'Asha, Farm Owner',
    quote: 'The AI recommendations helped us reduce crop loss and improve yield planning.',
  },
  {
    name: 'Prakash, Farm Manager',
    quote: 'Task tracking and workforce visibility are clean, fast, and mobile friendly.',
  },
  {
    name: 'Nila, Customer',
    quote: 'The marketplace feels premium and trustworthy, with excellent order tracking.',
  },
];

export const dashboardBadges = {
  online: 'System healthy',
  weather: 'Humidity 62%',
  ai: 'AI models active',
  qr: 'QR sync enabled',
};

export const pieData = [
  { name: 'Farmers', value: 400 },
  { name: 'Workers', value: 300 },
  { name: 'Customers', value: 300 },
  { name: 'Admins', value: 200 },
];

export const colors = ['#059669', '#10b981', '#34d399', '#6ee7b7'];
