// Feature flags and constants (no secrets here).
(typeof window !== "undefined" ? window : globalThis).TP_CONFIG = Object.freeze({
  STORAGE_VERSION: 2,
  STORAGE_PREFIX: 'technixpro',
  FEATURES: Object.freeze({ chat: true, admin: true, wallet: true, referrals: true, tonKeeper: true, realtime: true }),
  XP_TIMER_HOURS: 4,
  XP_TIMER_REWARD: 20,
  DAILY_REWARD_XP: 10,
  CHAT_POLL_MS: 4000,
  CHAT_MAX_LENGTH: 500,
  POST_MAX_LENGTH: 2000,
  ONLINE_WINDOW_MS: 120000,
  AVATAR_MAX_BYTES: 2 * 1024 * 1024,
  LEVELS: Object.freeze([
    { level: 1, name: 'Novice', xp: 0, icon: 'fa-seedling' },
    { level: 2, name: 'Apprentice', xp: 500, icon: 'fa-star' },
    { level: 3, name: 'Technician', xp: 1500, icon: 'fa-medal' },
    { level: 4, name: 'Expert', xp: 3500, icon: 'fa-award' },
    { level: 5, name: 'Master', xp: 7000, icon: 'fa-crown' },
    { level: 6, name: 'Legend', xp: 12000, icon: 'fa-gem' },
    { level: 7, name: 'Titan', xp: 20000, icon: 'fa-dragon' }
  ]),
  TASKS: Object.freeze([
    { id: 'earn_xp', title: 'Zdobądź 50 XP', goal: 50, rewardXp: 0, rewardStars: 10, metric: 'xp_total' },
    { id: 'invite_3', title: 'Zaproś 3 znajomych', goal: 3, rewardXp: 0, rewardStars: 50, metric: 'referral_count' },
    { id: 'reach_lvl3', title: 'Osiągnij poziom 3', goal: 3, rewardXp: 0, rewardStars: 100, metric: 'level' },
    { id: 'complete_10', title: 'Wykonaj 10 zadań', goal: 10, rewardXp: 0, rewardStars: 200, metric: 'tasks_completed' },
    { id: 'top_10', title: 'Wejdź do Top 10 rankingu', goal: 1, rewardXp: 0, rewardStars: 500, metric: 'in_top10' }
  ]),
  REFERRAL_MILESTONES: Object.freeze([
    { count: 10, rewardXp: 100 },
    { count: 20, rewardXp: 250 },
    { count: 50, rewardXp: 1000 }
  ]),
  RIG_PARTS: Object.freeze([
    { key: 'desk', title: 'Biurko', price: 0 },
    { key: 'case', title: 'Obudowa', price: 25 },
    { key: 'ram', title: 'Pamięć RAM', price: 20 },
    { key: 'gpu', title: 'Karta graficzna', price: 40 },
    { key: 'monitor', title: 'Monitor', price: 30 },
    { key: 'keyboard', title: 'Klawiatura', price: 15 },
    { key: 'mouse', title: 'Mysz', price: 10 }
  ].map(function (part) { return Object.freeze(part); })),
  EVENTS: Object.freeze([
    { id: 'cyber-week', title: 'Cyber Week — Community Sprint', desc: 'Zdobądź XP w ciągu tygodnia i odbierz nagrodę.', reward: '+50 ★', live: true },
    { id: 'ama', title: 'AMA z zespołem TechnixPro', desc: 'Transmisja na żywo z pytaniami od społeczności.', reward: '+100 XP', live: false }
  ])
});
if (typeof module !== "undefined" && module.exports) module.exports = (typeof window !== "undefined" ? window : globalThis).TP_CONFIG;
