import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../components/LanguageToggle';
import { ROLE_LABEL_KEYS } from '../i18n/roleLabels';
import './Dashboard.css';

const ME_URL = 'http://localhost:5000/api/auth/me';
const STATS_URL = 'http://localhost:5000/api/stats';
const FOLLOW_UPS_URL = 'http://localhost:5000/api/follow-ups';

const URGENCY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];
const URGENCY_COLOR_VARS = {
  LOW: 'var(--color-urgency-low)',
  MEDIUM: 'var(--color-urgency-medium)',
  HIGH: 'var(--color-urgency-high)',
  EMERGENCY: 'var(--color-urgency-emergency)',
};
const URGENCY_LABEL_KEYS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  EMERGENCY: 'emergency',
};

const REFERRAL_STATUS_ORDER = ['PENDING', 'ACKNOWLEDGED', 'COMPLETED'];
const REFERRAL_STATUS_COLOR_VARS = {
  PENDING: 'var(--color-ink-muted)',
  ACKNOWLEDGED: 'var(--color-primary)',
  COMPLETED: 'var(--color-urgency-low)',
};
const REFERRAL_STATUS_LABEL_KEYS = {
  PENDING: 'pending',
  ACKNOWLEDGED: 'acknowledged',
  COMPLETED: 'completed',
};

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

function formatDueDate(dateStr) {
  if (!dateStr) return '';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString();
}

function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workerError, setWorkerError] = useState('');
  const [stats, setStats] = useState(null);
  const [dueToday, setDueToday] = useState(null);

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

        if (res.status === 401) {
          localStorage.removeItem('token');
          navigate('/login', { replace: true });
          return;
        }

        if (!res.ok) {
          setWorkerError("Couldn't load your info. Try refreshing.");
          return;
        }

        setWorker(await res.json());
      } catch {
        setWorkerError("Couldn't load your info. Try refreshing.");
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

      try {
        const followUpsRes = await fetch(FOLLOW_UPS_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (followUpsRes.ok) {
          const all = await followUpsRes.json();
          const pending = all
            .filter((f) => f.status === 'PENDING')
            .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
            .slice(0, 3);
          setDueToday(pending);
        } else {
          setDueToday([]);
        }
      } catch {
        setDueToday([]);
      }
    })();
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  }

  if (loading) {
    return (
      <div className="gs-dashboard-page">
        <p className="dashboard-loading">Loading...</p>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="gs-dashboard-page">
        <p className="dashboard-error">{workerError || "Couldn't load your info. Try refreshing."}</p>
      </div>
    );
  }

  const totalTriaged = stats
    ? URGENCY_ORDER.reduce((sum, level) => sum + stats.urgency_breakdown[level], 0)
    : 0;

  return (
    <div className="gs-dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div>
            <h1>{worker.name}</h1>
            <p>
              {t(ROLE_LABEL_KEYS[worker.role] || worker.role)} · {worker.facility_name || 'No facility set'}
            </p>
          </div>
          <div className="dashboard-header-actions">
            <LanguageToggle className="language-toggle--on-dark" />
            <button type="button" className="logout-button" onClick={handleLogout}>
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-content">
        <nav className="dashboard-actions">
          <Link to="/patients/new" className="dashboard-action">
            {t('addNewPatient')}
          </Link>
          <Link to="/patients" className="dashboard-action">
            {t('viewPatients')}
          </Link>
          <Link to="/facilities" className="dashboard-action">
            {t('facilities')}
          </Link>
          <Link to="/follow-ups" className="dashboard-action">
            {t('myFollowups')}
          </Link>
        </nav>

        <section className="due-today-section">
          <h2 className="section-title">{t('dueToday')}</h2>

          {dueToday === null && <p className="dashboard-loading">Loading...</p>}

          {dueToday !== null && dueToday.length === 0 && (
            <p className="due-today-empty">{t('nothingDueToday')}</p>
          )}

          {dueToday !== null && dueToday.length > 0 && (
            <>
              <div className="due-today-list">
                {dueToday.map((item) => (
                  <div
                    key={item.id}
                    className="due-today-card"
                    style={{
                      borderLeftColor: item.patient_urgency_level
                        ? URGENCY_COLOR_VARS[item.patient_urgency_level]
                        : 'var(--color-primary)',
                    }}
                  >
                    <span className="due-today-patient">{item.patient_name || 'Unknown patient'}</span>
                    <span className="due-today-facility">
                      {t('referredTo')} {item.facility_name || 'Unknown facility'}
                    </span>
                    <span className="due-today-date">
                      {t('due')} {formatDueDate(item.due_date)}
                    </span>
                  </div>
                ))}
              </div>
              <Link to="/follow-ups" className="due-today-view-all">
                {t('viewAllFollowups')} →
              </Link>
            </>
          )}
        </section>

        {stats && (
          <section className="stats-section">
            <div className="stat-cards">
              <div className="stat-card">
                <span className="stat-card-value">{stats.total_patients}</span>
                <span className="stat-card-label">{t('totalPatients')}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-value">{stats.total_referrals}</span>
                <span className="stat-card-label">{t('totalReferrals')}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-value">{stats.my_pending_followups}</span>
                <span className="stat-card-label">{t('myPendingFollowups')}</span>
              </div>
            </div>

            <div className="stats-breakdown">
              <h3 className="stats-breakdown-title">{t('triageUrgency')}</h3>
              {totalTriaged === 0 ? (
                <p className="dashboard-loading">No data yet</p>
              ) : (
                URGENCY_ORDER.map((level) => (
                  <StatBar
                    key={level}
                    label={t(URGENCY_LABEL_KEYS[level])}
                    count={stats.urgency_breakdown[level]}
                    total={totalTriaged}
                    color={URGENCY_COLOR_VARS[level]}
                  />
                ))
              )}
            </div>

            <div className="stats-breakdown">
              <h3 className="stats-breakdown-title">{t('referralStatus')}</h3>
              {stats.total_referrals === 0 ? (
                <p className="dashboard-loading">No data yet</p>
              ) : (
                REFERRAL_STATUS_ORDER.map((status) => (
                  <StatBar
                    key={status}
                    label={t(REFERRAL_STATUS_LABEL_KEYS[status])}
                    count={stats.referral_status_breakdown[status]}
                    total={stats.total_referrals}
                    color={REFERRAL_STATUS_COLOR_VARS[status]}
                  />
                ))
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
