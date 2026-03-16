(function () {
  function isLocalHost(hostname) {
    return hostname === "localhost" || hostname === "127.0.0.1";
  }

  function getDefaultApiBase() {
    var origin = window.location.origin;
    var hostname = window.location.hostname;
    var port = window.location.port;

    if (!isLocalHost(hostname)) {
      return origin + "/api";
    }

    if (port === "3000") {
      return origin + "/api";
    }

    return window.location.protocol + "//" + hostname + ":3000/api";
  }

  function getApiBase() {
    var explicitBase = window.PC_API_BASE;
    if (explicitBase) {
      return explicitBase;
    }

    var storedBase = localStorage.getItem("pc_api_base");
    var runningRemotely = !isLocalHost(window.location.hostname);

    if (storedBase) {
      var storedLooksLocal = storedBase.indexOf("http://localhost:") === 0 || storedBase.indexOf("http://127.0.0.1:") === 0;
      if (!(runningRemotely && storedLooksLocal)) {
        return storedBase;
      }
      localStorage.removeItem("pc_api_base");
    }

    return getDefaultApiBase();
  }

  var API_BASE = getApiBase();

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
