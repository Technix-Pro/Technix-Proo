import { supabase } from './config.js';

async function displayPoints(telegramId) {
  const { data, error } = await supabase
    .from('users')
    .select('technix_points')
    .eq('telegram_id', telegramId)
    .single();

  if (error) {
    console.error('Błąd podczas pobierania punktów:', error);
    return;
  }

  const pointsElement = document.getElementById('user-points');
  if (pointsElement && data) {
    pointsElement.innerText = data.technix_points;
  }
}

// Przykładowe wywołanie funkcji
// Sprawdź, czy obiekt Telegram WebApp jest dostępny
const tg = window.Telegram.WebApp;

// Poinformuj Telegram, że aplikacja w pełni się załadowała
tg.ready();

// Bezpieczne wyciągnięcie ID użytkownika
const userId = tg.initDataUnsafe?.user?.id;
const username = tg.initDataUnsafe?.user?.username;
const firstName = tg.initDataUnsafe?.user?.first_name;

if (userId) {
    console.log("Mam ID użytkownika:", userId);
 displayPoints(user.id);
  // Tutaj możesz np. wpisać ID do jakiegoś elementu na stronie:
    // document.getElementById('user-id').innerText = userId;
} else {
    console.log("Brak ID. Uruchom aplikację wewnątrz Telegrama!");
}



