import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { applyTheme } from './lib/theme';
import { loadPrefs } from './lib/prefs';
import { isLoggedIn } from './lib/auth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout       from './components/Layout';
import Landing      from './pages/Landing';
import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import Ingredients  from './pages/Ingredients';
import Recipes      from './pages/Recipes';
import RecipeDetail from './pages/RecipeDetail';
import Extraction   from './pages/Extraction';
import Costing      from './pages/Costing';
import Impact       from './pages/Impact';
import Settings     from './pages/Settings';
import Help         from './pages/Help';
import Profile      from './pages/Profile';
import Team         from './pages/Team';
import Reports      from './pages/Reports';
import Inventory    from './pages/Inventory';

export default function App() {
  useEffect(() => {
    const saved = loadPrefs().theme;
    applyTheme(saved === 'light' || saved === 'dark' ? saved : 'light');
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public — redirect to app if already logged in */}
        <Route
          path="landing"
          element={isLoggedIn() ? <Navigate to="/" replace /> : <Landing />}
        />
        <Route
          path="login"
          element={isLoggedIn() ? <Navigate to="/" replace /> : <Login />}
        />

        {/* Protected — redirect to login if not authenticated */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index              element={<Dashboard />} />
          <Route path="ingredients" element={<Ingredients />} />
          <Route path="recipes"     element={<Recipes />} />
          <Route path="recipes/:id" element={<RecipeDetail />} />
          <Route path="extraction"  element={<Extraction />} />
          <Route path="costing"     element={<Costing />} />
          <Route path="impact"      element={<Impact />} />
          <Route path="settings"    element={<Settings />} />
          <Route path="help"        element={<Help />} />
          <Route path="profile"     element={<Profile />} />
          <Route path="team"        element={<Team />} />
          <Route path="reports"     element={<Reports />} />
          <Route path="inventory"   element={<Inventory />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={isLoggedIn() ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
