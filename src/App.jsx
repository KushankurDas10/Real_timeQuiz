import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PlayerJoin from './pages/PlayerJoin';
import PlayerGame from './pages/PlayerGame';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminGame from './pages/AdminGame';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Player-facing routes */}
        <Route path="/" element={<PlayerJoin />} />
        <Route path="/play/:code" element={<PlayerGame />} />

        {/* Admin/Host routes */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/game/:code" element={<AdminGame />} />
      </Routes>
    </Router>
  );
}
