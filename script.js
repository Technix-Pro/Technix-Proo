import { supabase } from './config.js';

async function displayPoints(telegramId) {
  if (!telegramId) {
    console.error('Brak ID użytkownika Telegram!');
    return;
  }

  try {
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
      console.log(`Pobrane punkty dla użytkownika ${telegramId}: ${data.technix_points}`);
    }
  } catch (err) {
    console.error('Nieoczekiwany błąd:', err);
  }
}

// Inicjalizacja Telegram WebApp
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  
  // Bezpieczne wyciągnięcie danych użytkownika
  const userId = tg.initDataUnsafe?.user?.id;
  const username = tg.initDataUnsafe?.user?.username;
  const firstName = tg.initDataUnsafe?.user?.first_name;
  
  if (userId) {
    console.log("ID użytkownika:", userId);
    console.log("Nazwa użytkownika:", username);
    console.log("Imię:", firstName);
    
    // Wywołanie funkcji z poprawnym ID
    displayPoints(userId);
    
    // Opcjonalnie: zapisz dane użytkownika do elementów na stronie
    const userIdElement = document.getElementById('user-id');
    const usernameElement = document.getElementById('user-username');
    const firstNameElement = document.getElementById('user-first-name');
    
    if (userIdElement) userIdElement.innerText = userId;
    if (usernameElement) usernameElement.innerText = username || 'N/A';
    if (firstNameElement) firstNameElement.innerText = firstName || 'N/A';
  } else {
    console.warn("Brak ID użytkownika. Upewnij się, że aplikacja jest uruchamiana wewnątrz Telegrama!");
  }
} else {
  console.warn("Telegram WebApp nie jest dostępny!");
}
