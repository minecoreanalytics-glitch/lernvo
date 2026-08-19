import nodemailer from 'nodemailer'
import { prisma } from '../utils/prisma'
import { logger } from '../utils/logger'

// Email is opt-in: silently disabled when SMTP vars are not set
const configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

const transporter = configured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null

const PLATFORM_NAME = process.env.PLATFORM_NAME || 'Lernvo'
const BASE_URL = (process.env.FRONTEND_URL || 'https://lernvo.com').replace(/\/$/, '')
const FROM = process.env.SMTP_FROM || `${PLATFORM_NAME} <noreply@${BASE_URL.replace(/^https?:\/\//, '')}>`

// ─── Template helpers ──────────────────────────────────────────────────────

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <!-- Header -->
  <tr><td style="background:#0f1923;padding:24px 32px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="width:36px;height:36px;background:#3b82f6;border-radius:8px;text-align:center;vertical-align:middle;font-size:18px">🎓</td>
      <td style="padding-left:12px;color:#ffffff;font-size:18px;font-weight:bold">${PLATFORM_NAME}</td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px">${body}</td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px">
    © ${PLATFORM_NAME} · <a href="${BASE_URL}" style="color:#6b7280;text-decoration:none">${BASE_URL.replace(/^https?:\/\//, '')}</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function btn(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:24px">
  <tr><td style="background:#3b82f6;border-radius:8px;padding:12px 24px">
    <a href="${href}" style="color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none">${text}</a>
  </td></tr></table>`
}

function greeting(firstName: string): string {
  return `<p style="color:#111827;font-size:16px;margin:0 0 8px">Bonjour <strong>${firstName}</strong>,</p>`
}

// ─── Send helper ───────────────────────────────────────────────────────────

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) return
  try {
    await transporter.sendMail({ from: FROM, to, subject, html })
    logger.info(`Email sent: "${subject}" → ${to}`)
  } catch (err) {
    logger.warn(`Email failed: "${subject}" → ${to}`, { error: (err as Error).message })
  }
}

// ─── User lookup ───────────────────────────────────────────────────────────

async function getUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true }
  })
}

// ─── Public API ───────────────────────────────────────────────────────────

export const EmailService = {
  /** Sent when an admin creates a new user account */
  async sendWelcome(userId: string, tempPassword?: string): Promise<void> {
    const user = await getUser(userId)
    if (!user) return
    const html = wrap(`Bienvenue sur ${PLATFORM_NAME}`, `
      ${greeting(user.firstName)}
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:16px 0 0">
        Votre compte ${PLATFORM_NAME} a été créé. Vous avez maintenant accès à toutes vos formations, quiz et parcours de carrière.
      </p>
      ${tempPassword ? `
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:20px 0">
        <p style="color:#0369a1;font-size:13px;margin:0 0 6px;font-weight:bold">Vos identifiants de connexion</p>
        <p style="color:#374151;font-size:13px;margin:0">Email : <strong>${user.email}</strong></p>
        <p style="color:#374151;font-size:13px;margin:4px 0 0">Mot de passe temporaire : <strong>${tempPassword}</strong></p>
        <p style="color:#64748b;font-size:12px;margin:8px 0 0">Changez votre mot de passe lors de votre première connexion.</p>
      </div>` : ''}
      ${btn('Accéder à la plateforme', BASE_URL)}
    `)
    await send(user.email, `Bienvenue sur ${PLATFORM_NAME}`, html)
  },

  /** Sent when a manager assigns a module to a user */
  async sendAssignmentReminder(userId: string, moduleTitle: string, dueAt: Date): Promise<void> {
    const user = await getUser(userId)
    if (!user) return
    const formatted = dueAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const html = wrap('Nouvelle formation assignée', `
      ${greeting(user.firstName)}
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:16px 0 0">
        Une nouvelle formation vous a été assignée :
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0">
        <p style="color:#111827;font-size:16px;font-weight:bold;margin:0">${moduleTitle}</p>
        <p style="color:#ef4444;font-size:13px;margin:8px 0 0">📅 Date limite : <strong>${formatted}</strong></p>
      </div>
      <p style="color:#374151;font-size:13px;line-height:1.6;margin:0">
        Connectez-vous pour commencer cette formation et respecter l'échéance.
      </p>
      ${btn('Voir mes formations', `${BASE_URL}/assignments`)}
    `)
    await send(user.email, `Formation assignée : ${moduleTitle}`, html)
  },

  /** Sent when an admin resets a user's password */
  async sendPasswordReset(userId: string, tempPassword: string): Promise<void> {
    const user = await getUser(userId)
    if (!user) return
    const html = wrap('Réinitialisation de mot de passe', `
      ${greeting(user.firstName)}
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:16px 0 0">
        Votre mot de passe ${PLATFORM_NAME} a été réinitialisé par un administrateur.
      </p>
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:20px 0">
        <p style="color:#92400e;font-size:13px;margin:0 0 6px;font-weight:bold">Votre nouveau mot de passe temporaire</p>
        <p style="color:#1c1917;font-size:18px;font-family:monospace;font-weight:bold;margin:0;letter-spacing:2px">${tempPassword}</p>
        <p style="color:#64748b;font-size:12px;margin:8px 0 0">Changez ce mot de passe dès votre prochaine connexion.</p>
      </div>
      ${btn('Se connecter', BASE_URL)}
    `)
    await send(user.email, `Réinitialisation de votre mot de passe ${PLATFORM_NAME}`, html)
  },

  /** Sent when a certificate is issued after module/path completion */
  async sendCertificateIssued(userId: string, certTitle: string, certNumber: string): Promise<void> {
    const user = await getUser(userId)
    if (!user) return
    const html = wrap('Certificat obtenu', `
      ${greeting(user.firstName)}
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:16px 0 0">
        Félicitations ! Vous avez obtenu un nouveau certificat de complétion :
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;text-align:center">
        <p style="font-size:32px;margin:0">🎓</p>
        <p style="color:#15803d;font-size:16px;font-weight:bold;margin:8px 0 4px">${certTitle}</p>
        <p style="color:#6b7280;font-size:12px;margin:0">N° ${certNumber}</p>
      </div>
      <p style="color:#374151;font-size:13px;line-height:1.6;margin:0">
        Ce certificat atteste de la complétion de votre formation. Vous pouvez le télécharger depuis votre profil.
      </p>
      ${btn('Voir mes certificats', `${BASE_URL}/certificates`)}
    `)
    await send(user.email, `Certificat obtenu : ${certTitle}`, html)
  },
}
