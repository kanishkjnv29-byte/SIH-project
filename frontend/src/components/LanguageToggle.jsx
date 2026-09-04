import { useTranslation } from 'react-i18next';
import './LanguageToggle.css';

function LanguageToggle({ className = '' }) {
  const { i18n } = useTranslation();

  function setLanguage(lng) {
    if (i18n.language !== lng) {
      i18n.changeLanguage(lng);
    }
  }

  return (
    <div className={`language-toggle${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={`language-toggle-option${i18n.language === 'en' ? ' active' : ''}`}
        onClick={() => setLanguage('en')}
      >
        EN
      </button>
      <span className="language-toggle-divider">|</span>
      <button
        type="button"
        className={`language-toggle-option${i18n.language === 'hi' ? ' active' : ''}`}
        onClick={() => setLanguage('hi')}
      >
        हिं
      </button>
    </div>
  );
}

export default LanguageToggle;
