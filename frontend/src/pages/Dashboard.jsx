import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Dashboard.css';

const ME_URL = 'http://localhost:5000/api/auth/me';
const STATS_URL = 'http://localhost:5000/api/stats';

const URGENCY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];
const URGENCY_COLORS = { LOW: '#1a7f37', MEDIUM: '#e0a800', HIGH: '#e07b00', EMERGENCY: '#d33' };

const REFERRAL_STATUS_ORDER = ['PENDING', 'ACKNOWLEDGED', 'COMPLETED'];
const REFERRAL_STATUS_COLORS = { PENDING: '#888', ACKNOWLEDGED: '#1e50c9', COMPLETED: '#1a7f37' };

function StatBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="stat-bar-row">
      <span className="stat-bar-label">{label}</span>
      <div className="stat-bar-track">
        <div className="stat-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="stat-bar-count">{count}</span>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

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
        return;
      } finally {
        setLoading(false);
      }

      try {
        const statsRes = await fetch(STATS_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
      } catch {
        // Stats are a nice-to-have on the dashboard; fail silently if unreachable.
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

  const totalTriaged = stats
    ? URGENCY_ORDER.reduce((sum, level) => sum + stats.urgency_breakdown[level], 0)
    : 0;

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
        {stats && (
          <div className="stats-section">
            <div className="stat-cards">
              <div className="stat-card">
                <span className="stat-card-value">{stats.total_patients}</span>
                <span className="stat-card-label">Total Patients</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-value">{stats.total_referrals}</span>
                <span className="stat-card-label">Total Referrals</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-value">{stats.my_pending_followups}</span>
                <span className="stat-card-label">My Pending Follow-ups</span>
              </div>
            </div>

            <div className="stats-breakdown">
              <h3 className="stats-breakdown-title">Triage Urgency</h3>
              {totalTriaged === 0 ? (
                <p className="dashboard-loading">No data yet</p>
              ) : (
                URGENCY_ORDER.map((level) => (
                  <StatBar
                    key={level}
                    label={level}
                    count={stats.urgency_breakdown[level]}
                    total={totalTriaged}
                    color={URGENCY_COLORS[level]}
                  />
                ))
              )}
            </div>

            <div className="stats-breakdown">
              <h3 className="stats-breakdown-title">Referral Status</h3>
              {stats.total_referrals === 0 ? (
                <p className="dashboard-loading">No data yet</p>
              ) : (
                REFERRAL_STATUS_ORDER.map((status) => (
                  <StatBar
                    key={status}
                    label={status}
                    count={stats.referral_status_breakdown[status]}
                    total={stats.total_referrals}
                    color={REFERRAL_STATUS_COLORS[status]}
                  />
                ))
              )}
            </div>
          </div>
        )}

        <div className="dashboard-actions">
          <Link to="/patients/new" className="dashboard-action">
            Add New Patient
          </Link>
          <Link to="/patients" className="dashboard-action">
            View Patients
          </Link>
          <Link to="/facilities" className="dashboard-action">
            Facilities
          </Link>
          <Link to="/follow-ups" className="dashboard-action">
            My Follow-ups
          </Link>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
