import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import UrgencyBadge from '../components/UrgencyBadge';
import ReferralStatusBadge from '../components/ReferralStatusBadge';
import { FACILITY_TYPE_LABELS } from '../constants/facilityTypes';
import './AuthForm.css';
import './Dashboard.css';
import './Patients.css';

const PATIENTS_URL = 'http://localhost:5000/api/patients';
const FACILITIES_URL = 'http://localhost:5000/api/facilities';
const REFERRALS_URL = 'http://localhost:5000/api/referrals';

function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString();
}

function formatDateOnly(dateStr) {
  if (!dateStr) return '';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString();
}

function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState('');
  const [triaging, setTriaging] = useState(false);
  const [triageError, setTriageError] = useState('');

  const [facilities, setFacilities] = useState([]);
  const [referrals, setReferrals] = useState(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [reason, setReason] = useState('');
  const [referring, setReferring] = useState(false);
  const [referralError, setReferralError] = useState('');
  const [referralSuccess, setReferralSuccess] = useState('');

  function getToken() {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return null;
    }
    return token;
  }

  async function loadPatient(token) {
    try {
      const res = await fetch(`${PATIENTS_URL}/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
        return;
      }

      if (!res.ok) {
        setError('Could not load this patient.');
        return;
      }

      setPatient(await res.json());
    } catch {
      setError('Could not reach the server. Please try again.');
    }
  }

  async function loadFacilities(token) {
    try {
      const res = await fetch(FACILITIES_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setFacilities(await res.json());
    } catch {
      // Facility list is non-critical for the page to function; fail silently.
    }
  }

  async function loadReferrals(token) {
    try {
      const res = await fetch(`${PATIENTS_URL}/${id}/referrals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setReferrals([]);
        return;
      }
      setReferrals(await res.json());
    } catch {
      setReferrals([]);
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    loadPatient(token);
    loadFacilities(token);
    loadReferrals(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleTriage() {
    const token = getToken();
    if (!token) return;

    setTriaging(true);
    setTriageError('');
    try {
      const res = await fetch(`${PATIENTS_URL}/${id}/triage`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setTriageError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setPatient(data);
    } catch {
      setTriageError('Could not reach the server. Please try again.');
    } finally {
      setTriaging(false);
    }
  }

  async function handleReferralSubmit(e) {
    e.preventDefault();
    setReferralError('');
    setReferralSuccess('');

    if (!selectedFacilityId) {
      setReferralError('Please select a facility');
      return;
    }
    if (!reason.trim()) {
      setReferralError('Reason for referral is required');
      return;
    }

    const token = getToken();
    if (!token) return;

    setReferring(true);
    try {
      const res = await fetch(REFERRALS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patient_id: id,
          facility_id: selectedFacilityId,
          reason: reason.trim(),
        }),
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setReferralError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setReferralSuccess(`Referred to ${data.facility_name} — status: ${data.status}`);
      setSelectedFacilityId('');
      setReason('');
      loadReferrals(token);
    } catch {
      setReferralError('Could not reach the server. Please try again.');
    } finally {
      setReferring(false);
    }
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="patients-container">
          <Link to="/patients" className="back-link">
            ← Back to Patients
          </Link>
          <p className="form-error">{error}</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="dashboard-page">
        <div className="patients-container">
          <p className="dashboard-loading">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="patients-container">
        <Link to="/patients" className="back-link">
          ← Back to Patients
        </Link>
        <h1>{patient.name}</h1>

        <div className="patient-info-grid">
          <div>
            <strong>Age:</strong> {patient.age ?? '-'}
          </div>
          <div>
            <strong>Gender:</strong> {patient.gender || '-'}
          </div>
          <div>
            <strong>Phone:</strong> {patient.phone || '-'}
          </div>
          <div>
            <strong>Village:</strong> {patient.village || '-'}
          </div>
          <div>
            <strong>Added by:</strong> {patient.created_by_name || '-'}
          </div>
        </div>

        <div className="patient-symptoms">
          <strong>Symptoms</strong>
          <p>{patient.symptoms}</p>
        </div>

        <div className="triage-section">
          {patient.urgency_level ? (
            <>
              <UrgencyBadge level={patient.urgency_level} />
              <p className="triage-reason">{patient.triage_reason}</p>
              <p className="triage-note">AI-suggested — please use your clinical judgment.</p>
            </>
          ) : (
            <>
              <button type="button" className="primary-button" onClick={handleTriage} disabled={triaging}>
                {triaging ? 'Running AI Triage...' : 'Run AI Triage'}
              </button>
              {triageError && <p className="form-error">{triageError}</p>}
            </>
          )}
        </div>

        <div className="referral-section">
          <h2>Refer to Facility</h2>

          <form onSubmit={handleReferralSubmit} noValidate>
            <div className="field">
              <label htmlFor="facility">Facility</label>
              <select
                id="facility"
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
              >
                <option value="">Select a facility</option>
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name} ({FACILITY_TYPE_LABELS[facility.type] || facility.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="reason">Reason for referral</label>
              <textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {referralError && <p className="form-error">{referralError}</p>}
            {referralSuccess && <p className="form-success">{referralSuccess}</p>}

            <button type="submit" className="primary-button" disabled={referring}>
              {referring ? 'Sending...' : 'Send Referral'}
            </button>
          </form>
        </div>

        <div className="referral-history">
          <h2>Referral History</h2>

          {referrals === null && <p className="dashboard-loading">Loading...</p>}
          {referrals !== null && referrals.length === 0 && (
            <p className="dashboard-loading">No referrals yet.</p>
          )}
          {referrals !== null && referrals.length > 0 && (
            <ul className="referral-list">
              {referrals.map((referral) => (
                <li key={referral.id} className="referral-list-item">
                  <div className="referral-list-header">
                    <span className="referral-list-facility">
                      {referral.facility_name} ({FACILITY_TYPE_LABELS[referral.facility_type] || referral.facility_type})
                    </span>
                    <ReferralStatusBadge status={referral.status} />
                  </div>
                  <p className="referral-list-reason">{referral.reason}</p>
                  <span className="referral-list-date">{formatDate(referral.created_at)}</span>

                  {referral.follow_up_status === 'PENDING' && (
                    <p className="referral-followup-note">
                      Follow-up due {formatDateOnly(referral.follow_up_due_date)}
                    </p>
                  )}
                  {referral.follow_up_status === 'COMPLETED' && (
                    <p className="referral-followup-note">
                      Followed up on {formatDate(referral.follow_up_completed_at)}:{' '}
                      {referral.follow_up_notes || 'No notes added.'}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientDetail;
