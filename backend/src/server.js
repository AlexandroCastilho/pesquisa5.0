const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { parse } = require("csv-parse/sync");
const { readDb, withDb, cryptoRandomId } = require("./store");
const { signToken, requireAuth, requireRole } = require("./auth");
const { testSmtpConnection, sendMail } = require("./mailer");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function responseCountForSurvey(db, surveyId) {
  return db.responses.filter((r) => r.surveyId === surveyId).length;
}

function parseCsvEmails(buffer) {
  const csvText = buffer.toString("utf-8");
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  const set = new Set();
  for (const row of rows) {
    const email = row.email || row.Email || row.EMAIL;
    if (email) {
      set.add(String(email).toLowerCase());
    }
  }
  return Array.from(set);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Informe e-mail e senha." });
  }

  const db = readDb();
  const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) {
    return res.status(401).json({ message: "Credenciais invalidas." });
  }

  if (user.status !== "active") {
    return res.status(403).json({ message: "Usuario inativo." });
  }

  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: "Credenciais invalidas." });
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
  return res.json({ token, user: sanitizeUser(user) });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: "Usuario nao encontrado." });
  }
  return res.json({ user: sanitizeUser(user) });
});

app.get("/api/dashboard", requireAuth, (req, res) => {
  const db = readDb();
  const activeSurveys = db.surveys.filter((s) => s.status === "active").length;
  const finishedSurveys = db.surveys.filter((s) => s.status === "closed").length;
  const draftSurveys = db.surveys.filter((s) => s.status === "draft").length;
  const totalResponses = db.responses.length;
  const totalInvites = db.surveys.reduce((acc, s) => acc + (s.respondentEmails?.length || 0), 0);
  const responseRate = totalInvites > 0 ? Number(((totalResponses / totalInvites) * 100).toFixed(1)) : 0;

  const recentSurveys = [...db.surveys]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5)
    .map((survey) => ({
      ...survey,
      responseCount: responseCountForSurvey(db, survey.id)
    }));

  return res.json({
    stats: {
      activeSurveys,
      finishedSurveys,
      draftSurveys,
      responseRate,
      totalResponses
    },
    recentSurveys
  });
});

app.get("/api/users", requireAuth, (req, res) => {
  const db = readDb();
  res.json({ users: db.users.map(sanitizeUser) });
});

app.post("/api/users", requireAuth, requireRole(["owner", "admin"]), (req, res) => {
  const { name, email, role = "member", status = "active", password = "123456" } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ message: "Nome e e-mail sao obrigatorios." });
  }

  const result = withDb((db) => {
    const exists = db.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase());
    if (exists) {
      return { error: "Ja existe usuario com este e-mail." };
    }

    const now = new Date().toISOString();
    const user = {
      id: cryptoRandomId("usr"),
      name,
      email: String(email).toLowerCase(),
      role,
      status,
      passwordHash: bcrypt.hashSync(password, 10),
      createdAt: now,
      updatedAt: now
    };

    db.users.push(user);
    return { user: sanitizeUser(user) };
  });

  if (result.error) {
    return res.status(409).json({ message: result.error });
  }

  return res.status(201).json(result);
});

app.put("/api/users/:id", requireAuth, requireRole(["owner", "admin"]), (req, res) => {
  const { id } = req.params;
  const { name, role, status, password } = req.body || {};

  const result = withDb((db) => {
    const user = db.users.find((u) => u.id === id);
    if (!user) {
      return { error: "Usuario nao encontrado." };
    }

    if (name) user.name = name;
    if (role) user.role = role;
    if (status) user.status = status;
    if (password) user.passwordHash = bcrypt.hashSync(password, 10);
    user.updatedAt = new Date().toISOString();
    return { user: sanitizeUser(user) };
  });

  if (result.error) {
    return res.status(404).json({ message: result.error });
  }

  return res.json(result);
});

app.delete("/api/users/:id", requireAuth, requireRole(["owner"]), (req, res) => {
  const { id } = req.params;
  const result = withDb((db) => {
    const before = db.users.length;
    db.users = db.users.filter((u) => u.id !== id);
    if (db.users.length === before) {
      return { error: "Usuario nao encontrado." };
    }

    return { ok: true };
  });

  if (result.error) {
    return res.status(404).json({ message: result.error });
  }

  return res.json(result);
});

