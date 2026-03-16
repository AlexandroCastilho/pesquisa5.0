(function () {
  if (!window.PC_API || window.location.pathname.indexOf("smtp.html") === -1) {
    return;
  }

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
      alert("Configuracoes SMTP salvas.");
      form.password.value = "";
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById("btn-test-smtp").addEventListener("click", async function () {
    try {
      await window.PC_API.request("/smtp/test", { method: "POST" });
      alert("Conexao SMTP validada com sucesso.");
    } catch (err) {
      alert(err.message);
    }
  });

  load();
})();
