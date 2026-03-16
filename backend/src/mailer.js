const nodemailer = require("nodemailer");

function buildTransportFromConfig(smtpConfig) {
  if (!smtpConfig.host || !smtpConfig.username || !smtpConfig.password || !smtpConfig.fromEmail) {
    throw new Error("SMTP incompleto. Configure host, usuario, senha e e-mail remetente.");
  }

  const secure = smtpConfig.security === "ssl";

  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: Number(smtpConfig.port || (secure ? 465 : 587)),
    secure,
    auth: {
      user: smtpConfig.username,
      pass: smtpConfig.password
    },
    requireTLS: smtpConfig.security === "tls"
  });
}

async function testSmtpConnection(smtpConfig) {
  const transporter = buildTransportFromConfig(smtpConfig);
  await transporter.verify();
}

async function sendMail(smtpConfig, { to, subject, html }) {
  const transporter = buildTransportFromConfig(smtpConfig);
  return transporter.sendMail({
    from: smtpConfig.fromEmail,
    to,
    subject,
    html
  });
}

module.exports = {
  testSmtpConnection,
  sendMail
};
