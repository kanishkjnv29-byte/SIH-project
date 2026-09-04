import { useTranslation } from 'react-i18next';

function AuthBrandHeader({ subtitle }) {
  const { t } = useTranslation();

  return (
    <div className="gs-header">
      <p className="gs-brand">{t('appName')}</p>
      <p className="gs-subtitle">{subtitle || t('appSubtitle')}</p>
    </div>
  );
}

export default AuthBrandHeader;
