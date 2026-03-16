(function () {
  if (window.PC_DIALOG) {
    return;
  }

  function createRoot() {
    var backdrop = document.createElement("div");
    backdrop.className = "pc-dialog-backdrop";
    backdrop.innerHTML = "" +
      "<div class='pc-dialog' role='dialog' aria-modal='true' aria-live='polite'>" +
        "<h3 class='pc-dialog-title'></h3>" +
        "<p class='pc-dialog-message'></p>" +
        "<input class='pc-dialog-input' />" +
        "<div class='pc-dialog-actions'>" +
          "<button type='button' class='pc-dialog-btn pc-dialog-btn-secondary' data-action='cancel'>Cancelar</button>" +
          "<button type='button' class='pc-dialog-btn pc-dialog-btn-primary' data-action='ok'>Confirmar</button>" +
        "</div>" +
      "</div>";

    document.body.appendChild(backdrop);
    return backdrop;
  }

  var root;

  function ensureRoot() {
    if (!root) {
      root = createRoot();
    }
    return root;
  }

  function openDialog(config) {
    return new Promise(function (resolve) {
      var modalRoot = ensureRoot();
      var titleEl = modalRoot.querySelector(".pc-dialog-title");
      var msgEl = modalRoot.querySelector(".pc-dialog-message");
      var inputEl = modalRoot.querySelector(".pc-dialog-input");
      var okBtn = modalRoot.querySelector("[data-action='ok']");
      var cancelBtn = modalRoot.querySelector("[data-action='cancel']");

      titleEl.textContent = config.title || "Atenção";
      msgEl.textContent = config.message || "";
      okBtn.textContent = config.okText || "Confirmar";
      cancelBtn.textContent = config.cancelText || "Cancelar";

      var isPrompt = config.type === "prompt";
      var hasCancel = config.type !== "alert";

      inputEl.style.display = isPrompt ? "block" : "none";
      cancelBtn.style.display = hasCancel ? "inline-flex" : "none";

      if (isPrompt) {
        inputEl.value = config.defaultValue || "";
      }

      function close(value) {
        modalRoot.classList.remove("pc-dialog-open");
        modalRoot.removeEventListener("click", onBackdrop);
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        document.removeEventListener("keydown", onKeydown);
        resolve(value);
      }

      function onOk() {
        if (isPrompt) {
          close(inputEl.value);
          return;
        }
        if (config.type === "confirm") {
          close(true);
          return;
        }
        close(undefined);
      }

      function onCancel() {
        if (config.type === "confirm") {
          close(false);
          return;
        }
        close(null);
      }

      function onBackdrop(event) {
        if (event.target === modalRoot) {
          onCancel();
        }
      }

      function onKeydown(event) {
        if (event.key === "Escape") {
          onCancel();
        }
        if (event.key === "Enter") {
          onOk();
        }
      }

      modalRoot.addEventListener("click", onBackdrop);
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      document.addEventListener("keydown", onKeydown);
      modalRoot.classList.add("pc-dialog-open");

      setTimeout(function () {
        if (isPrompt) {
          inputEl.focus();
          inputEl.select();
        } else {
          okBtn.focus();
        }
      }, 20);
    });
  }

  window.PC_DIALOG = {
    alert: function (message, title) {
      return openDialog({
        type: "alert",
        title: title || "Aviso",
        message: message,
        okText: "OK"
      });
    },
    confirm: function (message, title) {
      return openDialog({
        type: "confirm",
        title: title || "Confirmação",
        message: message,
        okText: "Confirmar",
        cancelText: "Cancelar"
      });
    },
    prompt: function (message, defaultValue, title) {
      return openDialog({
        type: "prompt",
        title: title || "Informe um valor",
        message: message,
        defaultValue: defaultValue || "",
        okText: "Salvar",
        cancelText: "Cancelar"
      });
    }
  };
})();
