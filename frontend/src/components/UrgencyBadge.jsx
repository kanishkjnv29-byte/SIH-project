const URGENCY_CLASSES = {
  LOW: 'urgency-low',
  MEDIUM: 'urgency-medium',
  HIGH: 'urgency-high',
  EMERGENCY: 'urgency-emergency',
};

function UrgencyBadge({ level }) {
  if (!level) return null;
  return <span className={`urgency-badge ${URGENCY_CLASSES[level] || ''}`}>{level}</span>;
}

export default UrgencyBadge;
