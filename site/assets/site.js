(function () {
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

  shell.appendChild(makeLink('Inicio', isDesktop ? '../../index.html' : '../../index.html', false));

  if (isDesktop) {
    if (pageName === 'login.html') {
      shell.appendChild(makeLink('Inicio', '../../index.html', false));
      document.body.prepend(shell);
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
    shell.appendChild(makeLink('Mobile', 'dashboard.html', pageName === 'dashboard.html'));
    shell.appendChild(makeLink('Pesquisas', 'pesquisas.html', pageName === 'pesquisas.html'));
    shell.appendChild(makeLink('Editor', 'editor.html', pageName === 'editor.html'));
  }

  var spacer = document.createElement('div');
  spacer.className = 'pc-shell-spacer';

  document.body.prepend(spacer);
  document.body.prepend(shell);
})();
