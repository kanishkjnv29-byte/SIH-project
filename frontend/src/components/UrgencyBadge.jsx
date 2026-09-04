import { useTranslation } from 'react-i18next';

const URGENCY_CLASSES = {
  LOW: 'urgency-low',
  MEDIUM: 'urgency-medium',
  HIGH: 'urgency-high',
  EMERGENCY: 'urgency-emergency',
};

const URGENCY_LABEL_KEYS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  EMERGENCY: 'emergency',
};

function UrgencyBadge({ level }) {
  const { t } = useTranslation();
  if (!level) return null;
  return (
    <span className={`urgency-badge ${URGENCY_CLASSES[level] || ''}`}>
      {level in URGENCY_LABEL_KEYS ? t(URGENCY_LABEL_KEYS[level]) : level}
    </span>
  );
}

export default UrgencyBadge;
