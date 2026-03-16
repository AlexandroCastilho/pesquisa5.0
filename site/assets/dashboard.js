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
      var statEls = document.querySelectorAll(".grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4 h3");
      if (statEls.length >= 4) {
        statEls[0].textContent = String(data.stats.activeSurveys);
        statEls[1].textContent = String(data.stats.finishedSurveys);
        statEls[2].textContent = String(data.stats.draftSurveys);
        statEls[3].textContent = data.stats.responseRate + "%";
      }

      var tbody = document.querySelector("table tbody");
      if (tbody) {
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

  loadDashboard();
})();
