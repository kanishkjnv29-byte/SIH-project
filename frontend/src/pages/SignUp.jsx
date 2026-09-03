import { useState } from 'react';
import { Link } from 'react-router-dom';
import './AuthForm.css';

const API_URL = 'http://localhost:5000/api/auth/signup';

const ROLES = [
  { value: 'ASHA', label: 'ASHA' },
  { value: 'ANM', label: 'ANM' },
  { value: 'PHC_DOCTOR', label: 'PHC Doctor' },
];

const INITIAL_FORM = {
  name: '',
  aadhaar_number: '',
  role: '',
  facility_name: '',
  password: '',
  confirmPassword: '',
};

function SignUp() {
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
    <div className="auth-page">
      <div className="auth-card">
        <h1>Health Worker Sign Up</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>

          <div className="field">
            <label htmlFor="aadhaar_number">Aadhaar Number</label>
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
            {errors.aadhaar_number && <p className="field-error">{errors.aadhaar_number}</p>}
          </div>

          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" name="role" value={form.role} onChange={handleChange}>
              <option value="">Select a role</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {errors.role && <p className="field-error">{errors.role}</p>}
          </div>

          <div className="field">
            <label htmlFor="facility_name">Facility Name</label>
            <input
              id="facility_name"
              name="facility_name"
              type="text"
              value={form.facility_name}
              onChange={handleChange}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
            />
            {errors.password && <p className="field-error">{errors.password}</p>}
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
            />
            {errors.confirmPassword && <p className="field-error">{errors.confirmPassword}</p>}
          </div>

          {status.type && (
            <p className={status.type === 'success' ? 'form-success' : 'form-error'}>
              {status.message}
            </p>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log In</Link>
        </p>
      </div>
    </div>
  );
}

export default SignUp;
