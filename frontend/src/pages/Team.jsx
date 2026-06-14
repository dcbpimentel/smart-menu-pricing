import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiEye, FiEyeOff, FiShield, FiUser } from 'react-icons/fi';
import api from '../lib/api';
import { getUser } from '../lib/auth';

function SectionCard({ title, description, action, children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
          {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: 'white', borderRadius: '14px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px', letterSpacing: '0.01em' }}>
      {children}
    </label>
  );
}

function Input({ value, onChange, type = 'text', placeholder, suffix, disabled }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%', padding: suffix ? '9px 38px 9px 11px' : '9px 11px',
          fontSize: '13.5px',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--border-strong)'}`,
          borderRadius: '8px',
          backgroundColor: 'var(--input-bg)',
          color: 'var(--text-primary)',
          outline: 'none', boxSizing: 'border-box',
          boxShadow: focused ? '0 0 0 3px var(--accent-ring)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {suffix && (
        <div style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)' }}>
          {suffix}
        </div>
      )}
    </div>
  );
}

function RoleSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        width: '100%', padding: '9px 11px', fontSize: '13.5px',
        border: '1px solid var(--border-strong)', borderRadius: '8px',
        backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)',
        outline: 'none', cursor: 'pointer',
      }}
    >
      <option value="staff">Staff</option>
      <option value="admin">Admin</option>
    </select>
  );
}

function RoleBadge({ role }) {
  const isAdmin = role === 'admin';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em',
      backgroundColor: isAdmin ? 'rgba(139,92,246,0.1)' : 'rgba(107,114,128,0.1)',
      color: isAdmin ? '#7c3aed' : '#4b5563',
    }}>
      {isAdmin ? <FiShield size={10} /> : <FiUser size={10} />}
      {isAdmin ? 'Admin' : 'Staff'}
    </span>
  );
}

function StatusBadge({ active }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 600,
      backgroundColor: active ? 'rgba(22,163,74,0.09)' : 'rgba(239,68,68,0.09)',
      color: active ? '#15803d' : '#b91c1c',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: active ? '#16a34a' : '#dc2626', display: 'inline-block' }} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

const EMPTY_ADD = { full_name: '', username: '', role: 'staff', password: '' };

