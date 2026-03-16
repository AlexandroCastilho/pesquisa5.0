require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { parse } = require("csv-parse/sync");
const { signToken, requireAuth, requireRole } = require("./auth");
const { testSmtpConnection, sendMail } = require("./mailer");
const { query, randomId, initDatabase } = require("./db");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function sanitizeUserRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
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

async function getSmtpConfig() {
  const result = await query("select * from smtp_settings where id = 1");
  if (result.rows.length === 0) {
    const now = new Date().toISOString();
    await query(
      "insert into smtp_settings (id, host, port, security, username, password, from_email, updated_at) values (1, '', 587, 'tls', '', '', '', $1)",
      [now]
    );
    const next = await query("select * from smtp_settings where id = 1");
    return next.rows[0];
  }
  return result.rows[0];
}

async function seedIfNeeded() {
  const users = await query("select count(*)::int as count from users");
  if (users.rows[0].count > 0) {
    await getSmtpConfig();
    return;
  }

  const now = new Date().toISOString();
  const adminId = randomId("usr");
  const surveyId = randomId("srv");

  await query(
    "insert into users (id, name, email, role, status, password_hash, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8)",
    [adminId, "Administrador", "admin@pulsecliente.local", "owner", "active", bcrypt.hashSync("admin123", 10), now, now]
  );

  await query(
    "insert into surveys (id, title, description, status, questions, created_by, created_at, updated_at, launched_at) values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)",
    [
      surveyId,
      "Satisfacao inicial de onboarding",
      "Pesquisa modelo para validacao do sistema.",
      "draft",
      JSON.stringify([
        {
          id: randomId("qst"),
          text: "Como voce avalia sua experiencia inicial?",
          type: "multiple_choice",
          required: true,
          randomizeOptions: false,
          options: ["Excelente", "Boa", "Regular", "Ruim"]
        }
      ]),
      adminId,
      now,
      now,
      null
    ]
  );

  await getSmtpConfig();
}

