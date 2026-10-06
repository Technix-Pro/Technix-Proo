# Panel administratora

Paczka frontendowa panelu administratora do skopiowania do osobnego repo lub do późniejszego merge do głównej aplikacji.

## Pliki

- `admin-core.js` — główny moduł panelu administratora

## Instrukcja użycia

Dodaj do końca `index.html` przed `</body>`:

```html
<script src="paneladministratora/admin-core.js"></script>
```

## Funkcjonalność

- panel administratora sprawdza identyfikatory z `TECHNIX_CONFIG.ADMIN_IDS` w `config.js`
- publiczny feed materiałów
- event live
- zadania bonusowe
- powiadomienia
- zapis danych w `localStorage`

## Uwagi

- nie rusza głównego `index.html`
- dane są lokalne i nie synchronizują się między użytkownikami
- jest to wersja frontendowa bez backendu
- gotowa do podpięcia API w przyszłości
