import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Dashboard.css';

const ME_URL = 'http://localhost:5000/api/auth/me';

function Dashboard() {
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    (async () => {
      try {
        const res = await fetch(ME_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Unauthorized');
        const data = await res.json();
        setWorker(data);
      } catch {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  }

  if (loading || !worker) {
    return (
      <div className="dashboard-page">
        <p className="dashboard-loading">Loading...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>{worker.name}</h1>
          <p>
            {worker.role} · {worker.facility_name || 'No facility set'}
          </p>
        </div>
        <button type="button" onClick={handleLogout}>
          Log Out
        </button>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-actions">
          <Link to="/patients/new" className="dashboard-action">
            Add New Patient
          </Link>
          <Link to="/patients" className="dashboard-action">
            View Patients
          </Link>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