async function getSurveyWithCounts({ search = "", status = "", sort = "recent" } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`lower(s.title) like $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`s.status = $${params.length}`);
  }

  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

  let orderBy = "s.created_at desc";
  if (sort === "oldest") orderBy = "s.created_at asc";
  if (sort === "title") orderBy = "s.title asc";

  const sql = `
    select
      s.*,
      coalesce(r.response_count, 0) as response_count,
      coalesce(rr.respondent_count, 0) as respondent_count
    from surveys s
    left join (
      select survey_id, count(*)::int as response_count
      from responses
      group by survey_id
    ) r on r.survey_id = s.id
    left join (
      select survey_id, count(*)::int as respondent_count
      from survey_respondents
      group by survey_id
    ) rr on rr.survey_id = s.id
    ${where}
    order by ${orderBy}
  `;

  const result = await query(sql, params);
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    questions: row.questions || [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    launchedAt: row.launched_at,
    responseCount: row.response_count,
    respondentCount: row.respondent_count
  }));
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Informe e-mail e senha." });
  }

  const userResult = await query("select * from users where lower(email) = lower($1) limit 1", [email]);
  const user = userResult.rows[0];

  if (!user) {
    return res.status(401).json({ message: "Credenciais invalidas." });
  }

  if (user.status !== "active") {
    return res.status(403).json({ message: "Usuario inativo." });
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ message: "Credenciais invalidas." });
  }

  const safeUser = sanitizeUserRow(user);
  const token = signToken({ id: safeUser.id, email: safeUser.email, role: safeUser.role, name: safeUser.name });
  return res.json({ token, user: safeUser });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const userResult = await query("select * from users where id = $1 limit 1", [req.user.id]);
  const user = userResult.rows[0];
  if (!user) {
    return res.status(404).json({ message: "Usuario nao encontrado." });
  }
  return res.json({ user: sanitizeUserRow(user) });
});

app.get("/api/dashboard", requireAuth, async (req, res) => {
  const statsResult = await query(`
    select
      count(*) filter (where status = 'active')::int as active_surveys,
      count(*) filter (where status = 'closed')::int as finished_surveys,
      count(*) filter (where status = 'draft')::int as draft_surveys
    from surveys
  `);

  const totalResponsesResult = await query("select count(*)::int as total_responses from responses");
  const invitesResult = await query("select count(*)::int as total_invites from survey_respondents");

  const totalResponses = totalResponsesResult.rows[0].total_responses;
  const totalInvites = invitesResult.rows[0].total_invites;
  const responseRate = totalInvites > 0 ? Number(((totalResponses / totalInvites) * 100).toFixed(1)) : 0;

  const recentSurveys = await getSurveyWithCounts({ sort: "recent" });

  return res.json({
    stats: {
      activeSurveys: statsResult.rows[0].active_surveys,
      finishedSurveys: statsResult.rows[0].finished_surveys,
      draftSurveys: statsResult.rows[0].draft_surveys,
      responseRate,
      totalResponses
    },
    recentSurveys: recentSurveys.slice(0, 5)
  });
});

app.get("/api/users", requireAuth, async (req, res) => {
  const result = await query("select * from users order by created_at desc");
  res.json({ users: result.rows.map(sanitizeUserRow) });
});

app.post("/api/users", requireAuth, requireRole(["owner", "admin"]), async (req, res) => {
  const { name, email, role = "member", status = "active", password = "123456" } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ message: "Nome e e-mail sao obrigatorios." });
  }

  const exists = await query("select id from users where lower(email) = lower($1) limit 1", [email]);
  if (exists.rows.length > 0) {
    return res.status(409).json({ message: "Ja existe usuario com este e-mail." });
  }

  const now = new Date().toISOString();
  const id = randomId("usr");

  await query(
    "insert into users (id, name, email, role, status, password_hash, created_at, updated_at) values ($1,$2,lower($3),$4,$5,$6,$7,$8)",
    [id, name, email, role, status, bcrypt.hashSync(password, 10), now, now]
  );

  const created = await query("select * from users where id = $1", [id]);
  return res.status(201).json({ user: sanitizeUserRow(created.rows[0]) });
});

app.put("/api/users/:id", requireAuth, requireRole(["owner", "admin"]), async (req, res) => {
  const { id } = req.params;
  const { name, role, status, password } = req.body || {};

  const found = await query("select * from users where id = $1", [id]);
  const user = found.rows[0];
  if (!user) {
    return res.status(404).json({ message: "Usuario nao encontrado." });
  }

  const nextName = name || user.name;
  const nextRole = role || user.role;
  const nextStatus = status || user.status;
  const nextHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;
  const now = new Date().toISOString();

  await query(
    "update users set name=$1, role=$2, status=$3, password_hash=$4, updated_at=$5 where id=$6",
    [nextName, nextRole, nextStatus, nextHash, now, id]
  );

  const updated = await query("select * from users where id = $1", [id]);
  return res.json({ user: sanitizeUserRow(updated.rows[0]) });
});

app.delete("/api/users/:id", requireAuth, requireRole(["owner"]), async (req, res) => {
  const deleted = await query("delete from users where id = $1 returning id", [req.params.id]);
  if (deleted.rows.length === 0) {
    return res.status(404).json({ message: "Usuario nao encontrado." });
  }
  return res.json({ ok: true });
});

app.get("/api/smtp", requireAuth, requireRole(["owner", "admin"]), async (req, res) => {
  const smtp = await getSmtpConfig();
  const safeConfig = {
    host: smtp.host,
    port: smtp.port,
    security: smtp.security,
    username: smtp.username,
    fromEmail: smtp.from_email,
    updatedAt: smtp.updated_at
  };
  res.json({ smtp: safeConfig, hasPassword: Boolean(smtp.password) });
});

app.put("/api/smtp", requireAuth, requireRole(["owner", "admin"]), async (req, res) => {
  const { host, port, security, username, password, fromEmail } = req.body || {};
  const smtp = await getSmtpConfig();

  const next = {
    host: host ?? smtp.host,
    port: Number(port ?? smtp.port ?? 587),
    security: security ?? smtp.security,
    username: username ?? smtp.username,
    password: password || smtp.password,
    from_email: fromEmail ?? smtp.from_email,
    updated_at: new Date().toISOString()
  };

  await query(
    "update smtp_settings set host=$1, port=$2, security=$3, username=$4, password=$5, from_email=$6, updated_at=$7 where id=1",
    [next.host, next.port, next.security, next.username, next.password, next.from_email, next.updated_at]
  );

  res.json({
    smtp: {
      host: next.host,
      port: next.port,
      security: next.security,
      username: next.username,
      fromEmail: next.from_email,
      updatedAt: next.updated_at
    },
    hasPassword: Boolean(next.password)
  });
});

app.post("/api/smtp/test", requireAuth, requireRole(["owner", "admin"]), async (req, res) => {
  try {
    const smtp = await getSmtpConfig();
    await testSmtpConnection({
      host: smtp.host,
      port: smtp.port,
      security: smtp.security,
      username: smtp.username,
      password: smtp.password,
      fromEmail: smtp.from_email
    });
    return res.json({ ok: true, message: "Conexao SMTP validada com sucesso." });
  } catch (err) {
    return res.status(400).json({ ok: false, message: err.message });
  }
});

app.get("/api/surveys", requireAuth, async (req, res) => {
  const { search = "", status = "", sort = "recent" } = req.query;
  const surveys = await getSurveyWithCounts({ search: String(search), status: String(status), sort: String(sort) });
  return res.json({ surveys });
});

app.post("/api/surveys", requireAuth, async (req, res) => {
  const { title, description = "", questions = [] } = req.body || {};
  if (!title) {
    return res.status(400).json({ message: "Titulo da pesquisa e obrigatorio." });
  }

  const now = new Date().toISOString();
  const id = randomId("srv");

  await query(
    "insert into surveys (id, title, description, status, questions, created_by, created_at, updated_at, launched_at) values ($1,$2,$3,'draft',$4::jsonb,$5,$6,$7,$8)",
    [id, title, description, JSON.stringify(questions), req.user.id, now, now, null]
  );

  const created = await query("select * from surveys where id = $1", [id]);
  const row = created.rows[0];

  return res.status(201).json({
    survey: {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      questions: row.questions,
      respondentEmails: [],
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      launchedAt: row.launched_at
    }
  });
});

app.get("/api/surveys/:id", requireAuth, async (req, res) => {
  const surveyResult = await query("select * from surveys where id = $1", [req.params.id]);
  const survey = surveyResult.rows[0];
  if (!survey) {
    return res.status(404).json({ message: "Pesquisa nao encontrada." });
  }

  const respondentsResult = await query("select email from survey_respondents where survey_id = $1 order by email", [req.params.id]);
  const responsesResult = await query("select * from responses where survey_id = $1 order by submitted_at desc", [req.params.id]);

  return res.json({
    survey: {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      status: survey.status,
      questions: survey.questions || [],
      respondentEmails: respondentsResult.rows.map((r) => r.email),
      createdBy: survey.created_by,
      createdAt: survey.created_at,
      updatedAt: survey.updated_at,
      launchedAt: survey.launched_at
    },
    responses: responsesResult.rows.map((row) => ({
      id: row.id,
      surveyId: row.survey_id,
      respondentEmail: row.respondent_email,
      answers: row.answers,
      submittedAt: row.submitted_at
    }))
  });
});

app.put("/api/surveys/:id", requireAuth, async (req, res) => {
  const payload = req.body || {};
  const surveyResult = await query("select * from surveys where id = $1", [req.params.id]);
  const survey = surveyResult.rows[0];
  if (!survey) {
    return res.status(404).json({ message: "Pesquisa nao encontrada." });
  }

  const next = {
    title: payload.title ?? survey.title,
    description: payload.description ?? survey.description,
    status: payload.status ?? survey.status,
    questions: payload.questions ?? survey.questions,
    updatedAt: new Date().toISOString()
  };

  await query(
    "update surveys set title=$1, description=$2, status=$3, questions=$4::jsonb, updated_at=$5 where id=$6",
    [next.title, next.description, next.status, JSON.stringify(next.questions || []), next.updatedAt, req.params.id]
  );

  if (payload.respondentEmails !== undefined && Array.isArray(payload.respondentEmails)) {
    await query("delete from survey_respondents where survey_id = $1", [req.params.id]);
    for (const email of payload.respondentEmails.map((x) => String(x).trim().toLowerCase()).filter(Boolean)) {
      await query(
        "insert into survey_respondents (survey_id, email, created_at) values ($1,$2,$3) on conflict (survey_id, email) do nothing",
        [req.params.id, email, new Date().toISOString()]
      );
    }
  }

  const updatedSurvey = await query("select * from surveys where id = $1", [req.params.id]);
  const respondentsResult = await query("select email from survey_respondents where survey_id = $1 order by email", [req.params.id]);

  return res.json({
    survey: {
      id: updatedSurvey.rows[0].id,
      title: updatedSurvey.rows[0].title,
      description: updatedSurvey.rows[0].description,
      status: updatedSurvey.rows[0].status,
      questions: updatedSurvey.rows[0].questions,
      respondentEmails: respondentsResult.rows.map((r) => r.email),
      createdBy: updatedSurvey.rows[0].created_by,
      createdAt: updatedSurvey.rows[0].created_at,
      updatedAt: updatedSurvey.rows[0].updated_at,
      launchedAt: updatedSurvey.rows[0].launched_at
    }
  });
});

app.delete("/api/surveys/:id", requireAuth, async (req, res) => {
  const deleted = await query("delete from surveys where id = $1 returning id", [req.params.id]);
  if (deleted.rows.length === 0) {
    return res.status(404).json({ message: "Pesquisa nao encontrada." });
  }
  return res.json({ ok: true });
});

app.post("/api/surveys/:id/respondents/import", requireAuth, upload.single("file"), async (req, res) => {
  const fromBody = Array.isArray(req.body?.emails) ? req.body.emails : [];
  const fromText = typeof req.body?.emails === "string" ? req.body.emails.split(/[\n,;]+/) : [];
  const fromCsv = req.file ? parseCsvEmails(req.file.buffer) : [];
  const merged = new Set([...fromBody, ...fromText, ...fromCsv].map((e) => String(e).trim().toLowerCase()).filter(Boolean));

  const surveyExists = await query("select id from surveys where id = $1", [req.params.id]);
  if (surveyExists.rows.length === 0) {
    return res.status(404).json({ message: "Pesquisa nao encontrada." });
  }

  let added = 0;
  for (const email of merged) {
    const inserted = await query(
      "insert into survey_respondents (survey_id, email, created_at) values ($1,$2,$3) on conflict (survey_id, email) do nothing returning email",
      [req.params.id, email, new Date().toISOString()]
    );
    if (inserted.rows.length > 0) {
      added += 1;
    }
  }

  await query("update surveys set updated_at = $1 where id = $2", [new Date().toISOString(), req.params.id]);
  const respondentsResult = await query("select email from survey_respondents where survey_id = $1 order by email", [req.params.id]);

  return res.json({
    added,
    total: respondentsResult.rows.length,
    respondentEmails: respondentsResult.rows.map((r) => r.email)
  });
});

app.post("/api/surveys/:id/launch", requireAuth, async (req, res) => {
  const surveyResult = await query("select * from surveys where id = $1", [req.params.id]);
  const survey = surveyResult.rows[0];
  if (!survey) {
    return res.status(404).json({ message: "Pesquisa nao encontrada." });
  }

  const respondentsResult = await query("select email from survey_respondents where survey_id = $1", [req.params.id]);
  const emails = respondentsResult.rows.map((row) => row.email);
  if (emails.length === 0) {
    return res.status(400).json({ message: "Nenhum e-mail importado para disparo." });
  }

  const smtp = await getSmtpConfig();
  const smtpConfig = {
    host: smtp.host,
    port: smtp.port,
    security: smtp.security,
    username: smtp.username,
    password: smtp.password,
    fromEmail: smtp.from_email
  };

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
      await sendMail(smtpConfig, { to, subject, html });
      sent += 1;
    } catch (err) {
      failed += 1;
    }
  }

  const now = new Date().toISOString();
  await query("update surveys set status = 'active', launched_at = $1, updated_at = $1 where id = $2", [now, req.params.id]);
  await query("insert into email_logs (id, survey_id, sent, failed, created_at) values ($1,$2,$3,$4,$5)", [
    randomId("eml"),
    req.params.id,
    sent,
    failed,
    now
  ]);

  return res.json({ ok: true, sent, failed, total: emails.length });
});

app.get("/api/surveys/:id/responses", requireAuth, async (req, res) => {
  const survey = await query("select id from surveys where id = $1", [req.params.id]);
  if (survey.rows.length === 0) {
    return res.status(404).json({ message: "Pesquisa nao encontrada." });
  }

  const responses = await query("select * from responses where survey_id = $1 order by submitted_at desc", [req.params.id]);

  return res.json({
    responses: responses.rows.map((row) => ({
      id: row.id,
      surveyId: row.survey_id,
      respondentEmail: row.respondent_email,
      answers: row.answers,
      submittedAt: row.submitted_at
    })),
    total: responses.rows.length
  });
});

app.post("/api/public/surveys/:id/responses", async (req, res) => {
  const { respondentEmail, answers } = req.body || {};
  if (!respondentEmail || !answers || typeof answers !== "object") {
    return res.status(400).json({ message: "Dados de resposta invalidos." });
  }

  const surveyResult = await query("select * from surveys where id = $1", [req.params.id]);
  const survey = surveyResult.rows[0];
  if (!survey) {
    return res.status(404).json({ message: "Pesquisa nao encontrada." });
  }
  if (survey.status !== "active") {
    return res.status(400).json({ message: "Pesquisa nao esta ativa para respostas." });
  }

  const response = {
    id: randomId("rsp"),
    surveyId: survey.id,
    respondentEmail: String(respondentEmail).toLowerCase(),
    answers,
    submittedAt: new Date().toISOString()
  };

  await query(
    "insert into responses (id, survey_id, respondent_email, answers, submitted_at) values ($1,$2,$3,$4::jsonb,$5)",
    [response.id, response.surveyId, response.respondentEmail, JSON.stringify(response.answers), response.submittedAt]
  );

  await query("update surveys set updated_at = $1 where id = $2", [new Date().toISOString(), survey.id]);

  return res.status(201).json({ response });
});

const siteDir = path.join(__dirname, "..", "..", "site");
app.use("/site", express.static(siteDir));
app.get("/", (req, res) => {
  res.redirect("/site/pages/desktop/login.html");
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Erro interno no servidor." });
});

async function bootstrap() {
  await initDatabase();
  await seedIfNeeded();

  app.listen(PORT, () => {
    console.log(`PulseCliente backend SQL iniciado em http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  if (err && err.code === "ENETUNREACH") {
    console.error("Falha de rede ao conectar no Postgres. Se estiver usando Supabase, utilize a DATABASE_URL do Session pooler (porta 6543), que costuma funcionar em ambientes sem IPv6.");
  }
  console.error("Falha ao iniciar backend:", err);
  process.exit(1);
});
