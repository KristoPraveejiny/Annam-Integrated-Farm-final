import { Card } from '../../../components/ui/Card';
import { useTranslation } from 'react-i18next';

export default function SystemSettingsPage() {
  const { t } = useTranslation();
  return (
    <Card title={t("System Settings")}>
      <p>{t("Content for System Settings goes here.")}</p>
    </Card>
  );
}
