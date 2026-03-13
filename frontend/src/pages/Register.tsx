import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get tableId from state (passed from Customer page)
  const tableId = (location.state as any)?.tableId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post<{ token: string; user: { id: number; username: string; email: string; role: string; full_name: string } }>('/auth/register-customer', {
        email,
        password,
        full_name: fullName,
      });

      // Store customer token under customer-specific keys to avoid
      // overwriting staff (waiter/kitchen/admin) credentials
      localStorage.setItem('customer_auth_token', response.token);
      localStorage.setItem('customer_user_role', response.user.role);
      localStorage.setItem('customer_user_id', response.user.id.toString());
      localStorage.setItem('customer_user_name', response.user.full_name || response.user.username);

      // Redirect back to customer page (with tableId if available)
      if (tableId) {
        navigate(`/table/${tableId}`);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Înregistrarea a eșuat. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Creează Cont</h1>
        <p style={styles.subtitle}>Înregistrează-te pentru a urmări comenzile</p>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label htmlFor="fullName" style={styles.label}>Nume Complet</label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={styles.input}
              placeholder="Introdu numele complet"
              required
              autoFocus
            />
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="email" style={styles.label}>Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="email@tau.com"
              required
            />
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="password" style={styles.label}>Parolă</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Alege o parolă (min. 6 caractere)"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
            disabled={loading}
          >
            {loading ? 'Se creează contul...' : 'Înregistrare'}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Ai deja un cont?{' '}
            <button
              onClick={() => navigate('/customer-login', { state: { tableId } })}
              style={styles.linkButton}
            >
              Autentifică-te
            </button>
          </p>
          <button 
            onClick={() => tableId ? navigate(`/table/${tableId}`) : navigate('/')} 
            style={styles.backButton}
          >
            Înapoi la Meniu
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: '20px',
  } as React.CSSProperties,
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
  } as React.CSSProperties,
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '8px',
    textAlign: 'center',
    color: '#333',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center',
    marginBottom: '32px',
  } as React.CSSProperties,
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  } as React.CSSProperties,
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  } as React.CSSProperties,
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  } as React.CSSProperties,
  input: {
    padding: '12px',
    fontSize: '16px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
  } as React.CSSProperties,
  button: {
    padding: '14px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    backgroundColor: '#4CAF50',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  } as React.CSSProperties,
  error: {
    padding: '12px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '6px',
    fontSize: '14px',
  } as React.CSSProperties,
  footer: {
    marginTop: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    alignItems: 'center',
  } as React.CSSProperties,
  footerText: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center',
  } as React.CSSProperties,
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#4CAF50',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: '14px',
    padding: '0',
  } as React.CSSProperties,
  backButton: {
    background: 'none',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: '14px',
    padding: '4px',
  } as React.CSSProperties,
};
