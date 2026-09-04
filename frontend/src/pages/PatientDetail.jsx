import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import UrgencyBadge from '../components/UrgencyBadge';
import ReferralStatusBadge from '../components/ReferralStatusBadge';
import LanguageToggle from '../components/LanguageToggle';
import { FACILITY_TYPE_LABELS } from '../constants/facilityTypes';
import { API_BASE_URL } from '../config';
import './AuthForm.css';
import './Dashboard.css';
import './Patients.css';

const PATIENTS_URL = `${API_BASE_URL}/api/patients`;
const FACILITIES_URL = `${API_BASE_URL}/api/facilities`;
const REFERRALS_URL = `${API_BASE_URL}/api/referrals`;

function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString();
}

function formatDateOnly(dateStr) {
  if (!dateStr) return '';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString();
}

function PatientDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState('');
  const [triaging, setTriaging] = useState(false);
  const [triageError, setTriageError] = useState('');
  const [schemeChecking, setSchemeChecking] = useState(false);
  const [schemeError, setSchemeError] = useState('');

  const [facilities, setFacilities] = useState([]);
  const [referrals, setReferrals] = useState(null);
  const [referralsError, setReferralsError] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [reason, setReason] = useState('');
  const [referring, setReferring] = useState(false);
  const [referralError, setReferralError] = useState('');
  const [referralSuccess, setReferralSuccess] = useState('');
  const [referralWarning, setReferralWarning] = useState('');
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [statusUpdateError, setStatusUpdateError] = useState({});

  const [reports, setReports] = useState(null);
  const [reportsError, setReportsError] = useState('');
  const [reportFile, setReportFile] = useState(null);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [reportError, setReportError] = useState('');
  const reportFileInputRef = useRef(null);

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
    setReferralsError('');
    try {
      const res = await fetch(`${PATIENTS_URL}/${id}/referrals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setReferralsError("Couldn't load referral history — try refreshing.");
        return;
      }
      setReferrals(await res.json());
    } catch {
      setReferralsError("Couldn't load referral history — try refreshing.");
    }
  }

  async function loadReports(token) {
    setReportsError('');
    try {
      const res = await fetch(`${PATIENTS_URL}/${id}/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setReportsError("Couldn't load reports — try refreshing.");
        return;
      }
      setReports(await res.json());
    } catch {
      setReportsError("Couldn't load reports — try refreshing.");
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    loadPatient(token);
    loadFacilities(token);
    loadReferrals(token);
    loadReports(token);
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

  async function handleSchemeCheck() {
    const token = getToken();
    if (!token) return;

    setSchemeChecking(true);
    setSchemeError('');
    try {
      const res = await fetch(`${PATIENTS_URL}/${id}/scheme-check`, {
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
        setSchemeError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setPatient(data);
    } catch {
      setSchemeError('Could not reach the server. Please try again.');
    } finally {
      setSchemeChecking(false);
    }
  }

  async function handleReferralSubmit(e) {
    e.preventDefault();
    setReferralError('');
    setReferralSuccess('');
    setReferralWarning('');

    if (!selectedFacilityId) {
      setReferralError('Please select a facility');
      return;
    }
    if (!reason.trim()) {
      setReferralError('Reason for referral is required');
      return;
    }
    if (reason.trim().length > 1000) {
      setReferralError('Reason must be 1000 characters or fewer');
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
      if (data.followup_created === false) {
        setReferralWarning(
          'Referral sent, but the automatic follow-up task failed to create — please add one manually.'
        );
      }
      setSelectedFacilityId('');
      setReason('');
      loadReferrals(token);
    } catch {
      setReferralError('Could not reach the server. Please try again.');
    } finally {
      setReferring(false);
    }
  }

  async function handleUpdateReferralStatus(referralId, newStatus) {
    const token = getToken();
    if (!token) return;

    setUpdatingStatusId(referralId);
    setStatusUpdateError((prev) => ({ ...prev, [referralId]: '' }));
    try {
      const res = await fetch(`${REFERRALS_URL}/${referralId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setStatusUpdateError((prev) => ({ ...prev, [referralId]: data.error || 'Something went wrong. Please try again.' }));
        return;
      }

      setReferrals((prev) => prev.map((r) => (r.id === referralId ? { ...r, ...data } : r)));
    } catch {
      setStatusUpdateError((prev) => ({ ...prev, [referralId]: 'Could not reach the server. Please try again.' }));
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function handleReportUpload(e) {
    e.preventDefault();
    setReportError('');

    if (!reportFile) {
      setReportError('Please choose an image to upload');
      return;
    }

    const token = getToken();
    if (!token) return;

    setUploadingReport(true);
    try {
      const formData = new FormData();
      formData.append('report', reportFile);

      const res = await fetch(`${PATIENTS_URL}/${id}/reports`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setReportError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setReports((prev) => [data, ...(prev || [])]);
      setReportFile(null);
      if (reportFileInputRef.current) reportFileInputRef.current.value = '';
    } catch {
      setReportError('Could not reach the server. Please try again.');
    } finally {
      setUploadingReport(false);
    }
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="patients-container">
          <div className="view-patients-topbar">
            <LanguageToggle />
          </div>
          <Link to="/patients" className="back-link">
            ← {t('backToPatients')}
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
        <div className="view-patients-topbar">
          <LanguageToggle />
        </div>
        <Link to="/patients" className="back-link">
          ← {t('backToPatients')}
        </Link>
        <h1>{patient.name}</h1>

        <div className="patient-info-grid">
          <div>
            <strong>{t('name')}:</strong> {patient.name}
          </div>
          <div>
            <strong>{t('age')}:</strong> {patient.age ?? '-'}
          </div>
          <div>
            <strong>{t('gender')}:</strong> {patient.gender || '-'}
          </div>
          <div>
            <strong>{t('phone')}:</strong> {patient.phone || '-'}
          </div>
          <div>
            <strong>{t('village')}:</strong> {patient.village || '-'}
          </div>
          <div>
            <strong>{t('addedBy')}:</strong> {patient.created_by_name || '-'}
          </div>
          <div title={t('abhaIdNote')}>
            <strong>{t('abhaIdDemo')}:</strong>{' '}
            <span className="abha-id-value">{patient.abha_id || '-'}</span>
          </div>
        </div>
        <p className="patient-info-note">{t('abhaIdNote')}</p>

        <div className="patient-symptoms">
          <strong>{t('symptoms')}</strong>
          <p>{patient.symptoms}</p>
        </div>

        <div className="triage-section">
          {patient.urgency_level ? (
            <>
              <UrgencyBadge level={patient.urgency_level} />
              <p className="triage-reason">{patient.triage_reason}</p>
              <p className="triage-note">{t('aiSuggestedDisclaimer')}</p>
            </>
          ) : (
            <>
              <button type="button" className="primary-button" onClick={handleTriage} disabled={triaging}>
                {triaging ? 'Running AI Triage...' : t('runAiTriage')}
              </button>
              {triageError && <p className="form-error">{triageError}</p>}
            </>
          )}
        </div>

        {patient.urgency_level && (
          <div className="scheme-check-section">
            <h2>{t('govSupportTitle')}</h2>

            {patient.scheme_suggestion ? (
              <div className="scheme-suggestion-card">
                <p className="scheme-suggestion-text">{patient.scheme_suggestion}</p>
                <p className="triage-note">{t('aiSuggestedDisclaimer')}</p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleSchemeCheck}
                  disabled={schemeChecking}
                >
                  {schemeChecking ? 'Checking...' : t('checkSchemeBenefits')}
                </button>
                {schemeError && <p className="form-error">{schemeError}</p>}
              </>
            )}
          </div>
        )}

        <div className="referral-section">
          <h2>{t('referToFacility')}</h2>

          <form onSubmit={handleReferralSubmit} noValidate>
            <div className="field">
              <label htmlFor="facility">{t('facility')}</label>
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
              <label htmlFor="reason">{t('reasonForReferral')}</label>
              <textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {referralError && <p className="form-error">{referralError}</p>}
            {referralSuccess && <p className="form-success">{referralSuccess}</p>}
            {referralWarning && <p className="form-warning">{referralWarning}</p>}

            <button type="submit" className="primary-button" disabled={referring}>
              {referring ? 'Sending...' : t('sendReferral')}
            </button>
          </form>
        </div>

        <div className="referral-history">
          <h2>{t('referralHistory')}</h2>

          {referralsError && <p className="form-error">{referralsError}</p>}
          {!referralsError && referrals === null && <p className="dashboard-loading">Loading...</p>}
          {!referralsError && referrals !== null && referrals.length === 0 && (
            <p className="dashboard-loading">No referrals yet.</p>
          )}
          {!referralsError && referrals !== null && referrals.length > 0 && (
            <ul className="referral-list">
              {referrals.map((referral) => (
                <li key={referral.id} className="referral-list-item">
                  <div className="referral-list-header">
                    <span className="referral-list-facility">
                      {referral.facility_name} ({FACILITY_TYPE_LABELS[referral.facility_type] || referral.facility_type})
                    </span>
                    <span className="referral-status-group">
                      <span className="referral-status-label">{t('status')}:</span>
                      <ReferralStatusBadge status={referral.status} />
                    </span>
                  </div>
                  <p className="referral-list-reason">
                    {t('reason')}: {referral.reason}
                  </p>
                  {referral.referred_by_name && (
                    <p className="referral-list-referred-by">
                      {t('referredBy')}: {referral.referred_by_name}
                    </p>
                  )}
                  <span className="referral-list-date">{formatDate(referral.created_at)}</span>

                  {referral.previous_referral_id && (
                    <div className="referral-chain-row">
                      <span className="chain-update-tag">{t('chainUpdate')}</span>
                      <p className="referral-followup-note">{t('followOnNote')}</p>
                    </div>
                  )}

                  {referral.follow_up_status === 'PENDING' && (
                    <p className="referral-followup-note">
                      {t('followUpDue')} {formatDateOnly(referral.follow_up_due_date)}
                    </p>
                  )}
                  {referral.follow_up_status === 'COMPLETED' && (
                    <p className="referral-followup-note">
                      {t('followedUpOn')} {formatDate(referral.follow_up_completed_at)}:{' '}
                      {referral.follow_up_notes || 'No notes added.'}
                    </p>
                  )}

                  {referral.status !== 'COMPLETED' && (
                    <div className="referral-status-actions">
                      {referral.status === 'PENDING' && (
                        <button
                          type="button"
                          disabled={updatingStatusId === referral.id}
                          onClick={() => handleUpdateReferralStatus(referral.id, 'ACKNOWLEDGED')}
                        >
                          Mark Acknowledged
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={updatingStatusId === referral.id}
                        onClick={() => handleUpdateReferralStatus(referral.id, 'COMPLETED')}
                      >
                        Mark Completed
                      </button>
                    </div>
                  )}
                  {statusUpdateError[referral.id] && (
                    <p className="form-error">{statusUpdateError[referral.id]}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="reports-section">
          <h2>{t('uploadReportTitle')}</h2>

          <form onSubmit={handleReportUpload} noValidate>
            <div className="field">
              <label htmlFor="report-file">Image</label>
              <input
                id="report-file"
                ref={reportFileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                onChange={(e) => setReportFile(e.target.files[0] || null)}
              />
            </div>

            {reportError && <p className="form-error">{reportError}</p>}

            <button type="submit" className="primary-button" disabled={uploadingReport}>
              {uploadingReport ? 'Uploading & Analyzing...' : t('uploadAndAnalyze')}
            </button>
          </form>
        </div>

        <div className="reports-list">
          <h2>{t('yourReports')}</h2>

          {reportsError && <p className="form-error">{reportsError}</p>}
          {!reportsError && reports === null && <p className="dashboard-loading">Loading...</p>}
          {!reportsError && reports !== null && reports.length === 0 && (
            <p className="dashboard-loading">{t('noReportsYet')}</p>
          )}
          {!reportsError && reports !== null && reports.length > 0 && (
            <div className="report-card-list">
              {reports.map((report) => (
                <div key={report.id} className="report-card">
                  {report.signed_url && (
                    <img src={report.signed_url} alt="Uploaded report or prescription" className="report-image" />
                  )}
                  <div className="report-card-body">
                    <p className="report-summary">{report.ai_summary}</p>
                    <p className="triage-note">{t('aiSuggestedDisclaimer')}</p>
                    <span className="referral-list-date">{formatDate(report.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientDetail;
