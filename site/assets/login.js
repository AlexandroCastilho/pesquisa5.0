(function () {
  var form = document.getElementById("login-form");
  if (!form || !window.PC_API) {
    return;
  }

  var errorEl = document.getElementById("login-error");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    var email = document.getElementById("email").value.trim();
    var password = document.getElementById("password").value;
    var submitBtn = form.querySelector("button[type='submit']");

    errorEl.textContent = "";
    submitBtn.disabled = true;

    try {
      var data = await window.PC_API.request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email, password: password })
      });

      window.PC_API.setToken(data.token);
      window.PC_API.setUser(data.user);
      window.location.href = "dashboard.html";
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
