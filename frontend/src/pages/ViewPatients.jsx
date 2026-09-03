import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import UrgencyBadge from '../components/UrgencyBadge';
import './Dashboard.css';
import './Patients.css';

const PATIENTS_URL = 'http://localhost:5000/api/patients';

function truncate(text, length) {
  if (!text) return '';
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function ViewPatients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    (async () => {
      try {
        const res = await fetch(PATIENTS_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          localStorage.removeItem('token');
          navigate('/login', { replace: true });
          return;
        }

        if (!res.ok) {
          setError('Could not load patients. Please try again.');
          return;
        }

        setPatients(await res.json());
      } catch {
        setError('Could not reach the server. Please try again.');
      }
    })();
  }, [navigate]);

  return (
    <div className="dashboard-page">
      <div className="patients-container">
        <Link to="/dashboard" className="back-link">
          ← Back to Dashboard
        </Link>
        <h1>Patients</h1>

        {error && <p className="form-error">{error}</p>}

        {!error && patients === null && <p className="dashboard-loading">Loading...</p>}

        {!error && patients !== null && patients.length === 0 && (
          <p className="dashboard-loading">No patients added yet.</p>
        )}

        {!error && patients !== null && patients.length > 0 && (
          <div className="patients-table-wrapper">
            <table className="patients-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Village</th>
                  <th>Symptoms</th>
                  <th>Added By</th>
                  <th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="patients-row"
                    onClick={() => navigate(`/patients/${patient.id}`)}
                  >
                    <td>{patient.name}</td>
                    <td>{patient.age ?? '-'}</td>
                    <td>{patient.gender || '-'}</td>
                    <td>{patient.village || '-'}</td>
                    <td>{truncate(patient.symptoms, 40)}</td>
                    <td>{patient.created_by_name || '-'}</td>
                    <td>
                      <UrgencyBadge level={patient.urgency_level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ViewPatients;
