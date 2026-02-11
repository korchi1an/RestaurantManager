
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Customer from './pages/Customer';
import Kitchen from './pages/Kitchen';
import Waiter from './pages/Waiter';
import QRCodes from './pages/QRCodes';
import Login from './pages/Login';
import CustomerLogin from './pages/CustomerLogin';
import Register from './pages/Register';
import TableAssignments from './pages/TableAssignments';
import './styles/App.css';

// Protected route wrapper for Kitchen and Waiter pages
function ProtectedRoute({ children, requiredRole }: { children: JSX.Element; requiredRole: string | string[] }) {
  const token = localStorage.getItem('auth_token');
  const userRole = localStorage.getItem('user_role');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Handle single role or array of roles
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  
  if (!allowedRoles.includes('any') && userRole && !allowedRoles.includes(userRole)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function Navigation() {
  const location = useLocation();
  const isTableRoute = location.pathname.startsWith('/table/');
  const isLoginRoute = location.pathname === '/login' || location.pathname === '/customer-login' || location.pathname === '/customer-register';
  const isKitchenOrWaiterRoute = location.pathname === '/kitchen' || location.pathname === '/waiter';
  const token = localStorage.getItem('auth_token');
  const userName = localStorage.getItem('user_name');

  // Hide navigation when user comes from QR code or on login/register/kitchen/waiter pages
  if (isTableRoute || isLoginRoute || isKitchenOrWaiterRoute) {
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    window.location.href = '/';
  };

  return (
    <nav className="app-nav">
      <Link 
        to="/"
        className={location.pathname === '/' ? 'active' : ''}
      >
        Clienți
      </Link>
      <Link 
        to="/kitchen"
        className={location.pathname === '/kitchen' ? 'active' : ''}
      >
        Bucătărie
      </Link>
      <Link 
        to="/waiter"
        className={location.pathname === '/waiter' ? 'active' : ''}
      >
        Chelner
      </Link>
      <Link 
        to="/qrcodes"
        className={location.pathname === '/qrcodes' ? 'active' : ''}
      >
        Coduri QR
      </Link>
      {token && (
        <>
          <Link 
            to="/assignments"
            className={location.pathname === '/assignments' ? 'active' : ''}
          >
            Managementul Meselor
          </Link>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#666', fontSize: '14px' }}>{userName}</span>
            <button 
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
            Logout
          </button>
          </div>
        </>
      )}
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="app">
        <Navigation />

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Customer />} />
            <Route path="/table/:tableId" element={<Customer />} />
            <Route path="/login" element={<Login />} />
            <Route path="/customer-login" element={<CustomerLogin />} />
            <Route path="/customer-register" element={<Register />} />
            <Route 
              path="/kitchen" 
              element={
                <ProtectedRoute requiredRole="kitchen">
                  <Kitchen />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/waiter" 
              element={
                <ProtectedRoute requiredRole="waiter">
                  <Waiter />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/assignments" 
              element={
                <ProtectedRoute requiredRole={['kitchen', 'admin']}>
                  <TableAssignments />
                </ProtectedRoute>
              } 
            />
            <Route path="/qrcodes" element={<QRCodes />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
