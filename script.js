import { supabase } from './config.js';

const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log('[TechnixPro]', ...args);
}

function error(...args) {
  console.error('[TechnixPro ERROR]', ...args);
}

async function displayPoints(telegramId) {
  if (!telegramId) {
    error('Brak ID Telegrama!');
    return null;
  }

  try {
    log(`Pobieranie punktów dla ID: ${telegramId}`);
    
    const { data, error: queryError } = await supabase
      .from('users')
      .select('technix_points, telegram_id')
      .eq('telegram_id', telegramId)
      .single();

    if (queryError) {
      error('Błąd Supabase:', queryError.message);
      if (queryError.code === 'PGRST116') {
        error('❌ Użytkownik nie istnieje w bazie! Dodaj rekord z telegram_id=' + telegramId);
      }
      return null;
    }

    log('✓ Dane pobrane:', data);
    const pointsEl = document.getElementById('user-points');
    if (pointsEl) {
      pointsEl.innerText = data.technix_points || '0';
      log('✓ Punkty wyświetlone na stronie');
    }

    return data;
  } catch (err) {
    error('Błąd:', err.message);
    return null;
  }
}

async function initApp() {
  log('Inicjalizacja aplikacji...');

  if (!window.Telegram?.WebApp) {
    error('❌ Otwórz aplikację w Telegram Mini App!');
    return;
  }

  const tg = window.Telegram.WebApp;
  tg.ready();

  const userId = tg.initDataUnsafe?.user?.id;
  const username = tg.initDataUnsafe?.user?.username || 'N/A';

  log(`✓ Zalogowano: ${userId} (@${username})`);

  if (!userId) {
    error('❌ Brak ID użytkownika!');
    return;
  }

  // Pobierz punkty użytkownika
  await displayPoints(userId);
}

// Uruchomienie gdy strona się załaduje
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

export { displayPoints };
