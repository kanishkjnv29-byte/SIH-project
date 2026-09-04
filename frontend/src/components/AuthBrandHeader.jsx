import { useTranslation } from 'react-i18next';

function AuthBrandHeader() {
  const { t } = useTranslation();

  return (
    <div className="gs-header">
      <p className="gs-brand">{t('appName')}</p>
      <p className="gs-subtitle">{t('appSubtitle')}</p>
    </div>
  );
}

export default AuthBrandHeader;
