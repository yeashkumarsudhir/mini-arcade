/**
 * js/core/i18n.js
 * Zero-Dependency String Localization Table (EN / HI)
 */
export const I18N = {
  current: 'en',
  strings: {
    en: {
      sound: 'SOUND',
      night: 'NIGHT',
      day: 'DAY',
      deploy: 'DEPLOY',
      pause: 'PAUSE',
      forfeit: 'FORFEIT',
      resume: 'RESUME',
      restart: 'RESTART',
      abort: 'ABORT',
      victory: 'VICTORY SECURED',
      defeat: 'MISSION FAILED',
      draw: 'STALEMATE DRAW',
      level: 'LEVEL'
    },
    hi: {
      sound: 'ध्वनि',
      night: 'रात्रि',
      day: 'दिन',
      deploy: 'आरंभ',
      pause: 'रोकें',
      forfeit: 'त्यागें',
      resume: 'जारी रखें',
      restart: 'पुनः आरंभ',
      abort: 'रद्द करें',
      victory: 'विजय प्राप्त',
      defeat: 'मिशन असफल',
      draw: 'मुकाबला बराबरी',
      level: 'स्तर'
    }
  },

  setLang(lang) {
    if (this.strings[lang]) this.current = lang;
  },

  t(key) {
    return this.strings[this.current]?.[key] || this.strings.en[key] || key;
  }
};