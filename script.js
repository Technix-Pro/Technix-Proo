<!DOCTYPE html>
<html lang="pl" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#080b14">
  <title>TechnixPro — Core Engine</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { margin: 0; background: #080b14; color: #eef2ff; font-family: 'Inter', sans-serif; overflow-x: hidden; }
    .muted { color: #93a0b8; }
    .panel { background: linear-gradient(145deg, rgba(21,29,46,.72), rgba(13,19,32,.92)); border: 1px solid rgba(39,52,77,.7); backdrop-filter: blur(12px); box-shadow: 0 12px 32px rgba(0,0,0,.35); border-radius: 18px; }
    .screen { animation: fadeIn .25s cubic-bezier(.4,0,.2,1); }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    .nav-btn.active { color: #c4b5fd; transform: translateY(-2px); }
    .chat-item { animation: slideIn .2s ease; }
    @keyframes slideIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
  </style>
</head>
<body class="min-h-screen flex flex-col justify-between">
  <main class="max-w-md mx-auto w-full min-h-screen bg-[#080b14] flex flex-col relative pb-28 border-x border-slate-900/60 shadow-2xl">
    <header class="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#080b14]/90 backdrop-blur-xl border-b border-slate-800/80">
      <div class="flex items-center gap-3">
        <button onclick="showScreen('profile', 'Profil')" class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-400 p-[1.5px] transition active:scale-95">
          <div class="w-full h-full bg-[#080b14] rounded-[10.5px] flex items-center justify-center text-lg font-black text-transparent bg-clip-text bg-gradient-to-tr from-violet-400 to-cyan-300">TP</div>
        </button>
        <div>
          <p class="text-[9px] uppercase tracking-[0.25em] text-cyan-400 font-bold">TechnixPro</p>
          <h1 id="header-title" class="text-base font-bold text-white tracking-wide">Start</h1>
        </div>
      </div>
      <button onclick="showScreen('notifications', 'Powiadomienia')" class="w-9 h-9 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-300">
        <i class="fa-regular fa-bell text-xs"></i>
      </button>
    </header>

    <div id="app-content" class="p-4 space-y-4 flex-1">
      <section id="screen-home" class="screen space-y-4">
        <div class="panel p-4">
          <div class="flex justify-between items-center">
            <span class="text-[10px] uppercase text-cyan-400 font-bold">Core Engine</span>
            <span class="text-[10px] text-violet-400 font-mono">v2.6</span>
          </div>
          <h2 class="mt-2 text-xl font-extrabold text-white">TechnixPro Mini App</h2>
          <p class="mt-2 text-xs leading-relaxed text-slate-300">Zbieraj XP, zdobywaj poziomy, rozwojuj profil i publikuj tylko z konta admina.</p>
        </div>

        <div id="admin-panel" class="hidden panel p-4 border-2 border-amber-500/40 space-y-3">
          <h3 class="text-sm font-bold text-amber-400">Panel administratora</h3>
          <textarea id="admin-post-input" rows="3" class="w-full rounded-xl bg-[#080b14] border border-amber-500/30 p-3 text-xs text-slate-200 focus:outline-none" placeholder="Treść posta..."></textarea>
          <input id="admin-media-url" type="text" class="w-full rounded-xl bg-[#080b14] border border-amber-500/30 p-3 text-xs text-slate-200 focus:outline-none" placeholder="Link do zdjęcia / wideo / posta (opcjonalnie)">
          <button onclick="publishAdminPost()" class="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs py-2.5 rounded-xl">Opublikuj post</button>
        </div>

        <div class="panel p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white">Kanał</span>
            <span id="channel-status" class="text-[10px] text-emerald-400">Online</span>
          </div>
          <div id="channel-feed" class="space-y-3"></div>
        </div>
      </section>

      <section id="screen-rewards" class="screen hidden space-y-4">
        <div class="panel p-4 bg-gradient-to-br from-violet-900/35 via-slate-900 to-cyan-900/25">
          <div class="flex justify-between items-center">
            <div>
              <p id="profile-username" class="text-xs text-cyan-300">@user</p>
              <div class="flex items-baseline gap-2 mt-1">
                <span id="xp-display" class="text-3xl font-black text-white">0</span>
                <span class="text-xs font-bold text-violet-400">XP</span>
              </div>
            </div>
            <span id="level-badge" class="rounded-full border border-violet-500/40 bg-violet-600/20 px-3 py-1 text-[10px] font-bold text-violet-200">LEVEL 1</span>
          </div>
          <div class="mt-4 space-y-1">
            <div class="flex justify-between text-[10px] text-slate-300">
              <span>Postęp poziomu</span>
              <span id="progress-text">0 / 3000 XP</span>
            </div>
            <div class="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div id="progress-bar" class="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style="width: 0%"></div>
            </div>
          </div>
        </div>

        <div class="panel p-4 space-y-3">
          <h3 class="text-sm font-bold text-white">Rangi</h3>
          <div id="rank-list" class="space-y-2"></div>
        </div>

        <div class="panel p-4 space-y-3">
          <h3 class="text-sm font-bold text-white">Zadania</h3>
          <div id="task-list" class="space-y-2"></div>
        </div>

        <div class="panel p-4 space-y-3">
          <h3 class="text-sm font-bold text-white">Referral</h3>
          <div class="flex gap-2">
            <input id="referral-link" readonly class="flex-1 bg-slate-900/60 border border-emerald-500/20 text-[10px] text-emerald-300 rounded-lg p-2.5" value="loading...">
            <button onclick="copyReferral()" class="bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg">Kopiuj</button>
          </div>
          <p class="text-[10px] text-slate-400">10 osób = +100 XP • 20 = +300 XP • 50 = +1000 XP</p>
        </div>

        <div class="panel p-4 space-y-3">
          <h3 class="text-sm font-bold text-white">Odznaki</h3>
          <div id="badge-list" class="grid grid-cols-3 gap-2"></div>
        </div>
      </section>

      <section id="screen-profile" class="screen hidden space-y-4">
        <div class="panel p-5 text-center space-y-4">
          <div class="w-20 h-20 mx-auto rounded-full border-2 border-violet-500 overflow-hidden bg-slate-900">
            <img id="profile-avatar" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='28' r='16' fill='%234F46E5'/%3E%3Cpath d='M18 68c0-14 10-22 22-22s22 8 22 22' fill='%234F46E5'/%3E%3C/svg%3E" class="w-full h-full object-cover">
          </div>
          <div>
            <h2 id="profile-name" class="text-lg font-bold text-white">Loading...</h2>
            <p id="profile-id" class="text-xs muted">TG ID: #brak</p>
            <p id="profile-username-inline" class="text-xs text-cyan-400">@user</p>
          </div>
        </div>

        <div class="panel p-4 space-y-3 text-xs">
          <div class="flex justify-between bg-slate-900/50 rounded-xl p-2.5"><span class="muted">Telegram ID</span><span id="show-id" class="font-mono text-cyan-400">-</span></div>
          <div class="flex justify-between bg-slate-900/50 rounded-xl p-2.5"><span class="muted">Poziom</span><span id="profile-level" class="font-bold text-violet-400">1</span></div>
          <div class="flex justify-between bg-slate-900/50 rounded-xl p-2.5"><span class="muted">XP</span><span id="profile-xp" class="font-bold text-emerald-400">0</span></div>
        </div>

        <div class="panel p-4 space-y-3">
          <h3 class="text-sm font-bold text-blue-400">Portfel TON</h3>
          <div class="text-center">
            <p class="text-2xl font-black text-white">0 TON</p>
            <p class="text-[10px] text-slate-400">Saldo demonstracyjne</p>
          </div>
          <button onclick="showToast('Połączenie TON Keeper dostępne po integracji mainnet')" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2.5 rounded-xl">Połącz TON Keeper</button>
        </div>
      </section>

      <section id="screen-notifications" class="screen hidden space-y-4">
        <div class="panel p-4 space-y-3">
          <h3 class="text-sm font-bold text-white">Powiadomienia</h3>
          <div class="bg-slate-900/60 p-3 rounded-xl text-xs text-slate-300">Witamy w TechnixPro. Twoje konto jest aktywne i zapisane lokalnie dla tego urządzenia.</div>
        </div>
      </section>
    </div>

    <nav class="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-[#080b14]/95 backdrop-blur-xl border-t border-slate-800/80 px-2 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex justify-around">
      <button class="nav-btn active flex flex-col items-center text-[10px]" onclick="showScreen('home','Start')"><i class="fa-solid fa-house text-base"></i><span>Start</span></button>
      <button class="nav-btn flex flex-col items-center text-[10px]" onclick="showScreen('rewards','Bonusy')"><i class="fa-solid fa-gift text-base"></i><span>Bonusy</span></button>
      <button class="nav-btn flex flex-col items-center text-[10px]" onclick="showScreen('profile','Profil')"><i class="fa-solid fa-user text-base"></i><span>Profil</span></button>
    </nav>
  </main>

  <div id="toast" class="hidden fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-800/90 border border-slate-700/80 text-xs text-slate-100 px-4 py-2 rounded-xl shadow-xl"></div>

  <script src="./script.js"></script>
</body>
</html>




































































































































