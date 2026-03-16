(function () {
  if (!window.PC_API || window.location.pathname.indexOf("editor-perguntas.html") === -1) {
    return;
  }

  var Dialog = window.PC_DIALOG || {
    alert: function (msg) { window.alert(msg); return Promise.resolve(); },
    prompt: function (msg, def) { return Promise.resolve(window.prompt(msg, def || "")); }
  };

  var url = new URL(window.location.href);
  var surveyId = url.searchParams.get("surveyId");

  var panel = document.getElementById("editor-functional-panel");
  if (!panel) {
    return;
  }

  function defaultQuestion() {
    return {
      id: "q_" + Math.random().toString(36).slice(2, 9),
      text: "",
      type: "multiple_choice",
      required: true,
      randomizeOptions: false,
      options: ["Opcao 1", "Opcao 2"]
    };
  }

  function render(survey, responseCount) {
    panel.innerHTML = "" +
      "<div class='space-y-4'>" +
        "<div class='rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-slate-700 dark:text-slate-200'>" +
          "Respostas recebidas: <strong>" + responseCount + "</strong>" +
        "</div>" +
        "<label class='block text-sm font-bold'>Titulo da Pesquisa</label>" +
        "<input id='survey-title' class='w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-3 text-sm' value='" + (survey.title || "") + "' />" +
        "<label class='block text-sm font-bold'>Descricao</label>" +
        "<textarea id='survey-description' class='w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-3 text-sm' rows='3'>" + (survey.description || "") + "</textarea>" +
        "<label class='block text-sm font-bold'>Perguntas (JSON)</label>" +
        "<textarea id='survey-questions' class='w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono' rows='10'>" + JSON.stringify(survey.questions || [defaultQuestion()], null, 2) + "</textarea>" +
        "<div class='flex gap-2'>" +
          "<button id='btn-save-survey' class='px-5 py-2.5 rounded-lg bg-primary text-white font-bold'>Salvar Pesquisa</button>" +
          "<button id='btn-close-survey' class='px-5 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-bold'>Fechar</button>" +
        "</div>" +
      "</div>";

    document.getElementById("btn-save-survey").addEventListener("click", async function () {
      try {
        var questions = JSON.parse(document.getElementById("survey-questions").value);
        await window.PC_API.request("/surveys/" + survey.id, {
          method: "PUT",
          body: JSON.stringify({
            title: document.getElementById("survey-title").value,
            description: document.getElementById("survey-description").value,
            questions: questions
          })
        });
        await Dialog.alert("Pesquisa salva.", "Editor");
      } catch (err) {
        await Dialog.alert("Erro ao salvar: " + err.message, "Erro");
      }
    });

    document.getElementById("btn-close-survey").addEventListener("click", async function () {
      await window.PC_API.request("/surveys/" + survey.id, {
        method: "PUT",
        body: JSON.stringify({ status: "closed" })
      });
      await Dialog.alert("Pesquisa encerrada.", "Editor");
    });
  }

  async function bootstrap() {
    if (!surveyId) {
      var title = await Dialog.prompt("Título da pesquisa para iniciar:", "Nova pesquisa", "Nova pesquisa");
      if (!title) {
        title = "Nova pesquisa";
      }

      var created = await window.PC_API.request("/surveys", {
        method: "POST",
        body: JSON.stringify({ title: title })
      });
      surveyId = created.survey.id;
      window.history.replaceState({}, "", "editor-perguntas.html?surveyId=" + surveyId);
    }

    var data = await window.PC_API.request("/surveys/" + surveyId);
    render(data.survey, (data.responses || []).length);
  }

  bootstrap().catch(function (err) {
    panel.innerHTML = "<p class='text-red-500 text-sm'>" + err.message + "</p>";
  });
})();
