(function () {
  if (!window.PC_API || window.location.pathname.indexOf("pesquisas.html") === -1) {
    return;
  }

  var Dialog = window.PC_DIALOG || {
    alert: function (msg) { window.alert(msg); return Promise.resolve(); },
    confirm: function (msg) { return Promise.resolve(window.confirm(msg)); },
    prompt: function (msg, def) { return Promise.resolve(window.prompt(msg, def || "")); }
  };

  var state = {
    search: "",
    status: "",
    sort: "recent"
  };

  function statusClass(status) {
    if (status === "active") return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
    if (status === "closed") return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
  }

  function statusLabel(status) {
    if (status === "active") return "Ativa";
    if (status === "closed") return "Fechada";
    return "Rascunho";
  }

  async function loadSurveys() {
    var params = new URLSearchParams();
    if (state.search) params.set("search", state.search);
    if (state.status) params.set("status", state.status);
    params.set("sort", state.sort);

    try {
      var data = await window.PC_API.request("/surveys?" + params.toString());
      var grid = document.getElementById("surveys-grid");
      if (!data.surveys.length) {
        grid.innerHTML = "<div class='col-span-full rounded-xl border border-slate-200 dark:border-primary/20 bg-white dark:bg-background-dark p-8 text-center text-slate-500 dark:text-slate-400'>Nenhuma pesquisa encontrada.</div>";
        return;
      }
      grid.innerHTML = data.surveys.map(function (survey) {
        return "<div class='bg-white dark:bg-background-dark border border-slate-200 dark:border-primary/20 rounded-xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 transition-all group'>" +
          "<div class='h-20 bg-gradient-to-br from-primary/20 to-primary/5 p-4 flex justify-between items-start'>" +
            "<span class='px-3 py-1 text-xs font-bold rounded-full border " + statusClass(survey.status) + "'>" + statusLabel(survey.status) + "</span>" +
            "<div class='flex gap-1'>" +
              "<button data-edit='" + survey.id + "' class='p-2 bg-white/80 dark:bg-background-dark/80 rounded-lg text-slate-600 dark:text-slate-400 hover:text-primary transition-colors'><span class='material-symbols-outlined text-[20px]'>edit</span></button>" +
              "<button data-delete='" + survey.id + "' class='p-2 bg-white/80 dark:bg-background-dark/80 rounded-lg text-slate-600 dark:text-slate-400 hover:text-red-500 transition-colors'><span class='material-symbols-outlined text-[20px]'>delete</span></button>" +
            "</div>" +
          "</div>" +
          "<div class='p-6'>" +
            "<h3 class='font-bold text-lg mb-2 group-hover:text-primary transition-colors'>" + survey.title + "</h3>" +
            "<div class='flex flex-col gap-2 text-sm text-slate-500 dark:text-slate-400'>" +
              "<div class='flex items-center gap-2'><span class='material-symbols-outlined text-[18px]'>calendar_today</span>Criada: " + new Date(survey.createdAt).toLocaleDateString("pt-BR") + "</div>" +
              "<div class='flex items-center gap-2'><span class='material-symbols-outlined text-[18px]'>bar_chart</span>" + survey.responseCount + " Respostas</div>" +
            "</div>" +
            "<div class='mt-4 flex gap-2'>" +
              "<button data-import='" + survey.id + "' class='w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-bold transition-all'>Importar E-mails</button>" +
              "<button data-launch='" + survey.id + "' class='w-full bg-primary/10 hover:bg-primary text-primary hover:text-white py-2 rounded-lg text-sm font-bold transition-all'>Lancar</button>" +
            "</div>" +
          "</div>" +
        "</div>";
      }).join("");
    } catch (err) {
      await Dialog.alert(err.message, "Erro");
    }
  }

  async function createSurvey() {
    var title = await Dialog.prompt("Título da nova pesquisa:", "", "Nova pesquisa");
    if (!title) return;

    await window.PC_API.request("/surveys", {
      method: "POST",
      body: JSON.stringify({ title: title })
    });
    await loadSurveys();
  }

  async function importEmails(surveyId) {
    var text = await Dialog.prompt("Cole e-mails separados por vírgula ou linha:", "", "Importar e-mails");
    if (!text) return;

    await window.PC_API.request("/surveys/" + surveyId + "/respondents/import", {
      method: "POST",
      body: JSON.stringify({ emails: text })
    });
    await Dialog.alert("E-mails importados com sucesso.", "Importação");
  }

  async function launchSurvey(surveyId) {
    try {
      var result = await window.PC_API.request("/surveys/" + surveyId + "/launch", { method: "POST" });
      await Dialog.alert("Disparo concluído. Enviados: " + result.sent + ", falhas: " + result.failed, "Lançamento");
      await loadSurveys();
    } catch (err) {
      await Dialog.alert(err.message, "Erro");
    }
  }

  async function removeSurvey(surveyId) {
    var shouldDelete = await Dialog.confirm("Excluir pesquisa?", "Confirmação");
    if (!shouldDelete) return;
    await window.PC_API.request("/surveys/" + surveyId, { method: "DELETE" });
    await loadSurveys();
  }

  function bindEvents() {
    var searchInput = document.getElementById("search-survey");
    searchInput.addEventListener("input", function () {
      state.search = searchInput.value.trim();
      loadSurveys();
    });

    document.getElementById("btn-new-survey").addEventListener("click", createSurvey);

    document.getElementById("filter-status").addEventListener("change", function (e) {
      state.status = e.target.value;
      loadSurveys();
    });

    document.getElementById("sort-survey").addEventListener("change", function (e) {
      state.sort = e.target.value;
      loadSurveys();
    });

    document.getElementById("surveys-grid").addEventListener("click", function (event) {
      var editId = event.target.closest("button") && event.target.closest("button").getAttribute("data-edit");
      var deleteId = event.target.closest("button") && event.target.closest("button").getAttribute("data-delete");
      var importId = event.target.closest("button") && event.target.closest("button").getAttribute("data-import");
      var launchId = event.target.closest("button") && event.target.closest("button").getAttribute("data-launch");

      if (editId) {
        window.location.href = "editor-perguntas.html?surveyId=" + editId;
      }
      if (deleteId) {
        removeSurvey(deleteId);
      }
      if (importId) {
        importEmails(importId);
      }
      if (launchId) {
        launchSurvey(launchId);
      }
    });
  }

  bindEvents();
  document.getElementById("surveys-grid").innerHTML = "<div class='col-span-full rounded-xl border border-slate-200 dark:border-primary/20 bg-white dark:bg-background-dark p-8 text-center text-slate-500 dark:text-slate-400'>Carregando pesquisas...</div>";
  loadSurveys();
})();
