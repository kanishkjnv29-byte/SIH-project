const STATUS_CLASSES = {
  PENDING: 'status-pending',
  ACKNOWLEDGED: 'status-acknowledged',
  COMPLETED: 'status-completed',
};

function ReferralStatusBadge({ status }) {
  if (!status) return null;
  return <span className={`status-badge ${STATUS_CLASSES[status] || ''}`}>{status}</span>;
}

export default ReferralStatusBadge;
