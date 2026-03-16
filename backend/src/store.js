const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

function ensureSeed() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    return;
  }

  const now = new Date().toISOString();
  const adminId = cryptoRandomId("usr");
  const surveyId = cryptoRandomId("srv");

  const seed = {
    users: [
      {
        id: adminId,
        name: "Administrador",
        email: "admin@pulsecliente.local",
        role: "owner",
        status: "active",
        passwordHash: bcrypt.hashSync("admin123", 10),
        createdAt: now,
        updatedAt: now
      }
    ],
    smtp: {
      host: "",
      port: 587,
      security: "tls",
      username: "",
      password: "",
      fromEmail: "",
      updatedAt: now
    },
    surveys: [
      {
        id: surveyId,
        title: "Satisfacao inicial de onboarding",
        description: "Pesquisa modelo para validacao do sistema.",
        status: "draft",
        questions: [
          {
            id: cryptoRandomId("qst"),
            text: "Como voce avalia sua experiencia inicial?",
            type: "multiple_choice",
            required: true,
            randomizeOptions: false,
            options: ["Excelente", "Boa", "Regular", "Ruim"]
          }
        ],
        respondentEmails: [],
        createdBy: adminId,
        createdAt: now,
        updatedAt: now,
        launchedAt: null
      }
    ],
    responses: [],
    emailLogs: []
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
}

function readDb() {
  ensureSeed();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDb(nextDb) {
  fs.writeFileSync(DB_PATH, JSON.stringify(nextDb, null, 2));
}

function withDb(mutator) {
  const db = readDb();
  const result = mutator(db);
  writeDb(db);
  return result;
}

function cryptoRandomId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = {
  readDb,
  withDb,
  cryptoRandomId
};