app.get("/api/smtp", requireAuth, requireRole(["owner", "admin"]), (req, res) => {
  const db = readDb();
  const { password, ...safeConfig } = db.smtp;
  res.json({ smtp: safeConfig, hasPassword: Boolean(password) });
});

app.put("/api/smtp", requireAuth, requireRole(["owner", "admin"]), (req, res) => {
  const { host, port, security, username, password, fromEmail } = req.body || {};

  const smtp = withDb((db) => {
    db.smtp.host = host || db.smtp.host;
    db.smtp.port = Number(port || db.smtp.port || 587);
    db.smtp.security = security || db.smtp.security || "tls";
    db.smtp.username = username || db.smtp.username;
    if (password) {
      db.smtp.password = password;
    }
    db.smtp.fromEmail = fromEmail || db.smtp.fromEmail;
    db.smtp.updatedAt = new Date().toISOString();
    return db.smtp;
  });

  const { password: pw, ...safeConfig } = smtp;
  return res.json({ smtp: safeConfig, hasPassword: Boolean(pw) });
});

app.post("/api/smtp/test", requireAuth, requireRole(["owner", "admin"]), async (req, res) => {
  try {
    const db = readDb();
    await testSmtpConnection(db.smtp);
    return res.json({ ok: true, message: "Conexao SMTP validada com sucesso." });
  } catch (err) {
    return res.status(400).json({ ok: false, message: err.message });
  }
});

