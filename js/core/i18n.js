export const I18N = {
  current: 'en',
  strings: {
    en: {
      sound: 'SOUND',
      night: 'NIGHT',
      day: 'DAY',
      deploy: 'PLAY',
      pause: 'PAUSE',
      forfeit: 'QUIT',
      resume: 'RESUME',
      restart: 'RESTART',
      abort: 'CANCEL',
      victory: 'YOU WON',
      defeat: 'GAME OVER',
      draw: 'MATCH DRAW',
      level: 'LEVEL'
    },
    hi: {
      sound: 'आवाज़',
      night: 'रात',
      day: 'दिन',
      deploy: 'खेलें',
      pause: 'रोकें',
      forfeit: 'छोड़ें',
      resume: 'जारी रखें',
      restart: 'फिर से',
      abort: 'रद्द करें',
      victory: 'जीत गए!',
      defeat: 'हार गए',
      draw: 'मैच बराबरी',
      level: 'लेवल'
    }
  },

  setLang(lang) {
    if (this.strings[lang]) this.current = lang;
  },

  t(key) {
    return this.strings[this.current]?.[key] || this.strings.en[key] || key;
  }
};