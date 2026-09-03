import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import UrgencyBadge from '../components/UrgencyBadge';
import './Dashboard.css';
import './Patients.css';

const PATIENTS_URL = 'http://localhost:5000/api/patients';

function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState('');
  const [triaging, setTriaging] = useState(false);
  const [triageError, setTriageError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    (async () => {
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
    })();
  }, [id, navigate]);

  async function handleTriage() {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

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
      </div>
    </div>
  );
}

export default PatientDetail;
