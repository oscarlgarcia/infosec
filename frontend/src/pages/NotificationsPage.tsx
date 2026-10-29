import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { notificationsApi } from '../api/notifications';
import type { AppNotification, NotificationPreferences } from '../types/request360';
import { EmptyState, ErrorBanner, Loading, formatDateTime } from '../components/request360/badges';

const PREFERENCE_TYPES = ['sla_at_risk', 'sla_breached', 'assignment', 'mention', 'deliverable_sent', 'cve', 'followup'];

export function NotificationsPage() {
  const { language } = useLanguage();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await notificationsApi.list({ unread: unreadOnly, page, limit: 30 });
      setItems(response.items);
      setUnread(response.unread);
      setTotal(response.total);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly]);

  const loadPreferences = useCallback(async () => {
    try {
      setPreferences(await notificationsApi.getPreferences());
    } catch {
      // Preferences are optional
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const markRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setItems((current) => current.map((item) => (item._id === id ? { ...item, readAt: new Date().toISOString() } : item)));
      setUnread((current) => Math.max(0, current - 1));
    } catch (err: any) {
      setError(err.message || 'Error');
    }
  };

  const markAllRead = async () => {
    setBusy(true);
    try {
      await notificationsApi.markAllRead();
      await load();
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const savePreferences = async () => {
    if (!preferences) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await notificationsApi.savePreferences({
        inApp: preferences.inApp,
        email: preferences.email,
        webhook: preferences.webhook,
        types: preferences.types,
      });
      setPreferences(saved);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const toggleType = (type: string) => {
    if (!preferences) return;
    const types = preferences.types || [];
    setPreferences({
      ...preferences,
      types: types.includes(type) ? types.filter((item) => item !== type) : [...types, type],
    });
  };

  return (
    <Layout>
      <div className="r360-page">
        <div className="r360-page-header">
          <div>
            <h1>{language === 'es' ? 'Notificaciones' : 'Notifications'}</h1>
            <p className="r360-subtitle">
              {unread > 0
                ? language === 'es' ? `${unread} sin leer de ${total}` : `${unread} unread of ${total}`
                : language === 'es' ? 'Todo al día' : 'You are all caught up'}
            </p>
          </div>
          <div className="r360-header-actions">
            <label className="r360-checkbox">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => { setPage(1); setUnreadOnly(event.target.checked); }}
              />
              {language === 'es' ? 'Solo no leídas' : 'Unread only'}
            </label>
            <button className="r360-btn" disabled={busy || unread === 0} onClick={markAllRead}>
              ✓ {language === 'es' ? 'Marcar todas' : 'Mark all read'}
            </button>
          </div>
        </div>

        <ErrorBanner error={error} />

        {loading ? (
          <Loading lang={language} />
        ) : items.length === 0 ? (
          <EmptyState icon="🔔" title={language === 'es' ? 'Sin notificaciones' : 'No notifications'} />
        ) : (
          <div className="r360-card r360-section">
            <div className="r360-notification-list">
              {items.map((notification) => (
                <div key={notification._id} className={`r360-notification ${notification.readAt ? '' : 'unread'}`}>
                  <div className="r360-notification-main">
                    <div className="r360-notification-head">
                      <strong>{notification.title}</strong>
                      <span className="r360-badge r360-status-new">{notification.type}</span>
                      <span className="r360-muted">{formatDateTime(notification.createdAt, language)}</span>
                    </div>
                    {notification.body && <div className="r360-event-text">{notification.body}</div>}
                    <div className="r360-inline-group">
                      {notification.link && (
                        <Link className="r360-link" to={notification.link} onClick={() => !notification.readAt && markRead(notification._id)}>
                          {language === 'es' ? 'Abrir' : 'Open'}
                        </Link>
                      )}
                      {!notification.readAt && (
                        <button className="r360-btn" onClick={() => markRead(notification._id)}>
                          {language === 'es' ? 'Marcar leída' : 'Mark read'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="r360-pagination">
          <button className="r360-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← {language === 'es' ? 'Anterior' : 'Previous'}</button>
          <span>{language === 'es' ? `Página ${page}` : `Page ${page}`}</span>
          <button className="r360-btn" disabled={items.length < 30} onClick={() => setPage((p) => p + 1)}>{language === 'es' ? 'Siguiente' : 'Next'} →</button>
        </div>

        {preferences && (
          <div className="r360-card r360-section">
            <div className="r360-section-head"><h2>{language === 'es' ? 'Preferencias' : 'Preferences'}</h2></div>
            <div className="r360-inline-group">
              <label className="r360-checkbox">
                <input type="checkbox" checked={preferences.inApp} onChange={(event) => setPreferences({ ...preferences, inApp: event.target.checked })} />
                {language === 'es' ? 'En la aplicación' : 'In-app'}
              </label>
              <label className="r360-checkbox">
                <input type="checkbox" checked={preferences.email} onChange={(event) => setPreferences({ ...preferences, email: event.target.checked })} />
                Email
              </label>
              <label className="r360-checkbox">
                <input type="checkbox" checked={preferences.webhook} onChange={(event) => setPreferences({ ...preferences, webhook: event.target.checked })} />
                Webhook
              </label>
            </div>
            <div className="r360-chip-list r360-preferences-types">
              {PREFERENCE_TYPES.map((type) => (
                <label key={type} className="r360-checkbox">
                  <input type="checkbox" checked={(preferences.types || []).includes(type)} onChange={() => toggleType(type)} />
                  {type}
                </label>
              ))}
            </div>
            <div className="r360-inline-group">
              <button className="r360-btn r360-btn-primary" disabled={busy} onClick={savePreferences}>
                {language === 'es' ? 'Guardar preferencias' : 'Save preferences'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
