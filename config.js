// Configure administrator Telegram IDs here; do not commit private IDs to a public repository.
// Frontend checks only hide the UI. Production authorization must verify Telegram initData on the backend.
window.TECHNIX_CONFIG = {
  DEV_MODE: false,
  ADMIN_IDS: [],
  DEFAULT_CONFIG: {
    version: 1,
    activePhase: 1,
    features: {
      clicker: true, rigBuilder: true, wallet: true, referrals: true,
      leaderboard: true, dailyBonus: true, tasks: true, events: true,
      posts: true, notifications: true
    },
    animations: {
      tokens: true, circuitPulse: true, chipPulse: true, partGlow: true,
      toastFx: true, reduceMotion: false
    },
    events: [{
      id: 'community-sprint',
      title: 'Cyber Week — Community Sprint',
      desc: 'Wykonuj zadania społecznościowe, zbieraj gwiazdki i odblokuj limitowaną odznakę.',
      reward: 50,
      active: true,
      startAt: '',
      endAt: ''
    }],
    tasks: [
      { id: 'channel', title: 'Aktywność w kanale', reward: 25, label: 'Kanał', active: true, order: 1, type: 'social' },
      { id: 'group', title: 'Wspólnota: post do grupy', reward: 40, label: 'Grupa', active: true, order: 2, type: 'social' },
      { id: 'mining', title: 'Mining boost', reward: 60, label: 'TP', active: true, order: 3, type: 'game' },
      { id: 'referral', title: 'Referral invite', reward: 100, label: 'Referral', active: true, order: 4, type: 'referral' }
    ],
    posts: [
      { id: 'launch', author: 'TechnixPro', text: 'Nowa wersja systemu nagród trafiła do mini app. Włącz tryb aktywności i zbieraj gwiazdki.', media: '', link: '', pinned: false, visible: true, time: '8 min temu' },
      { id: 'mining', author: 'Core Team', text: 'Mining Engine osiągnął 64% wydajności. Kolejny etap odblokowuje automatyczne pakiety TP.', media: '', link: '', pinned: false, visible: true, time: '23 min temu' }
    ],
    notifications: [],
    statusBanner: { text: 'Core Engine Online', level: 'ok', visible: true },
    presets: [
      { id: 'phase-1-stealth', name: 'Faza 1 – Stealth', config: { activePhase: 1 } },
      { id: 'phase-2-expansion', name: 'Faza 2 – Rozszerzenie', config: { activePhase: 2 } },
      { id: 'phase-3-launch', name: 'Faza 3 – Launch', config: { activePhase: 3 } },
      { id: 'event-weekend', name: 'Event Weekend', config: { activePhase: 2 } },
      { id: 'welcome-pack', name: 'Welcome pack', config: { activePhase: 1 } }
    ]
  }
};
