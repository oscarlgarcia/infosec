import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useApi } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { UserRole } from '../types';
import '../styles/App.css';

interface UserData {
  _id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

const roleLabels: Record<UserRole, { es: string; en: string }> = {
  admin: { es: 'Admin', en: 'Admin' },
  manager: { es: 'Manager', en: 'Manager' },
  sme: { es: 'SME', en: 'SME' },
  usuario: { es: 'Usuario', en: 'User' },
};

export function AdminHome() {
  const { language } = useLanguage();
  const apiFetch = useApi();

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'usuario' as UserRole,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await apiFetch('/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingUser(null);
    setError('');
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'usuario',
    });
    setShowModal(true);
  }

  function openEditModal(user: UserData) {
    setEditingUser(user);
    setError('');
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingUser(null);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const url = editingUser ? `/users/${editingUser._id}` : '/users';
    const method = editingUser ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        closeModal();
        await fetchUsers();
        return;
      }

      const data = await res.json();
      setError(
        data.message ||
          (language === 'es' ? 'Error al guardar el usuario' : 'Error saving user')
      );
    } catch {
      setError(language === 'es' ? 'Error de red' : 'Network error');
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      language === 'es' ? '¿Eliminar usuario?' : 'Delete user?'
    );
    if (!confirmed) return;

    try {
      await apiFetch(`/users/${id}`, { method: 'DELETE' });
      await fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  }

  async function handleToggleActive(user: UserData) {
    try {
      await apiFetch(`/users/${user._id}/toggle-active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      await fetchUsers();
    } catch (err) {
      console.error('Error toggling user:', err);
    }
  }

  function getRoleBadgeColor(role: UserRole) {
    switch (role) {
      case 'admin':
        return '#EF4444';
      case 'manager':
        return '#F59E0B';
      case 'sme':
        return '#3B82F6';
      default:
        return '#6B7280';
    }
  }

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      inactive: users.filter((u) => !u.isActive).length,
      byRole: {
        admin: users.filter((u) => u.role === 'admin').length,
        manager: users.filter((u) => u.role === 'manager').length,
        sme: users.filter((u) => u.role === 'sme').length,
        usuario: users.filter((u) => u.role === 'usuario').length,
      },
    };
  }, [users]);

  return (
    <Layout>
      <div className="settings-page" style={{ maxWidth: 'none' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
            flexWrap: 'wrap',
          }}
        >
          <h1 className="settings-title" style={{ marginBottom: 0 }}>
            {language === 'es' ? 'Panel de Administración' : 'Admin Dashboard'}
          </h1>

          <button type="button" className="btn-submit" onClick={openCreateModal}>
            + {language === 'es' ? 'Crear usuario' : 'Create user'}
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div className="settings-section">
            <div className="settings-section-title">
              {language === 'es' ? 'Total usuarios' : 'Total users'}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{stats.total}</div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">
              {language === 'es' ? 'Activos' : 'Active'}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{stats.active}</div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">
              {language === 'es' ? 'Inactivos' : 'Inactive'}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{stats.inactive}</div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {(['admin', 'manager', 'sme', 'usuario'] as UserRole[]).map((role) => (
            <div
              key={role}
              className="settings-section"
              style={{
                borderLeft: `6px solid ${getRoleBadgeColor(role)}`,
              }}
            >
              <div className="settings-section-title">
                {language === 'es' ? roleLabels[role].es : roleLabels[role].en}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>
                {stats.byRole[role]}
              </div>
            </div>
          ))}
        </div>

        <div className="settings-section">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '20px',
              flexWrap: 'wrap',
            }}
          >
            <h2 className="settings-section-title" style={{ marginBottom: 0 }}>
              {language === 'es' ? 'Gestión de usuarios' : 'User management'}
            </h2>
          </div>

          {loading ? (
            <div className="language-description">
              {language === 'es' ? 'Cargando...' : 'Loading...'}
            </div>
          ) : users.length === 0 ? (
            <div className="language-description">
              {language === 'es' ? 'No hay usuarios' : 'No users found'}
            </div>
          ) : (
            <div className="file-list">
              {users.map((user) => (
                <div
                  key={user._id}
                  className="file-item"
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(0, 1.4fr) minmax(0, 1.8fr) auto auto auto',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: 'var(--gray-900)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.username}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--gray-500)',
                        marginTop: '4px',
                      }}
                    >
                      {language === 'es' ? 'Usuario' : 'Username'}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: 'var(--gray-700)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.email}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--gray-500)',
                        marginTop: '4px',
                      }}
                    >
                      Email
                    </div>
                  </div>

                  <span
                    style={{
                      display: 'inline-flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: '999px',
                      backgroundColor: getRoleBadgeColor(user.role),
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {language === 'es'
                      ? roleLabels[user.role].es
                      : roleLabels[user.role].en}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(user)}
                    className={user.isActive ? 'btn-submit' : 'btn-cancel'}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '999px',
                      fontSize: '12px',
                    }}
                  >
                    {user.isActive
                      ? language === 'es'
                        ? 'Activo'
                        : 'Active'
                      : language === 'es'
                        ? 'Inactivo'
                        : 'Inactive'}
                  </button>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn-cancel"
                      style={{ padding: '8px 12px' }}
                      onClick={() => openEditModal(user)}
                    >
                      {language === 'es' ? 'Editar' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      className="btn-submit"
                      style={{
                        padding: '8px 12px',
                        background: '#EF4444',
                      }}
                      onClick={() => handleDelete(user._id)}
                    >
                      {language === 'es' ? 'Eliminar' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" type="button" onClick={closeModal}>
              ×
            </button>

            <h2 className="modal-title">
              {editingUser
                ? language === 'es'
                  ? 'Editar usuario'
                  : 'Edit user'
                : language === 'es'
                  ? 'Crear usuario'
                  : 'Create user'}
            </h2>

            {error && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: '#fff0ef',
                  border: '1px solid #f5c7c3',
                  color: '#ad2d2d',
                  fontSize: '14px',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>{language === 'es' ? 'Usuario' : 'Username'}</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, username: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  {language === 'es' ? 'Contraseña' : 'Password'}{' '}
                  {editingUser
                    ? language === 'es'
                      ? '(dejar vacío para no cambiar)'
                      : '(leave empty to keep current)'
                    : ''}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, password: e.target.value }))
                  }
                  required={!editingUser}
                />
              </div>

              <div className="form-group">
                <label>{language === 'es' ? 'Rol' : 'Role'}</label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      role: e.target.value as UserRole,
                    }))
                  }
                >
                  <option value="usuario">{language === 'es' ? 'Usuario' : 'User'}</option>
                  <option value="sme">SME</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button type="submit" className="btn-submit">
                  {language === 'es' ? 'Guardar' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}