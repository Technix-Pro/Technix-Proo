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

  const pointsElement = document.getElementById('xp-total');
  if (pointsElement && data) {
    pointsElement.innerText = data.technix_points;
  }
}

// Przykładowe wywołanie funkcji
displayPoints(123456789); 
