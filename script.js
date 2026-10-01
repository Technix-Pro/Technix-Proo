import { supabase } from './config.js';

// DEBUG MODE - włącz aby zobaczyć szczegóły
const DEBUG = true;

function log(...args) {
  if (DEBUG) {
    console.log('[TechnixPro]', ...args);
  }
}

function error(...args) {
  console.error('[TechnixPro ERROR]', ...args);
}

// Sprawdzenie połączenia Supabase
async function checkSupabaseConnection() {
  try {
    log('Sprawdzanie połączenia Supabase...');
    
    const { data, error: checkError } = await supabase
      .from('users')
      .select('count', { count: 'exact' })
      .limit(1);

    if (checkError) {
      error('Błąd połączenia Supabase:', checkError.message);
      error('Kod błędu:', checkError.code);
      return false;
    }

    log('✓ Połączenie Supabase OK');
    return true;
  } catch (err) {
    error('Nieoczekiwany błąd przy sprawdzaniu Supabase:', err);
    return false;
  }
}

async function displayPoints(telegramId) {
  if (!telegramId) {
    error('Brak ID użytkownika Telegram!');
    return null;
  }

  log(`Pobieranie punktów dla ID: ${telegramId}`);

  try {
    const { data, error: queryError, status } = await supabase
      .from('users')
      .select('technix_points, telegram_id')
      .eq('telegram_id', telegramId)
      .single();

    log(`Status zapytania: ${status}`);

    if (queryError) {
      error('Błąd zapytania Supabase:', queryError.message);
      error('Kod błędu:', queryError.code);
      error('Status:', queryError.status);
      
      // Możliwe przyczyny:
      if (queryError.code === 'PGRST116') {
        error('❌ Użytkownik nie istnieje w bazie danych!');
        error(`Sprawdź czy telegram_id=${telegramId} jest w tabeli 'users'`);
      } else if (queryError.code === 'PGRST201') {
        error('❌ Błąd uprawnień! Sprawdź RLS policies w Supabase.');
      }
      
      return null;
    }

    if (!data) {
      error('Brak danych dla użytkownika!');
      return null;
    }

    log(`✓ Pobrane dane:`, data);

    const pointsElement = document.getElementById('user-points');
    if (pointsElement) {
      pointsElement.innerText = data.technix_points || '0';
      log(`✓ Punkty wyświetlone: ${data.technix_points}`);
    } else {
      error('Element #user-points nie znaleziony w HTML!');
    }

    return data;

  } catch (err) {
    error('Nieoczekiwany błąd:', err);
    return null;
  }
}

// Inicjalizacja aplikacji
async function initApp() {
  log('Inicjalizacja aplikacji...');

  // Sprawdzenie Telegram WebApp
  if (!window.Telegram) {
    error('❌ Telegram nie jest dostępny! Aplikacja musi działać w Telegramic Mini App.');
    log('Jeśli testujesz lokalnie, Telegram WebApp będzie dostępny tylko w aplikacji Telegram.');
    return;
  }

  const tg = window.Telegram?.WebApp;

  if (!tg) {
    error('❌ Telegram WebApp nie znaleziony!');
    return;
  }

  log('✓ Telegram WebApp dostępny');
  tg.ready();

  // Pobranie danych użytkownika
  const userId = tg.initDataUnsafe?.user?.id;
  const username = tg.initDataUnsafe?.user?.username;
  const firstName = tg.initDataUnsafe?.user?.first_name;
  const lastName = tg.initDataUnsafe?.user?.last_name;

  log('Dane użytkownika Telegram:');
  log(`  ID: ${userId}`);
  log(`  Username: ${username || 'N/A'}`);
  log(`  Imię: ${firstName || 'N/A'}`);
  log(`  Nazwisko: ${lastName || 'N/A'}`);

  if (!userId) {
    error('❌ Brak ID użytkownika! Aplikacja nie uruchomiona z Telegrama!');
    return;
  }

  // Sprawdzenie Supabase
  const isConnected = await checkSupabaseConnection();
  if (!isConnected) {
    error('❌ Nie można połączyć się z Supabase!');
    error('Sprawdź:');
    error('  1. Czy zmienne środowiskowe są ustawione?');
    error('  2. Czy SUPABASE_URL i SUPABASE_ANON_KEY są poprawne?');
    error('  3. Czy projekt Supabase jest aktywny?');
    return;
  }

  // Pobieranie i wyświetlanie punktów
  log('Pobieranie danych użytkownika z bazy...');
  const userData = await displayPoints(userId);

  if (userData) {
    // Wyświetlenie ID na stronie (opcjonalnie)
    const userIdElement = document.getElementById('user-id');
    const usernameElement = document.getElementById('user-username');
    const firstNameElement = document.getElementById('user-first-name');

    if (userIdElement) userIdElement.innerText = userId;
    if (usernameElement) usernameElement.innerText = username || 'N/A';
    if (firstNameElement) firstNameElement.innerText = firstName || 'N/A';

    log('✓ Aplikacja załadowana pomyślnie!');
  } else {
    error('❌ Nie udało się załadować danych użytkownika.');
  }
}

// Uruchomienie po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

// Uruchomienie natychmiast, jeśli DOM jest już gotowy
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

export { displayPoints };
