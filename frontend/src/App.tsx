
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Customer from './pages/Customer';
import Kitchen from './pages/Kitchen';
import Waiter from './pages/Waiter';
import QRCodes from './pages/QRCodes';
import Login from './pages/Login';
import CustomerLogin from './pages/CustomerLogin';
import Register from './pages/Register';
import TableAssignments from './pages/TableAssignments';
import './styles/App.css';

function decodeToken(token: string): { exp: number; role: string } | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

// Protected route wrapper for Kitchen and Waiter pages
function ProtectedRoute({ children, requiredRole }: { children: JSX.Element; requiredRole: string | string[] }) {
  const token = sessionStorage.getItem('auth_token');
  const payload = token ? decodeToken(token) : null;

  if (!token || !payload || payload.exp * 1000 < Date.now()) {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_role');
    return <Navigate to="/login" replace />;
  }

  // Role comes from the JWT itself — not the separate user_role key,
  // which can be stale when localStorage is shared across tabs.
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  if (!allowedRoles.includes('any') && !allowedRoles.includes(payload.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <div className="app">
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
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
