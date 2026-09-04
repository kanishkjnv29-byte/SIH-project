import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthBrandHeader from '../components/AuthBrandHeader';
import LanguageToggle from '../components/LanguageToggle';
import { ROLE_VALUES, ROLE_LABEL_KEYS } from '../i18n/roleLabels';
import { API_BASE_URL } from '../config';
import './Auth.css';

const API_URL = `${API_BASE_URL}/api/auth/signup`;

const INITIAL_FORM = {
  name: '',
  aadhaar_number: '',
  role: '',
  facility_name: '',
  password: '',
  confirmPassword: '',
};

function SignUp() {
  const { t } = useTranslation();
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: null, message: '' });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validate() {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Full name is required';
    if (!/^\d{12}$/.test(form.aadhaar_number)) {
      nextErrors.aadhaar_number = 'Aadhaar number must be exactly 12 digits';
    }
    if (!form.role) nextErrors.role = 'Please select a role';
    if (form.password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters';
    }
    if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }
    return nextErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ type: null, message: '' });

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aadhaar_number: form.aadhaar_number,
          password: form.password,
          name: form.name.trim(),
          role: form.role,
          facility_name: form.facility_name.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ type: 'error', message: data.error || 'Something went wrong. Please try again.' });
        return;
      }

      setStatus({ type: 'success', message: 'Account created! You can now log in.' });
      setForm(INITIAL_FORM);
      setErrors({});
    } catch {
      setStatus({ type: 'error', message: 'Could not reach the server. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="gs-page">
      <div className="gs-container">
        <AuthBrandHeader />
        <div className="gs-card">
          <div className="gs-card-topbar">
            <LanguageToggle />
          </div>
          <h1>Health Worker Sign Up</h1>

          <form onSubmit={handleSubmit} noValidate>
            <div className="gs-field">
              <label htmlFor="name">{t('fullName')}</label>
              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
              />
              {errors.name && <p className="gs-field-error">{errors.name}</p>}
            </div>

            <div className="gs-field">
              <label htmlFor="aadhaar_number">{t('aadhaarNumber')}</label>
              <input
                id="aadhaar_number"
                name="aadhaar_number"
                type="text"
                inputMode="numeric"
                maxLength={12}
                placeholder="12-digit number"
                value={form.aadhaar_number}
                onChange={handleChange}
              />
              {errors.aadhaar_number && <p className="gs-field-error">{errors.aadhaar_number}</p>}
            </div>

            <div className="gs-field">
              <label htmlFor="role">{t('role')}</label>
              <select id="role" name="role" value={form.role} onChange={handleChange}>
                <option value="">Select a role</option>
                {ROLE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {t(ROLE_LABEL_KEYS[value])}
                  </option>
                ))}
              </select>
              {errors.role && <p className="gs-field-error">{errors.role}</p>}
            </div>

            <div className="gs-field">
              <label htmlFor="facility_name">{t('facilityName')}</label>
              <input
                id="facility_name"
                name="facility_name"
                type="text"
                value={form.facility_name}
                onChange={handleChange}
              />
            </div>

            <div className="gs-field">
              <label htmlFor="password">{t('password')}</label>
              <input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
              />
              {errors.password && <p className="gs-field-error">{errors.password}</p>}
            </div>

            <div className="gs-field">
              <label htmlFor="confirmPassword">{t('confirmPassword')}</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange}
              />
              {errors.confirmPassword && <p className="gs-field-error">{errors.confirmPassword}</p>}
            </div>

            {status.type && (
              <p className={status.type === 'success' ? 'gs-success' : 'gs-error'}>
                {status.message}
              </p>
            )}

            <button type="submit" className="gs-button" disabled={submitting}>
              {submitting ? 'Creating account...' : t('signup')}
            </button>
          </form>

          <p className="gs-switch">
            Already have an account? <Link to="/login">{t('login')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
