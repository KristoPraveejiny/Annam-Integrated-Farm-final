import { Card } from '../../../components/ui/Card';
import { useTranslation } from 'react-i18next';

export default function AuditLogsPage() {
  const { t } = useTranslation();
  return (
    <Card title={t("Audit Logs")}>
      <p>{t("Content for Audit Logs goes here.")}</p>
    </Card>
  );
}
