(function () {
  var API_BASE = window.PC_API_BASE || localStorage.getItem("pc_api_base") || "http://localhost:3000/api";

  function getToken() {
    return localStorage.getItem("pc_token");
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem("pc_token", token);
    } else {
      localStorage.removeItem("pc_token");
    }
  }

  function setUser(user) {
    if (user) {
      localStorage.setItem("pc_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("pc_user");
    }
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem("pc_user") || "null");
    } catch (err) {
      return null;
    }
  }

  async function request(path, options) {
    var opts = options || {};
    var headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    var token = getToken();
    if (token) {
      headers.Authorization = "Bearer " + token;
    }

    var resp = await fetch(API_BASE + path, Object.assign({}, opts, { headers: headers }));
    var data = null;
    try {
      data = await resp.json();
    } catch (err) {
      data = null;
    }

    if (!resp.ok) {
      var message = data && data.message ? data.message : "Erro na API";
      throw new Error(message);
    }

    return data;
  }

  window.PC_API = {
    base: API_BASE,
    request: request,
    getToken: getToken,
    setToken: setToken,
    getUser: getUser,
    setUser: setUser
  };
})();
