import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ReferralStatusBadge from '../components/ReferralStatusBadge';
import './Dashboard.css';
import './Patients.css';
import './FollowUps.css';

const FOLLOW_UPS_URL = 'http://localhost:5000/api/follow-ups';

function isPastDue(dueDateStr) {
  const due = new Date(`${dueDateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString();
}

function FollowUps() {
  const navigate = useNavigate();
  const [followUps, setFollowUps] = useState(null);
  const [error, setError] = useState('');
  const [completingId, setCompletingId] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [submittingId, setSubmittingId] = useState(null);
  const [submitError, setSubmitError] = useState('');

  function getToken() {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return null;
    }
    return token;
  }

  async function loadFollowUps(token) {
    try {
      const res = await fetch(FOLLOW_UPS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
        return;
      }

      if (!res.ok) {
        setError('Could not load follow-ups. Please try again.');
        return;
      }

      setFollowUps(await res.json());
    } catch {
      setError('Could not reach the server. Please try again.');
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    loadFollowUps(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startComplete(id) {
    setCompletingId(id);
    setNotesDraft('');
    setSubmitError('');
  }

  function cancelComplete() {
    setCompletingId(null);
    setNotesDraft('');
    setSubmitError('');
  }

  async function handleSubmitComplete(id) {
    const token = getToken();
    if (!token) return;

    setSubmittingId(id);
    setSubmitError('');
    try {
      const res = await fetch(`${FOLLOW_UPS_URL}/${id}/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: notesDraft.trim() }),
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setFollowUps((prev) => prev.map((f) => (f.id === id ? { ...f, ...data } : f)));
      setCompletingId(null);
      setNotesDraft('');
    } catch {
      setSubmitError('Could not reach the server. Please try again.');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="dashboard-page">
      <div className="patients-container">
        <Link to="/dashboard" className="back-link">
          ← Back to Dashboard
        </Link>
        <h1>My Follow-ups</h1>

        {error && <p className="form-error">{error}</p>}

        {!error && followUps === null && <p className="dashboard-loading">Loading...</p>}

        {!error && followUps !== null && followUps.length === 0 && (
          <p className="dashboard-loading">No follow-ups assigned to you.</p>
        )}

        {!error && followUps !== null && followUps.length > 0 && (
          <div className="followup-list">
            {followUps.map((followUp) => {
              const overdue = followUp.status === 'PENDING' && isPastDue(followUp.due_date);
              return (
                <div
                  key={followUp.id}
                  className={`followup-card${followUp.status === 'COMPLETED' ? ' followup-completed' : ''}`}
                >
                  <div className="followup-card-header">
                    <span className="followup-patient">{followUp.patient_name || 'Unknown patient'}</span>
                    <ReferralStatusBadge status={followUp.status} />
                  </div>
                  <p className="followup-facility">Referred to {followUp.facility_name || 'Unknown facility'}</p>
                  <p className={`followup-due${overdue ? ' followup-overdue' : ''}`}>
                    Due: {formatDate(followUp.due_date)}
                  </p>

                  {followUp.status === 'COMPLETED' && (
                    <p className="followup-notes">{followUp.notes ? followUp.notes : 'No notes added.'}</p>
                  )}

                  {followUp.status === 'PENDING' &&
                    (completingId === followUp.id ? (
                      <div className="followup-complete-form">
                        <textarea
                          rows={2}
                          placeholder="Notes (optional)"
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                        />
                        {submitError && <p className="form-error">{submitError}</p>}
                        <div className="followup-complete-actions">
                          <button
                            type="button"
                            className="primary-button"
                            disabled={submittingId === followUp.id}
                            onClick={() => handleSubmitComplete(followUp.id)}
                          >
                            {submittingId === followUp.id ? 'Saving...' : 'Confirm'}
                          </button>
                          <button type="button" className="secondary-button" onClick={cancelComplete}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="primary-button" onClick={() => startComplete(followUp.id)}>
                        Mark Done
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default FollowUps;
