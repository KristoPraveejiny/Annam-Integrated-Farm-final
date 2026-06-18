import os

base_dir = r'd:\Praveena\3rd year\2nd semi\Annam Integrated Farm\Frontend\src\pages\dashboards\superadmin'
os.makedirs(base_dir, exist_ok=True)

files = {
    'FarmManagerManagementPage.tsx': 'Farm Manager Management',
    'FarmerManagementPage.tsx': 'Farmer Management',
    'CropMonitoringPage.tsx': 'Crop Monitoring',
    'LivestockMonitoringPage.tsx': 'Livestock Monitoring',
    'AIAdvisoryMonitoringPage.tsx': 'AI Advisory Monitoring',
    'DiseaseDetectionMonitoringPage.tsx': 'Disease Detection Monitoring',
    'TaskAttendanceMonitoringPage.tsx': 'Task & Attendance Monitoring',
    'SalaryPaymentMonitoringPage.tsx': 'Salary & Payment Monitoring',
    'MarketplaceManagementPage.tsx': 'Marketplace Management',
    'ReportsAnalyticsPage.tsx': 'Reports & Analytics',
    'NotificationManagementPage.tsx': 'Notification Management',
    'SystemSettingsPage.tsx': 'System Settings',
    'AuditLogsPage.tsx': 'Audit Logs',
    'UserManagementPage.tsx': 'User Management',
    'FarmManagementPage.tsx': 'Farm Management'
}

for name, title in files.items():
    path = os.path.join(base_dir, name)
    content = f'''import {{ Card }} from \'../../../components/ui/Card\';

export default function {name.split('.')[0]}() {{
  return (
    <Card title="{title}">
      <p>Content for {title} goes here.</p>
    </Card>
  );
}}
'''
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print('Done!')
