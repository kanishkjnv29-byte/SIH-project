import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../components/LanguageToggle';
import UrgencyBadge from '../components/UrgencyBadge';
import ReferralStatusBadge from '../components/ReferralStatusBadge';
import { FACILITY_TYPE_LABELS } from '../constants/facilityTypes';
import './Dashboard.css';
import './Patients.css';
import './PatientRecord.css';

const PATIENT_PORTAL_URL = 'http://localhost:5000/api/patient-portal';

const REFERRAL_STATUS_COLOR_VARS = {
  PENDING: 'var(--color-ink-muted)',
  ACKNOWLEDGED: 'var(--color-primary)',
  COMPLETED: 'var(--color-urgency-low)',
};

function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString();
}

function formatDateOnly(dateStr) {
  if (!dateStr) return '';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString();
}

function PatientRecord() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { patientId } = useParams();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [schemeChecking, setSchemeChecking] = useState(false);
  const [schemeError, setSchemeError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('patient_token');
    if (!token) {
      navigate('/patient', { replace: true });
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${PATIENT_PORTAL_URL}/${patientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          localStorage.removeItem('patient_token');
          navigate('/patient', { replace: true });
          return;
        }

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || t('recordNotFound'));
          return;
        }

        setRecord(data);
      } catch {
        setError('Could not reach the server. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, navigate, t]);

  function handleExit() {
    localStorage.removeItem('patient_token');
    navigate('/patient', { replace: true });
  }

  async function handleSchemeCheck() {
    const token = localStorage.getItem('patient_token');
    if (!token) {
      navigate('/patient', { replace: true });
      return;
    }

    setSchemeChecking(true);
    setSchemeError('');
    try {
      const res = await fetch(`${PATIENT_PORTAL_URL}/${patientId}/scheme-check`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('patient_token');
        navigate('/patient', { replace: true });
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setSchemeError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setRecord((prev) => ({
        ...prev,
        patient: {
          ...prev.patient,
          scheme_suggestion: data.scheme_suggestion,
          scheme_checked_at: data.scheme_checked_at,
        },
      }));
    } catch {
      setSchemeError('Could not reach the server. Please try again.');
    } finally {
      setSchemeChecking(false);
    }
  }

  if (loading) {
    return (
      <div className="gs-dashboard-page">
        <p className="dashboard-loading">Loading...</p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="gs-dashboard-page">
        <p className="dashboard-error">{error || t('recordNotFound')}</p>
      </div>
    );
  }

  const { patient, referrals, reports } = record;
  const headerMeta = [patient.age != null ? `${t('age')} ${patient.age}` : null, patient.village || null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="gs-dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div>
            <h1>{patient.name}</h1>
            {headerMeta && <p>{headerMeta}</p>}
            {patient.abha_id && (
              <>
                <p title={t('abhaIdNote')}>
                  {t('abhaIdLabel')}: {patient.abha_id}
                </p>
                <p className="patient-record-abha-note">{t('abhaIdNote')}</p>
              </>
            )}
          </div>
          <div className="dashboard-header-actions">
            <LanguageToggle className="language-toggle--on-dark" />
            <button type="button" className="logout-button" onClick={handleExit}>
              {t('exit')}
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-content patient-record-content">
        <section className="patient-record-section">
          <h2 className="section-title">{t('yourVisit')}</h2>

          {referrals.length === 0 ? (
            <p className="dashboard-loading">{t('nothingHereYet')}</p>
          ) : (
            <div className="visit-timeline">
              {referrals.map((referral) => (
                <div key={referral.id} className="visit-timeline-item">
                  <span
                    className="visit-timeline-marker"
                    style={{ borderColor: REFERRAL_STATUS_COLOR_VARS[referral.status] || 'var(--color-primary)' }}
                  />
                  <div className="visit-timeline-card">
                    <div className="visit-timeline-card-header">
                      <p className="visit-timeline-text">
                        {t('youWereReferredTo')}{' '}
                        <strong>{referral.facility_name || t('unknownFacility')}</strong>
                        {referral.facility_type
                          ? ` (${FACILITY_TYPE_LABELS[referral.facility_type] || referral.facility_type})`
                          : ''}
                      </p>
                      <ReferralStatusBadge status={referral.status} />
                    </div>
                    <span className="referral-list-date">{formatDate(referral.created_at)}</span>

                    {referral.follow_up_status === 'PENDING' && (
                      <p className="visit-timeline-followup">
                        {t('followUpDueOn')} {formatDateOnly(referral.follow_up_due_date)}
                      </p>
                    )}
                    {referral.follow_up_status === 'COMPLETED' && (
                      <p className="visit-timeline-followup">
                        {t('followUpCompletedOn')} {formatDate(referral.follow_up_completed_at)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="patient-record-section">
          <h2 className="section-title">{t('healthCheck')}</h2>

          {patient.urgency_level ? (
            <div className="health-check-card">
              <div className="health-check-top">
                <h3 className="health-check-title">{t('healthCheckHeading')}</h3>
                <UrgencyBadge level={patient.urgency_level} />
              </div>
              {patient.triage_reason && <p className="health-check-reason">{patient.triage_reason}</p>}
              <div className="health-check-guidance">
                <p>{t('healthCheckGuidance')}</p>
              </div>
            </div>
          ) : (
            <p className="dashboard-loading">{t('nothingHereYet')}</p>
          )}
        </section>

        <section className="patient-record-section">
          <h2 className="section-title">{t('schemeSectionTitle')}</h2>

          {!patient.urgency_level ? (
            <p className="dashboard-loading">{t('schemeNotTriagedMessage')}</p>
          ) : patient.scheme_suggestion ? (
            <div className="scheme-suggestion-card">
              <p className="scheme-suggestion-text">{patient.scheme_suggestion}</p>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="scheme-check-button"
                onClick={handleSchemeCheck}
                disabled={schemeChecking}
              >
                {schemeChecking ? t('schemeChecking') : t('schemeCheckButton')}
              </button>
              {schemeError && <p className="patient-record-error">{schemeError}</p>}
            </>
          )}
        </section>

        <section className="patient-record-section">
          <h2 className="section-title">{t('yourReports')}</h2>

          {reports.length === 0 ? (
            <p className="dashboard-loading">{t('nothingHereYet')}</p>
          ) : (
            <div className="report-card-list">
              {reports.map((report) => (
                <div key={report.id} className="report-card">
                  {report.signed_url && (
                    <img src={report.signed_url} alt="" className="report-image" />
                  )}
                  <div className="report-card-body">
                    <p className="report-summary">{report.ai_summary}</p>
                    <p className="triage-note">{t('aiConfirmNote')}</p>
                    <span className="referral-list-date">{formatDate(report.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default PatientRecord;
