(function () {
  if (!window.PC_API || window.location.pathname.indexOf("smtp.html") === -1) {
    return;
  }

  var Dialog = window.PC_DIALOG || {
    alert: function (msg) { window.alert(msg); return Promise.resolve(); }
  };

  var form = document.getElementById("smtp-form");
  if (!form) return;

  async function load() {
    try {
      var data = await window.PC_API.request("/smtp");
      form.host.value = data.smtp.host || "";
      form.port.value = data.smtp.port || 587;
      form.security.value = data.smtp.security || "tls";
      form.username.value = data.smtp.username || "";
      form.fromEmail.value = data.smtp.fromEmail || "";
    } catch (err) {
      console.error(err);
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var payload = {
      host: form.host.value.trim(),
      port: Number(form.port.value),
      security: form.security.value,
      username: form.username.value.trim(),
      password: form.password.value,
      fromEmail: form.fromEmail.value.trim()
    };

    try {
      await window.PC_API.request("/smtp", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      await Dialog.alert("Configurações SMTP salvas.", "SMTP");
      form.password.value = "";
    } catch (err) {
      await Dialog.alert(err.message, "Erro");
    }
  });

  document.getElementById("btn-test-smtp").addEventListener("click", async function () {
    try {
      await window.PC_API.request("/smtp/test", { method: "POST" });
      await Dialog.alert("Conexão SMTP validada com sucesso.", "SMTP");
    } catch (err) {
      await Dialog.alert(err.message, "Erro");
    }
  });

  load();
})();
