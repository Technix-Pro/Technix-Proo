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
document.getElementById('user-points').innerText = "Test ID: " + Telegram.WebApp.initDataUnsafe.user.id;
displayPoints(Telegram.WebApp.initDataUnsafe.user.id
); 
