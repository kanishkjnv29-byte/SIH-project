import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import UrgencyBadge from '../components/UrgencyBadge';
import LanguageToggle from '../components/LanguageToggle';
import { API_BASE_URL } from '../config';
import './Dashboard.css';
import './Patients.css';

const PATIENTS_URL = `${API_BASE_URL}/api/patients`;

const GENDER_LABEL_KEYS = {
  Male: 'male',
  Female: 'female',
  Other: 'other',
};

function truncate(text, length) {
  if (!text) return '';
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function ViewPatients() {
  const { t } = useTranslation();
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
        <div className="view-patients-topbar">
          <LanguageToggle />
        </div>
        <Link to="/dashboard" className="back-link">
          ← {t('backToDashboard')}
        </Link>
        <h1>{t('patients')}</h1>

        {error && <p className="form-error">{error}</p>}

        {!error && patients === null && <p className="dashboard-loading">Loading...</p>}

        {!error && patients !== null && patients.length === 0 && (
          <p className="dashboard-loading">{t('noPatientsYet')}</p>
        )}

        {!error && patients !== null && patients.length > 0 && (
          <div className="patients-table-wrapper">
            <table className="patients-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>{t('age')}</th>
                  <th>{t('gender')}</th>
                  <th>{t('village')}</th>
                  <th>{t('symptoms')}</th>
                  <th>{t('addedBy')}</th>
                  <th>{t('urgency')}</th>
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
                    <td>{patient.gender ? (patient.gender in GENDER_LABEL_KEYS ? t(GENDER_LABEL_KEYS[patient.gender]) : patient.gender) : '-'}</td>
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
