const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL nao configurada. Defina no ambiente para conectar ao Supabase Postgres.");
}

const useSsl = process.env.DB_SSL === "true";

const pool = new Pool({
  connectionString: DATABASE_URL,
  family: 4,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

async function query(text, params = []) {
  return pool.query(text, params);
}

function randomId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function initDatabase() {
  await query(`
    create table if not exists users (
      id text primary key,
      name text not null,
      email text not null unique,
      role text not null check (role in ('owner','admin','member')),
      status text not null check (status in ('active','inactive')),
      password_hash text not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    );

    create table if not exists smtp_settings (
      id int primary key check (id = 1),
      host text not null default '',
      port int not null default 587,
      security text not null default 'tls' check (security in ('tls','ssl','none')),
      username text not null default '',
      password text not null default '',
      from_email text not null default '',
      updated_at timestamptz not null
    );

    create table if not exists surveys (
      id text primary key,
      title text not null,
      description text not null default '',
      status text not null check (status in ('draft','active','closed')),
      questions jsonb not null default '[]'::jsonb,
      created_by text not null references users(id),
      created_at timestamptz not null,
      updated_at timestamptz not null,
      launched_at timestamptz null
    );

    create table if not exists survey_respondents (
      survey_id text not null references surveys(id) on delete cascade,
      email text not null,
      created_at timestamptz not null,
      primary key (survey_id, email)
    );

    create table if not exists responses (
      id text primary key,
      survey_id text not null references surveys(id) on delete cascade,
      respondent_email text not null,
      answers jsonb not null,
      submitted_at timestamptz not null
    );

    create table if not exists email_logs (
      id text primary key,
      survey_id text not null references surveys(id) on delete cascade,
      sent int not null default 0,
      failed int not null default 0,
      created_at timestamptz not null
    );
  `);
}

module.exports = {
  query,
  randomId,
  initDatabase,
  pool
};
