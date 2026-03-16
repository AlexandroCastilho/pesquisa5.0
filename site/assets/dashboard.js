(function () {
  if (!window.PC_API || window.location.pathname.indexOf("dashboard.html") === -1) {
    return;
  }

  function fmtStatus(status) {
    if (status === "active") return "Ativa";
    if (status === "closed") return "Encerrada";
    return "Rascunho";
  }

  async function loadDashboard() {
    try {
      var data = await window.PC_API.request("/dashboard");
      var statActive = document.getElementById("stat-active-surveys");
      var statFinished = document.getElementById("stat-finished-surveys");
      var statDraft = document.getElementById("stat-draft-surveys");
      var statRate = document.getElementById("stat-response-rate");

      if (statActive) statActive.textContent = String(data.stats.activeSurveys);
      if (statFinished) statFinished.textContent = String(data.stats.finishedSurveys);
      if (statDraft) statDraft.textContent = String(data.stats.draftSurveys);
      if (statRate) statRate.textContent = data.stats.responseRate + "%";

      var tbody = document.getElementById("dashboard-recent-surveys");
      if (tbody) {
        if (!data.recentSurveys.length) {
          tbody.innerHTML = "<tr><td class='px-6 py-8 text-sm text-slate-500 dark:text-slate-400' colspan='4'>Nenhuma pesquisa recente encontrada.</td></tr>";
          return;
        }

        tbody.innerHTML = data.recentSurveys.map(function (survey) {
          return "<tr class='hover:bg-slate-50 dark:hover:bg-primary/5 transition-colors'>" +
            "<td class='px-6 py-4'><div class='flex items-center gap-3'><div class='w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary'><span class='material-symbols-outlined text-sm'>poll</span></div><span class='font-medium'>" + survey.title + "</span></div></td>" +
            "<td class='px-6 py-4'><span class='px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'>" + fmtStatus(survey.status) + "</span></td>" +
            "<td class='px-6 py-4'><span class='text-xs text-slate-500'>" + survey.responseCount + " total</span></td>" +
            "<td class='px-6 py-4 text-right text-sm text-slate-500'>" + new Date(survey.updatedAt).toLocaleDateString("pt-BR") + "</td>" +
          "</tr>";
        }).join("");
      }
    } catch (err) {
      console.error(err);
    }
  }

  var tbody = document.getElementById("dashboard-recent-surveys");
  if (tbody) {
    tbody.innerHTML = "<tr><td class='px-6 py-8 text-sm text-slate-500 dark:text-slate-400' colspan='4'>Carregando pesquisas recentes...</td></tr>";
  }

  loadDashboard();
})();