app.get("/api/surveys", requireAuth, (req, res) => {
  const { search = "", status = "", sort = "recent" } = req.query;
  const db = readDb();

  let items = db.surveys.filter((survey) => {
    if (status && survey.status !== status) {
      return false;
    }
    if (search && !survey.title.toLowerCase().includes(String(search).toLowerCase())) {
      return false;
    }
    return true;
  });

  items.sort((a, b) => {
    if (sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
    if (sort === "title") return a.title.localeCompare(b.title);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const surveys = items.map((survey) => ({
    ...survey,
    responseCount: responseCountForSurvey(db, survey.id)
  }));

  return res.json({ surveys });
});

app.post("/api/surveys", requireAuth, (req, res) => {
  const { title, description = "", questions = [] } = req.body || {};
  if (!title) {
    return res.status(400).json({ message: "Titulo da pesquisa e obrigatorio." });
  }

  const survey = withDb((db) => {
    const now = new Date().toISOString();
    const newSurvey = {
      id: cryptoRandomId("srv"),
      title,
      description,
      status: "draft",
      questions,
      respondentEmails: [],
      createdBy: req.user.id,
      createdAt: now,
      updatedAt: now,
      launchedAt: null
    };
    db.surveys.push(newSurvey);
    return newSurvey;
  });

  return res.status(201).json({ survey });
});

app.get("/api/surveys/:id", requireAuth, (req, res) => {
  const db = readDb();
  const survey = db.surveys.find((s) => s.id === req.params.id);
  if (!survey) {
    return res.status(404).json({ message: "Pesquisa nao encontrada." });
  }

  const responses = db.responses.filter((r) => r.surveyId === survey.id);
  return res.json({ survey, responses });
});

app.put("/api/surveys/:id", requireAuth, (req, res) => {
  const payload = req.body || {};
  const result = withDb((db) => {
    const survey = db.surveys.find((s) => s.id === req.params.id);
    if (!survey) {
      return { error: "Pesquisa nao encontrada." };
    }

    const editable = ["title", "description", "status", "questions", "respondentEmails"];
    for (const key of editable) {
      if (payload[key] !== undefined) {
        survey[key] = payload[key];
      }
    }
    survey.updatedAt = new Date().toISOString();
    return { survey };
  });

  if (result.error) {
    return res.status(404).json({ message: result.error });
  }

  return res.json(result);
});

app.delete("/api/surveys/:id", requireAuth, (req, res) => {
  const result = withDb((db) => {
    const before = db.surveys.length;
    db.surveys = db.surveys.filter((s) => s.id !== req.params.id);
    db.responses = db.responses.filter((r) => r.surveyId !== req.params.id);
    if (before === db.surveys.length) {
      return { error: "Pesquisa nao encontrada." };
    }
    return { ok: true };
  });

  if (result.error) {
    return res.status(404).json({ message: result.error });
  }

  return res.json(result);
});

app.post("/api/surveys/:id/respondents/import", requireAuth, upload.single("file"), (req, res) => {
  const fromBody = Array.isArray(req.body?.emails) ? req.body.emails : [];
  const fromText = typeof req.body?.emails === "string" ? req.body.emails.split(/[\n,;]+/) : [];
  const fromCsv = req.file ? parseCsvEmails(req.file.buffer) : [];
  const merged = new Set([...fromBody, ...fromText, ...fromCsv].map((e) => String(e).trim().toLowerCase()).filter(Boolean));

  const result = withDb((db) => {
    const survey = db.surveys.find((s) => s.id === req.params.id);
    if (!survey) {
      return { error: "Pesquisa nao encontrada." };
    }

    const existing = new Set((survey.respondentEmails || []).map((e) => e.toLowerCase()));
    let added = 0;
    for (const email of merged) {
      if (!existing.has(email)) {
        existing.add(email);
        added += 1;
      }
    }
    survey.respondentEmails = Array.from(existing);
    survey.updatedAt = new Date().toISOString();
    return { added, total: survey.respondentEmails.length, respondentEmails: survey.respondentEmails };
  });

  if (result.error) {
    return res.status(404).json({ message: result.error });
  }

  return res.json(result);
});

app.post("/api/surveys/:id/launch", requireAuth, async (req, res) => {
  const db = readDb();
  const survey = db.surveys.find((s) => s.id === req.params.id);
  if (!survey) {
    return res.status(404).json({ message: "Pesquisa nao encontrada." });
  }

  const emails = survey.respondentEmails || [];
  if (emails.length === 0) {
    return res.status(400).json({ message: "Nenhum e-mail importado para disparo." });
  }

  const subject = `Convite para pesquisa: ${survey.title}`;
  const html = `
    <h2>${survey.title}</h2>
    <p>${survey.description || "Voce foi convidado para responder esta pesquisa."}</p>
    <p>Use o ID da pesquisa ao responder: <strong>${survey.id}</strong>.</p>
  `;

  let sent = 0;
  let failed = 0;

  for (const to of emails) {
    try {
      await sendMail(db.smtp, { to, subject, html });
      sent += 1;
    } catch (err) {
      failed += 1;
    }
  }

  withDb((mutableDb) => {
    const mutableSurvey = mutableDb.surveys.find((s) => s.id === req.params.id);
    if (mutableSurvey) {
      mutableSurvey.status = "active";
      mutableSurvey.launchedAt = new Date().toISOString();
      mutableSurvey.updatedAt = new Date().toISOString();
    }

    mutableDb.emailLogs.push({
      id: cryptoRandomId("eml"),
      surveyId: req.params.id,
      sent,
      failed,
      createdAt: new Date().toISOString()
    });
  });

  return res.json({ ok: true, sent, failed, total: emails.length });
});

app.get("/api/surveys/:id/responses", requireAuth, (req, res) => {
  const db = readDb();
  const survey = db.surveys.find((s) => s.id === req.params.id);
  if (!survey) {
    return res.status(404).json({ message: "Pesquisa nao encontrada." });
  }

  const responses = db.responses.filter((r) => r.surveyId === req.params.id);
  return res.json({ responses, total: responses.length });
});

app.post("/api/public/surveys/:id/responses", (req, res) => {
  const { respondentEmail, answers } = req.body || {};
  if (!respondentEmail || !answers || typeof answers !== "object") {
    return res.status(400).json({ message: "Dados de resposta invalidos." });
  }

  const result = withDb((db) => {
    const survey = db.surveys.find((s) => s.id === req.params.id);
    if (!survey) {
      return { error: "Pesquisa nao encontrada." };
    }
    if (survey.status !== "active") {
      return { error: "Pesquisa nao esta ativa para respostas." };
    }

    const response = {
      id: cryptoRandomId("rsp"),
      surveyId: survey.id,
      respondentEmail: String(respondentEmail).toLowerCase(),
      answers,
      submittedAt: new Date().toISOString()
    };
    db.responses.push(response);
    survey.updatedAt = new Date().toISOString();
    return { response };
  });

  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  return res.status(201).json(result);
});

const siteDir = path.join(__dirname, "..", "..", "site");
app.use("/site", express.static(siteDir));
app.get("/", (req, res) => {
  res.redirect("/site/index.html");
});

app.listen(PORT, () => {
  console.log(`PulseCliente backend iniciado em http://localhost:${PORT}`);
});
