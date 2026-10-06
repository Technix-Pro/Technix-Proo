/* Shop catalog. Prices are in Telegram Stars (XTR, integers). The backend must hold the same catalog and is the source of truth. */
window.SHOP_CATALOG = Object.freeze([
  { id: 'mouse', title: 'Myszka', description: 'Precyzyjna myszka gamingowa do stanowiska RIG.', priceXtr: 25, type: 'rig_part', icon: 'fa-computer-mouse', effect: { type: 'rig_part', part: 'mouse' }, maxOwned: 1, phase: 1 },
  { id: 'keyboard', title: 'Klawiatura', description: 'Mechaniczna klawiatura RGB.', priceXtr: 40, type: 'rig_part', icon: 'fa-keyboard', effect: { type: 'rig_part', part: 'keyboard' }, maxOwned: 1, phase: 1 },
  { id: 'monitor', title: 'Monitor', description: 'Monitor do podglądu wydobycia.', priceXtr: 120, type: 'rig_part', icon: 'fa-display', effect: { type: 'rig_part', part: 'monitor' }, maxOwned: 1, phase: 1 },
  { id: 'case', title: 'Obudowa', description: 'Obudowa z oknem i wentylatorami.', priceXtr: 60, type: 'rig_part', icon: 'fa-cube', effect: { type: 'rig_part', part: 'case' }, maxOwned: 1, phase: 1 },
  { id: 'ram', title: 'RAM', description: 'Pamięć RAM dla płyty głównej.', priceXtr: 50, type: 'rig_part', icon: 'fa-memory', effect: { type: 'rig_part', part: 'ram' }, maxOwned: 1, phase: 1 },
  { id: 'gpu', title: 'GPU', description: 'Karta graficzna do wydobycia.', priceXtr: 200, type: 'rig_part', icon: 'fa-microchip', effect: { type: 'rig_part', part: 'gpu' }, maxOwned: 1, phase: 1 },
  { id: 'boost_energy', title: 'Boost energii', description: 'Zwiększa limit energii o 500.', priceXtr: 75, type: 'boost', icon: 'fa-bolt', effect: { type: 'energy_max', value: 500 }, maxOwned: 1, phase: 1 },
  { id: 'cosmetic_neon', title: 'Neonowy rdzeń', description: 'Kosmetyczny motyw rdzenia (bez wpływu na rozgrywkę).', priceXtr: 30, type: 'cosmetic', icon: 'fa-wand-magic-sparkles', effect: { type: 'cosmetic', theme: 'neon' }, maxOwned: 1, phase: 1 }
]);