export default function Team() {
  const currentUser = getUser();
  const isAdmin     = currentUser?.role === 'admin';

  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showAdd,     setShowAdd]     = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);
  const [toggleError, setToggleError] = useState('');

  const [addForm,    setAddForm]    = useState(EMPTY_ADD);
  const [addError,   setAddError]   = useState('');
  const [addSaving,  setAddSaving]  = useState(false);
  const [showAddPw,  setShowAddPw]  = useState(false);

  const [editForm,   setEditForm]   = useState({ full_name: '', role: 'staff' });
  const [editError,  setEditError]  = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadUsers();
    else setLoading(false);
  }, [isAdmin]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddSaving(true);
    setAddError('');
    try {
      await api.post('/users', addForm);
      setShowAdd(false);
      setAddForm(EMPTY_ADD);
      loadUsers();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to create user.');
    } finally {
      setAddSaving(false);
    }
  };

  const openEdit = (u) => {
    setEditTarget(u);
    setEditForm({ full_name: u.full_name, role: u.role });
    setEditError('');
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError('');
    try {
      await api.put(`/users/${editTarget.id}`, editForm);
      setEditTarget(null);
      loadUsers();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update user.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggle = async (userId) => {
    setToggleError('');
    try {
      await api.patch(`/users/${userId}/toggle`);
      loadUsers();
    } catch (err) {
      setToggleError(err.response?.data?.message || 'Failed to update status.');
    }
  };

  // Non-admin guard (hooks already declared above)
  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px', gap: '12px', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '14px',
          backgroundColor: 'rgba(239,68,68,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#dc2626', fontSize: '24px',
        }}>
          <FiShield size={26} />
        </div>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Access denied</h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '280px' }}>
          This page is only accessible to administrators.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '860px' }}>
      <SectionCard
        title="Team Members"
        description="Manage user accounts and access levels."
        action={
          <button
            onClick={() => { setShowAdd(true); setAddError(''); setAddForm(EMPTY_ADD); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', fontSize: '12.5px', fontWeight: 600,
              color: 'white', backgroundColor: 'var(--accent)',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
            }}
          >
            <FiPlus size={14} /> Add User
          </button>
        }
      >
        {toggleError && (
          <div style={{ margin: '0 24px', marginTop: '12px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', fontSize: '12.5px', color: '#dc2626' }}>
            {toggleError}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid #e5e7eb', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
          </div>
        ) : users.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>No users found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  {['Name', 'Username', 'Role', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #f8f8f8' : 'none' }}>
                    <td style={{ padding: '12px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          backgroundColor: 'var(--accent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: '11px', fontWeight: 700, flexShrink: 0,
                          letterSpacing: '0.04em',
                        }}>
                          {(u.full_name || 'U').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 24px', color: 'var(--text-secondary)' }}>{u.username}</td>
                    <td style={{ padding: '12px 24px' }}><RoleBadge role={u.role} /></td>
                    <td style={{ padding: '12px 24px' }}><StatusBadge active={u.is_active} /></td>
                    <td style={{ padding: '12px 24px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => openEdit(u)}
                          title="Edit user"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '5px 10px', fontSize: '12px', fontWeight: 500,
                            border: '1px solid var(--border-strong)', borderRadius: '6px',
                            backgroundColor: 'transparent', color: 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          <FiEdit2 size={11} /> Edit
                        </button>
                        <button
                          onClick={() => handleToggle(u.id)}
                          disabled={u.id === currentUser?.id}
                          title={u.id === currentUser?.id ? 'Cannot deactivate your own account' : (u.is_active ? 'Deactivate' : 'Reactivate')}
                          style={{
                            display: 'inline-flex', alignItems: 'center',
                            padding: '5px 10px', fontSize: '12px', fontWeight: 500,
                            borderRadius: '6px', cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer',
                            opacity: u.id === currentUser?.id ? 0.4 : 1,
                            border: `1px solid ${u.is_active ? 'rgba(239,68,68,0.25)' : 'rgba(22,163,74,0.25)'}`,
                            backgroundColor: u.is_active ? 'rgba(239,68,68,0.05)' : 'rgba(22,163,74,0.05)',
                            color: u.is_active ? '#dc2626' : '#16a34a',
                          }}
                        >
                          {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Add User Modal */}
      {showAdd && (
        <Modal title="Add User" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <FieldLabel>Full name</FieldLabel>
                <Input value={addForm.full_name} onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Maria Santos" />
              </div>
              <div>
                <FieldLabel>Username</FieldLabel>
                <Input value={addForm.username} onChange={e => setAddForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. maria.santos" />
              </div>
              <div>
                <FieldLabel>Role</FieldLabel>
                <RoleSelect value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>Password</FieldLabel>
                <Input
                  type={showAddPw ? 'text' : 'password'}
                  value={addForm.password}
                  onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 6 characters"
                  suffix={
                    <button type="button" onClick={() => setShowAddPw(v => !v)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}>
                      {showAddPw ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                    </button>
                  }
                />
              </div>
            </div>

            {addError && (
              <p style={{ marginTop: '10px', fontSize: '12.5px', color: '#dc2626', fontWeight: 500 }}>{addError}</p>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowAdd(false)}
                style={{ padding: '8px 16px', fontSize: '13px', border: '1px solid var(--border-strong)', borderRadius: '8px', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Cancel
              </button>
              <button type="submit" disabled={addSaving}
                style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 600, color: 'white', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '8px', cursor: addSaving ? 'not-allowed' : 'pointer', opacity: addSaving ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {addSaving && <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />}
                Create user
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit User Modal */}
      {editTarget && (
        <Modal title={`Edit ${editTarget.full_name}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={handleEdit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <FieldLabel>Full name</FieldLabel>
                <Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Full name" />
              </div>
              <div>
                <FieldLabel>Role</FieldLabel>
                <RoleSelect value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} />
              </div>
            </div>

            {editError && (
              <p style={{ marginTop: '10px', fontSize: '12.5px', color: '#dc2626', fontWeight: 500 }}>{editError}</p>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditTarget(null)}
                style={{ padding: '8px 16px', fontSize: '13px', border: '1px solid var(--border-strong)', borderRadius: '8px', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Cancel
              </button>
              <button type="submit" disabled={editSaving}
                style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 600, color: 'white', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '8px', cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {editSaving && <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />}
                Save changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
