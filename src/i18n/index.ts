import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en/translation.json'
import zh from './locales/zh/translation.json'

i18next
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    resources: {
      en: { translation: en },
      zh: { translation: zh },
    },
  })

export default i18next
