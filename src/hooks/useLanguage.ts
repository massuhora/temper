import { useEffect, useState, useCallback } from 'react'
import i18n from '@/i18n'
import { db } from '@/db'

export function useLanguage() {
  const [language, setLanguageState] = useState(i18n.language || 'en')

  useEffect(() => {
    const init = async () => {
      const settings = await db.getSettings()
      const lang = settings?.language || 'en'
      if (lang !== i18n.language) {
        await i18n.changeLanguage(lang)
      }
      setLanguageState(lang)
      if (!settings?.language) {
        await db.updateSettings({ language: 'en' })
      }
    }
    init()
  }, [])

  const setLanguage = useCallback(async (lang: string) => {
    await i18n.changeLanguage(lang)
    setLanguageState(lang)
    await db.updateSettings({ language: lang })
  }, [])

  return { language, setLanguage }
}
