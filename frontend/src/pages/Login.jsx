import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthBrandHeader from '../components/AuthBrandHeader';
import LanguageToggle from '../components/LanguageToggle';
import './Auth.css';

const LOGIN_URL = 'http://localhost:5000/api/auth/login';
const VERIFY_OTP_URL = 'http://localhost:5000/api/auth/verify-otp';

function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleCredentialsSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaar_number: aadhaarNumber, password }),
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
        body: JSON.stringify({ aadhaar_number: aadhaarNumber, otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      localStorage.setItem('token', data.token);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'otp') {
    return (
      <div className="gs-page">
        <div className="gs-container">
          <AuthBrandHeader />
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
        <AuthBrandHeader />
        <div className="gs-card">
          <div className="gs-card-topbar">
            <LanguageToggle />
          </div>
          <h1>Health Worker Log In</h1>

          <form onSubmit={handleCredentialsSubmit} noValidate>
            <div className="gs-field">
              <label htmlFor="aadhaar_number">{t('aadhaarNumber')}</label>
              <input
                id="aadhaar_number"
                name="aadhaar_number"
                type="text"
                inputMode="numeric"
                maxLength={12}
                placeholder="12-digit number"
                value={aadhaarNumber}
                onChange={(e) => setAadhaarNumber(e.target.value)}
              />
            </div>

            <div className="gs-field">
              <label htmlFor="password">{t('password')}</label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="gs-error">{error}</p>}

            <button type="submit" className="gs-button" disabled={submitting}>
              {submitting ? 'Logging in...' : t('login')}
            </button>
          </form>

          <p className="gs-switch">
            Don't have an account? <Link to="/signup">{t('signup')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
