import { useTranslation } from 'react-i18next';

const STATUS_CLASSES = {
  PENDING: 'status-pending',
  ACKNOWLEDGED: 'status-acknowledged',
  COMPLETED: 'status-completed',
};

const STATUS_LABEL_KEYS = {
  PENDING: 'pending',
  ACKNOWLEDGED: 'acknowledged',
  COMPLETED: 'completed',
};

function ReferralStatusBadge({ status }) {
  const { t } = useTranslation();
  if (!status) return null;
  return (
    <span className={`status-badge ${STATUS_CLASSES[status] || ''}`}>
      {status in STATUS_LABEL_KEYS ? t(STATUS_LABEL_KEYS[status]) : status}
    </span>
  );
}

export default ReferralStatusBadge;
