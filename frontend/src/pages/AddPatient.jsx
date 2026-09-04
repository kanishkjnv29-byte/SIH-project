import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../components/LanguageToggle';
import './AuthForm.css';
import './Dashboard.css';

const PATIENTS_URL = 'http://localhost:5000/api/patients';

const SpeechRecognitionImpl =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

const VOICE_LANGUAGES = [
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'mr-IN', label: 'Marathi' },
  { value: 'en-IN', label: 'English' },
];

const INITIAL_FORM = {
  name: '',
  age: '',
  gender: '',
  phone: '',
  village: '',
  symptoms: '',
};

function AddPatient() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const recognitionRef = useRef(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: null, message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('hi-IN');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleMicClick() {
    if (!SpeechRecognitionImpl) return;

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = voiceLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setForm((prev) => ({
        ...prev,
        symptoms: prev.symptoms ? `${prev.symptoms} ${transcript}` : transcript,
      }));
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function validate() {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';

    if (!form.symptoms.trim()) {
      nextErrors.symptoms = 'Symptoms are required';
    } else if (form.symptoms.trim().length > 1000) {
      nextErrors.symptoms = 'Symptoms must be 1000 characters or fewer';
    }

    if (form.age !== '') {
      const ageNum = Number(form.age);
      if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 120) {
        nextErrors.age = 'Age must be a whole number between 0 and 120';
      }
    }

    if (form.phone.trim() !== '' && !/^\d{10}$/.test(form.phone.trim())) {
      nextErrors.phone = 'Phone number must be exactly 10 digits';
    }

    return nextErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ type: null, message: '' });

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(PATIENTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          age: form.age ? Number(form.age) : null,
          gender: form.gender || null,
          phone: form.phone.trim(),
          village: form.village.trim(),
          symptoms: form.symptoms.trim(),
        }),
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setStatus({ type: 'error', message: data.error || 'Something went wrong. Please try again.' });
        return;
      }

      setStatus({ type: 'success', message: t('patientAdded') });
      setTimeout(() => navigate('/patients'), 1200);
    } catch {
      setStatus({ type: 'error', message: 'Could not reach the server. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="form-topbar">
          <LanguageToggle />
        </div>
        <Link to="/dashboard" className="back-link">
          ← {t('backToDashboard')}
        </Link>
        <h1>Add New Patient</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" value={form.name} onChange={handleChange} />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>

          <div className="field">
            <label htmlFor="age">{t('age')}</label>
            <input id="age" name="age" type="number" min="0" max="120" value={form.age} onChange={handleChange} />
            {errors.age && <p className="field-error">{errors.age}</p>}
          </div>

          <div className="field">
            <label htmlFor="gender">{t('gender')}</label>
            <select id="gender" name="gender" value={form.gender} onChange={handleChange}>
              <option value="">Select gender</option>
              <option value="Male">{t('male')}</option>
              <option value="Female">{t('female')}</option>
              <option value="Other">{t('other')}</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="phone">{t('phone')}</label>
            <input
              id="phone"
              name="phone"
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={handleChange}
            />
            {errors.phone && <p className="field-error">{errors.phone}</p>}
          </div>

          <div className="field">
            <label htmlFor="village">{t('village')}</label>
            <input id="village" name="village" type="text" value={form.village} onChange={handleChange} />
          </div>

          <div className="field">
            <label htmlFor="symptoms">{t('symptoms')}</label>
            <div className="symptoms-input-row">
              <textarea
                id="symptoms"
                name="symptoms"
                rows={4}
                value={form.symptoms}
                onChange={handleChange}
              />
              {SpeechRecognitionImpl && (
                <>
                  <select
                    className="mic-lang-select"
                    value={voiceLang}
                    onChange={(e) => setVoiceLang(e.target.value)}
                    disabled={isListening}
                    title={t('voiceLanguage')}
                    aria-label={t('voiceLanguage')}
                  >
                    {VOICE_LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={`mic-button${isListening ? ' listening' : ''}`}
                    onClick={handleMicClick}
                    title={isListening ? 'Stop recording' : 'Record symptoms by voice'}
                  >
                    {isListening ? '● ' : '🎤'}
                  </button>
                </>
              )}
            </div>
            {errors.symptoms && <p className="field-error">{errors.symptoms}</p>}
          </div>

          {status.type && (
            <p className={status.type === 'success' ? 'form-success' : 'form-error'}>
              {status.message}
            </p>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : t('addPatientButton')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddPatient;
