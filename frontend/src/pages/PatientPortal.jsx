import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthBrandHeader from '../components/AuthBrandHeader';
import LanguageToggle from '../components/LanguageToggle';
import './Auth.css';

const REQUEST_OTP_URL = 'http://localhost:5000/api/patient-auth/request-otp';
const VERIFY_OTP_URL = 'http://localhost:5000/api/patient-auth/verify-otp';

function PatientPortal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'picker'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [patients, setPatients] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handlePhoneSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(REQUEST_OTP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setDemoOtp(data.demo_otp);
      setStep('otp');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(VERIFY_OTP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      localStorage.setItem('patient_token', data.token);

      if (data.patients.length === 1) {
        navigate(`/patient/${data.patients[0].id}`, { replace: true });
        return;
      }

      setPatients(data.patients);
      setStep('picker');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'picker') {
    return (
      <div className="gs-page">
        <div className="gs-container">
          <AuthBrandHeader subtitle={t('checkYourHealthRecord')} />
          <div className="gs-card">
            <div className="gs-card-topbar">
              <LanguageToggle />
            </div>
            <h1>{t('whoseRecord')}</h1>

            <div className="gs-picker-list">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  className="gs-picker-item"
                  onClick={() => navigate(`/patient/${patient.id}`)}
                >
                  <span className="gs-picker-name">{patient.name}</span>
                  <span className="gs-picker-meta">
                    {patient.age != null ? `${t('age')}: ${patient.age}` : null}
                    {patient.age != null && patient.village ? ' · ' : null}
                    {patient.village || null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="gs-page">
        <div className="gs-container">
          <AuthBrandHeader subtitle={t('checkYourHealthRecord')} />
          <div className="gs-card">
            <div className="gs-card-topbar">
              <LanguageToggle />
            </div>
            <h1>{t('enterVerificationCode')}</h1>

            <div className="gs-demo-box">
              <p className="gs-demo-text">{t('demoModeNotice')}</p>
              <span className="gs-demo-code">{demoOtp}</span>
            </div>

            <form onSubmit={handleOtpSubmit} noValidate>
              <div className="gs-field">
                <label htmlFor="otp">Verification Code</label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>

              {error && <p className="gs-error">{error}</p>}

              <button type="submit" className="gs-button" disabled={submitting}>
                {submitting ? 'Verifying...' : t('verify')}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gs-page">
      <div className="gs-container">
        <AuthBrandHeader subtitle={t('checkYourHealthRecord')} />
        <div className="gs-card">
          <div className="gs-card-topbar">
            <LanguageToggle />
          </div>
          <h1>{t('checkYourHealthRecord')}</h1>

          <form onSubmit={handlePhoneSubmit} noValidate>
            <div className="gs-field">
              <label htmlFor="phone">{t('phone')}</label>
              <input
                id="phone"
                name="phone"
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {error && <p className="gs-error">{error}</p>}

            <button type="submit" className="gs-button" disabled={submitting}>
              {submitting ? 'Sending...' : t('sendCode')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default PatientPortal;
