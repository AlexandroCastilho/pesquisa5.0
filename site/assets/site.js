(function () {
  var THEME_MODE_KEY = 'pc_theme_mode';
  var LEGACY_THEME_KEY = 'pc_theme';
  var systemThemeMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var themeMode = null;

  function readStoredThemeMode() {
    var mode = localStorage.getItem(THEME_MODE_KEY);
    if (mode === 'system' || mode === 'light' || mode === 'dark') {
      return mode;
    }

    var legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === 'light' || legacy === 'dark') {
      return legacy;
    }

    return 'system';
  }

  function resolveTheme(mode) {
    if (mode === 'light' || mode === 'dark') {
      return mode;
    }

    if (systemThemeMedia && systemThemeMedia.matches) {
      return 'dark';
    }

    return 'light';
  }

  function paintThemeControls(resolvedTheme) {
    var isDark = resolvedTheme === 'dark';
    var labelByMode = {
      light: 'Modo Claro',
      dark: 'Modo Escuro',
      system: 'Modo Automático'
    };

    var themeIcon = themeMode === 'system' ? 'contrast' : (isDark ? 'dark_mode' : 'light_mode');
    var themeLabel = labelByMode[themeMode] || 'Tema';

    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-label', themeLabel);
      btn.setAttribute('title', themeLabel);

      var iconEl = btn.querySelector('[data-theme-icon]');
      if (iconEl) {
        iconEl.textContent = themeIcon;
      } else {
        btn.textContent = themeLabel;
      }
    });

    document.querySelectorAll('[data-theme-mode-select]').forEach(function (selectEl) {
      if (selectEl.value !== themeMode) {
        selectEl.value = themeMode;
      }
    });
  }

  function applyTheme(mode, persist) {
    var shouldPersist = persist !== false;
    themeMode = mode;

    var resolvedTheme = resolveTheme(mode);
    var isDark = resolvedTheme === 'dark';

    document.documentElement.classList.toggle('dark', isDark);

    if (shouldPersist) {
      localStorage.setItem(THEME_MODE_KEY, themeMode);
      localStorage.setItem(LEGACY_THEME_KEY, resolvedTheme);
    }

    paintThemeControls(resolvedTheme);
  }

  function setThemeMode(mode) {
    if (mode !== 'system' && mode !== 'light' && mode !== 'dark') {
      return;
    }
    applyTheme(mode, true);
  }

  function toggleTheme() {
    var resolvedCurrent = resolveTheme(themeMode || 'system');
    setThemeMode(resolvedCurrent === 'dark' ? 'light' : 'dark');
  }

  function setupThemeToggleButtons() {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      if (btn.dataset.themeBound === '1') {
        return;
      }

      btn.dataset.themeBound = '1';
      btn.addEventListener('click', function () {
        toggleTheme();
      });
    });

    document.querySelectorAll('[data-theme-mode-select]').forEach(function (selectEl) {
      if (selectEl.dataset.themeBound === '1') {
        return;
      }

      selectEl.dataset.themeBound = '1';
      selectEl.addEventListener('change', function (event) {
        setThemeMode(event.target.value);
      });
    });
  }

  applyTheme(readStoredThemeMode(), false);

  if (systemThemeMedia) {
    systemThemeMedia.addEventListener('change', function () {
      if (themeMode === 'system') {
        applyTheme('system', false);
      }
    });
  }

  window.PC_THEME = {
    getMode: function () {
      return themeMode;
    },
    setMode: setThemeMode,
    toggle: toggleTheme
  };

  var host = window.location.hostname;
  var port = window.location.port;
  var path = window.location.pathname;
  var isLocalHost = host === 'localhost' || host === '127.0.0.1';
  var isAppPath = path.indexOf('/pages/desktop/') !== -1 || path.indexOf('/site/pages/desktop/') !== -1;

  if (isLocalHost && port && port !== '3000' && isAppPath) {
    var normalizedPath = path.indexOf('/site/') === 0 ? path : '/site' + path;
    window.location.replace(window.location.protocol + '//' + host + ':3000' + normalizedPath + window.location.search + window.location.hash);
    return;
  }

  var isDesktop = window.location.pathname.indexOf('/desktop/') !== -1;
  var isMobile = window.location.pathname.indexOf('/mobile/') !== -1;
  var token = localStorage.getItem('pc_token');
  var pageName = window.location.pathname.split('/').pop() || '';

  if (isDesktop && pageName !== 'login.html' && !token) {
    window.location.href = 'login.html';
    return;
  }

  if (isDesktop && pageName === 'login.html' && token) {
    window.location.href = 'dashboard.html';
    return;
  }

  if (!isDesktop && !isMobile) {
    return;
  }

  var shell = document.createElement('nav');
  shell.className = 'pc-shell';
  shell.setAttribute('aria-label', 'Navegacao rapida');

  function makeLink(label, href, active) {
    var a = document.createElement('a');
    a.textContent = label;
    a.href = href;
    if (active) {
      a.classList.add('pc-active');
    }
    return a;
  }

  function makeThemeButton() {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'pc-shell-theme';
    button.setAttribute('data-theme-toggle', '1');
    button.innerHTML = "<span class='material-symbols-outlined' data-theme-icon>dark_mode</span>";
    return button;
  }

  var homeHref = isDesktop ? (token ? 'dashboard.html' : 'login.html') : '../desktop/login.html';

  shell.appendChild(makeLink('Inicio', homeHref, false));

  if (isDesktop) {
    shell.appendChild(makeThemeButton());

    if (pageName === 'login.html') {
      document.body.prepend(shell);
      setupThemeToggleButtons();
      applyTheme(themeMode || 'system', false);
      return;
    }

    shell.appendChild(makeLink('Desktop', 'dashboard.html', pageName === 'dashboard.html'));
    shell.appendChild(makeLink('Pesquisas', 'pesquisas.html', pageName === 'pesquisas.html'));
    shell.appendChild(makeLink('Editor', 'editor-perguntas.html', pageName === 'editor-perguntas.html'));
    shell.appendChild(makeLink('Público', 'usuarios.html', pageName === 'usuarios.html'));
    shell.appendChild(makeLink('SMTP', 'smtp.html', pageName === 'smtp.html'));

    var logout = document.createElement('button');
    logout.type = 'button';
    logout.textContent = 'Sair';
    logout.className = 'pc-shell-logout';
    logout.addEventListener('click', function () {
      localStorage.removeItem('pc_token');
      localStorage.removeItem('pc_user');
      window.location.href = 'login.html';
    });
    shell.appendChild(logout);
  } else {
    shell.appendChild(makeThemeButton());
    shell.appendChild(makeLink('Mobile', 'dashboard.html', pageName === 'dashboard.html'));
    shell.appendChild(makeLink('Pesquisas', 'pesquisas.html', pageName === 'pesquisas.html'));
    shell.appendChild(makeLink('Editor', 'editor.html', pageName === 'editor.html'));
  }

  var spacer = document.createElement('div');
  spacer.className = 'pc-shell-spacer';

  document.body.prepend(spacer);
  document.body.prepend(shell);

  setupThemeToggleButtons();
  applyTheme(themeMode || 'system', false);
})();
