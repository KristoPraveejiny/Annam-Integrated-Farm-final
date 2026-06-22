import { Card } from '../../../components/ui/Card';
import { useTranslation } from 'react-i18next';

export default function NotificationManagementPage() {
  const { t } = useTranslation();
  return (
    <Card title={t("Notification Management")}>
      <p>{t("Content for Notification Management goes here.")}</p>
    </Card>
  );
}
