import mongoose from 'mongoose';
import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config';
import { Notification, NotificationPreference, User } from '../../db/mongo/models';
import { NotificationType } from '../../types/request';

export interface CreateNotificationInput {
  userId: string;
  type?: NotificationType;
  title: string;
  body?: string;
  link?: string;
  requestId?: string;
  channels?: Array<'in_app' | 'email' | 'webhook'>;
  dedupeKey?: string;
}

let mailer: Transporter | null = null;

function getMailer(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!mailer) {
    mailer = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return mailer;
}

async function getPreferences(userId: string) {
  const prefs = await NotificationPreference.findOne({ userId }).lean();
  return {
    inApp: prefs?.inApp !== false,
    email: Boolean(prefs?.email),
    webhook: Boolean(prefs?.webhook),
    types: prefs?.types || [],
  };
}

async function sendEmail(userId: string, title: string, body: string, link?: string) {
  const transporter = getMailer();
  if (!transporter) return false;
  const user = await User.findById(userId).select('email').lean();
  if (!user?.email) return false;
  const url = link ? `${env.APP_BASE_URL}${link}` : env.APP_BASE_URL;
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: user.email,
    subject: `[InfoSec] ${title}`,
    text: `${body}\n\n${url}`,
  });
  return true;
}

/**
 * Send an email to an arbitrary address (used for client CVE subscribers that
 * are not app users).
 */
export async function sendEmailToAddress(to: string, title: string, body: string, link?: string) {
  const transporter = getMailer();
  if (!transporter || !to) return false;
  const url = link ? `${env.APP_BASE_URL}${link}` : env.APP_BASE_URL;
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: `[InfoSec] ${title}`,
    text: `${body}\n\n${url}`,
  });
  return true;
}


async function sendWebhook(title: string, body: string, link?: string) {
  if (!env.NOTIFY_WEBHOOK_URL) return false;
  await fetch(env.NOTIFY_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `*${title}*\n${body}${link ? `\n${env.APP_BASE_URL}${link}` : ''}`,
    }),
  });
  return true;
}

export async function createNotification(input: CreateNotificationInput) {
  const prefs = await getPreferences(input.userId);
  const channels = input.channels || [
    ...(prefs.inApp ? ['in_app' as const] : []),
    ...(prefs.email ? ['email' as const] : []),
    ...(prefs.webhook ? ['webhook' as const] : []),
  ];

  let notification: any = null;
  try {
    notification = await Notification.create({
      userId: input.userId,
      type: input.type || 'system',
      title: input.title,
      body: input.body,
      link: input.link,
      requestId: input.requestId && mongoose.Types.ObjectId.isValid(input.requestId) ? input.requestId : undefined,
      channels,
      sentAt: new Date(),
      dedupeKey: input.dedupeKey,
    });
  } catch (error: any) {
    if (error?.code === 11000) return null;
    throw error;
  }

  await Promise.allSettled([
    channels.includes('email') ? sendEmail(input.userId, input.title, input.body || '', input.link) : Promise.resolve(),
    channels.includes('webhook') ? sendWebhook(input.title, input.body || '', input.link) : Promise.resolve(),
  ]);

  return notification;
}

export async function notifyMentions(data: {
  userIds: string[];
  requestId: string;
  authorName: string;
  body: string;
}) {
  await Promise.allSettled(
    data.userIds.map((userId) =>
      createNotification({
        userId,
        type: 'mention',
        title: `${data.authorName} te ha mencionado`,
        body: data.body.slice(0, 300),
        link: `/requests/${data.requestId}`,
        requestId: data.requestId,
        dedupeKey: `mention:${data.requestId}:${userId}:${Date.now()}`,
      })
    )
  );
}

export async function notifyAssignment(data: {
  userId: string;
  requestId: string;
  requestKey: string;
  title: string;
}) {
  return createNotification({
    userId: data.userId,
    type: 'assignment',
    title: `Te han asignado ${data.requestKey}`,
    body: data.title,
    link: `/requests/${data.requestId}`,
    requestId: data.requestId,
    dedupeKey: `assignment:${data.requestId}:${data.userId}`,
  });
}

export async function listNotifications(userId: string, options: { unreadOnly?: boolean; page?: number; limit?: number } = {}) {
  const query: Record<string, any> = { userId };
  if (options.unreadOnly) query.readAt = null;
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 30));
  const [items, total, unread] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ userId, readAt: null }),
  ]);
  return { items, total, unread, page, limit };
}

export async function markNotificationRead(userId: string, id: string) {
  return Notification.findOneAndUpdate({ _id: id, userId }, { readAt: new Date() }, { new: true });
}

export async function markAllNotificationsRead(userId: string) {
  await Notification.updateMany({ userId, readAt: null }, { readAt: new Date() });
}

export async function getNotificationPreferences(userId: string) {
  const prefs = await NotificationPreference.findOne({ userId }).lean();
  return {
    userId,
    inApp: prefs?.inApp !== false,
    email: Boolean(prefs?.email),
    webhook: Boolean(prefs?.webhook),
    types: prefs?.types || [],
  };
}

export async function saveNotificationPreferences(userId: string, data: Record<string, any>) {
  return NotificationPreference.findOneAndUpdate(
    { userId },
    { $set: { ...data, userId } },
    { upsert: true, new: true }
  );
}
