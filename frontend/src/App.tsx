
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

function App() {
  return (
    <Router>
      <div className="app">
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
