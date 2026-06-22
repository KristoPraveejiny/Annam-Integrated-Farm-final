import { Card } from '../../../components/ui/Card';
import { useTranslation } from 'react-i18next';

export default function ReportsAnalyticsPage() {
  const { t } = useTranslation();
  return (
    <Card title="Reports & Analytics">
      <p>Content for Reports & Analytics goes here.</p>
    </Card>
  );
}
