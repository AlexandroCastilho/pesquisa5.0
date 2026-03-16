(function () {
  if (!window.PC_API || window.location.pathname.indexOf("usuarios.html") === -1) {
    return;
  }

  var tbody = document.getElementById("users-tbody");
  if (!tbody) return;

  function badgeRole(role) {
    if (role === "owner") return "Proprietario";
    if (role === "admin") return "Admin";
    return "Membro";
  }

  function badgeStatus(status) {
    return status === "active" ? "Ativo" : "Inativo";
  }

  async function loadUsers() {
    try {
      var data = await window.PC_API.request("/users");
      tbody.innerHTML = data.users.map(function (u) {
        var initials = (u.name || "U").split(" ").map(function (p) { return p.charAt(0); }).join("").slice(0, 2).toUpperCase();
        return "<tr class='hover:bg-slate-50 dark:hover:bg-primary/5 transition-colors'>" +
          "<td class='px-6 py-4 whitespace-nowrap'><div class='flex items-center gap-3'><div class='h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs'>" + initials + "</div><span class='font-medium'>" + u.name + "</span></div></td>" +
          "<td class='px-6 py-4 text-slate-500 dark:text-slate-400 whitespace-nowrap'>" + u.email + "</td>" +
          "<td class='px-6 py-4 whitespace-nowrap'><span class='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'>" + badgeRole(u.role) + "</span></td>" +
          "<td class='px-6 py-4 whitespace-nowrap'><span class='inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500'><span class='h-1.5 w-1.5 rounded-full bg-emerald-500'></span>" + badgeStatus(u.status) + "</span></td>" +
          "<td class='px-6 py-4 text-right whitespace-nowrap'><button data-edit='" + u.id + "' class='text-slate-400 hover:text-primary transition-colors p-1'><span class='material-symbols-outlined text-xl'>edit</span></button><button data-delete='" + u.id + "' class='text-slate-400 hover:text-red-500 transition-colors p-1 ml-2'><span class='material-symbols-outlined text-xl'>delete</span></button></td>" +
        "</tr>";
      }).join("");
    } catch (err) {
      alert(err.message);
    }
  }

  async function inviteUser() {
    var name = prompt("Nome do usuario:");
    if (!name) return;
    var email = prompt("Email do usuario:");
    if (!email) return;
    var role = prompt("Funcao (owner/admin/member):", "member") || "member";

    await window.PC_API.request("/users", {
      method: "POST",
      body: JSON.stringify({ name: name, email: email, role: role, status: "active", password: "123456" })
    });
    await loadUsers();
  }

  async function deleteUser(id) {
    if (!confirm("Excluir usuario?")) return;
    await window.PC_API.request("/users/" + id, { method: "DELETE" });
    await loadUsers();
  }

  async function editUser(id) {
    var role = prompt("Nova funcao (owner/admin/member):");
    var status = prompt("Novo status (active/inactive):");

    await window.PC_API.request("/users/" + id, {
      method: "PUT",
      body: JSON.stringify({ role: role || undefined, status: status || undefined })
    });
    await loadUsers();
  }

  document.getElementById("btn-invite-user").addEventListener("click", inviteUser);
  document.getElementById("btn-invite-user-bottom").addEventListener("click", inviteUser);

  tbody.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) return;
    var editId = button.getAttribute("data-edit");
    var deleteId = button.getAttribute("data-delete");

    if (editId) editUser(editId);
    if (deleteId) deleteUser(deleteId);
  });

  loadUsers();
})();
