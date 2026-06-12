import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { loadPrefs } from '../lib/prefs';
import {
  IconIngredients, IconRecipes, IconComputations, IconPrices, IconWarning,
} from '../components/Icons';

// ── Helpers ────────────────────────────────────────────────────────────────

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const fmt     = (n) => n != null ? `₱${parseFloat(n).toFixed(2)}` : '—';
const fmtDate = (d) => new Date(d).toLocaleDateString('en-PH', {
  month: 'short', day: 'numeric', year: 'numeric',
});

// ── Sub-components ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-6 h-6 rounded-full border-2 border-gray-200 animate-spin" style={{ borderTopColor: 'var(--accent)' }} />
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, accent, loading }) {
  return (
    <div
      className="bg-white rounded-xl p-5 flex items-start gap-4"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 1px 8px rgba(0,0,0,0.04)' }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: accent ? `${accent}18` : '#f3f4f6', color: accent || '#6b7280' }}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide leading-none mb-1">{label}</p>
        {loading ? (
          <div className="h-7 w-10 bg-gray-100 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        )}
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const prefs = loadPrefs();
  const ownerName = prefs.ownerName || 'Chef';
  const alertThreshold = prefs.alertThresholdDays ?? 7;

  const [stats, setStats] = useState({
    ingredients: 0, recipes: 0, computations: 0, pricesToday: 0,
  });

  const [recentCostings, setRecentCostings] = useState([]);
  const [priceAlerts, setPriceAlerts]       = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [ingRes, recRes] = await Promise.all([
          api.get('/ingredients'),
          api.get('/recipes'),
        ]);
        const ingredients = ingRes.data.data || [];
        const recipes     = recRes.data.data || [];

        const [historyResults, latestPriceResults] = await Promise.all([
          Promise.all(
            recipes.map(r =>
              api.get(`/costing/history/${r.id}`)
                .then(res => ({ recipeId: r.id, recipeName: r.name, rows: res.data.data || [] }))
                .catch(() => ({ recipeId: r.id, recipeName: r.name, rows: [] }))
            )
          ),
          Promise.all(
            ingredients.map(ing =>
              api.get(`/prices/latest/${ing.id}`)
                .then(res => ({ ingredient: ing, price: res.data.data }))
                .catch(() => ({ ingredient: ing, price: null }))
            )
          ),
        ]);

        const allCostings = historyResults.flatMap(({ recipeName, rows }) =>
          rows.map(row => ({ ...row, recipe_name: recipeName }))
        );
        allCostings.sort((a, b) => new Date(b.computed_at) - new Date(a.computed_at));
        setRecentCostings(allCostings.slice(0, 5));

        const today   = todayISO();
        const cutoff  = daysAgoISO(alertThreshold);

        let pricesToday = 0;
        const alerts    = [];

        latestPriceResults.forEach(({ ingredient, price }) => {
          if (!price) {
            alerts.push({ ...ingredient, alertReason: 'No price recorded yet' });
          } else {
            if (price.extraction_date === today) pricesToday++;
            if (price.extraction_date < cutoff) {
              alerts.push({ ...ingredient, alertReason: `Last updated ${fmtDate(price.extraction_date)}` });
            }
          }
        });

        setPriceAlerts(alerts);
        setStats({ ingredients: ingredients.length, recipes: recipes.length, computations: allCostings.length, pricesToday });
      } catch {
        // fail silently — partial data still shown
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [alertThreshold]);

  return (
    <div className="max-w-4xl space-y-7">

      {/* ── Greeting ── */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {timeGreeting()}, {ownerName}
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Here's what's happening with your menu pricing today.
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Ingredients"        value={stats.ingredients}  sub="in master list"  icon={IconIngredients}   accent="#10b981" loading={loading} />
        <StatCard label="Recipes"            value={stats.recipes}      sub="menu items"      icon={IconRecipes}       accent="#6366f1" loading={loading} />
        <StatCard label="Total Computations" value={stats.computations} sub="cost snapshots"  icon={IconComputations}  accent="#f59e0b" loading={loading} />
        <StatCard label="Prices Today"       value={stats.pricesToday}  sub="updated today"   icon={IconPrices}        accent="#06b6d4" loading={loading} />
      </div>

      {/* ── Quick actions ── */}
      <div
        className="bg-white rounded-xl p-5"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 1px 8px rgba(0,0,0,0.04)' }}
      >
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/ingredients', label: 'Manage Ingredients', color: 'var(--accent)' },
            { href: '/recipes',     label: 'Manage Recipes',     color: '#6366f1' },
            { href: '/costing',     label: 'Compute Cost',       color: '#f59e0b' },
            { href: '/extraction',  label: 'Extract Prices',     color: '#06b6d4' },
          ].map(({ href, label, color }) => (
            <Link
              key={href}
              to={href}
              className="block p-3 rounded-lg border border-gray-100 text-sm font-medium text-center transition-all hover:shadow-sm hover:border-gray-200"
              style={{ color }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent computations ── */}
      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 1px 8px rgba(0,0,0,0.04)' }}
      >
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent Computations</h3>
          <Link to="/costing" className="text-xs font-medium" style={{ color: 'var(--accent)' }}>View all →</Link>
        </div>

        {loading ? (
          <Spinner />
        ) : recentCostings.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400">No computations yet.</p>
            <Link to="/costing" className="mt-2 inline-block text-sm font-medium" style={{ color: 'var(--accent)' }}>
              Run your first cost computation →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">Recipe</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">Portion Cost</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">Rec. Price</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentCostings.map((row, i) => (
                  <tr key={row.id} className={i < recentCostings.length - 1 ? 'border-b border-gray-50' : ''}>
                    <td className="px-5 py-2.5 font-medium text-gray-800">{row.recipe_name}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{fmt(row.portion_cost)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold" style={{ color: 'var(--accent)' }}>{fmt(row.recommended_price)}</td>
                    <td className="px-5 py-2.5 text-gray-400 text-xs whitespace-nowrap">{fmtDate(row.computed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Price alerts ── */}
      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 1px 8px rgba(0,0,0,0.04)' }}
      >
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Price Alerts</h3>
          {!loading && priceAlerts.length > 0 && (
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {priceAlerts.length} need{priceAlerts.length === 1 ? 's' : ''} attention
            </span>
          )}
        </div>

        {loading ? (
          <Spinner />
        ) : priceAlerts.length === 0 ? (
          <div className="flex items-center gap-2.5 px-5 py-4">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--accent)', flexShrink: 0 }}>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 8l2.5 2.5L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm text-gray-500">
              All ingredient prices updated within the last {alertThreshold} day{alertThreshold === 1 ? '' : 's'}.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {priceAlerts.map((ing) => (
              <li key={ing.id} className="flex items-center gap-3 px-5 py-3">
                <span style={{ color: '#d97706', flexShrink: 0 }}>
                  <IconWarning size={15} />
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800">{ing.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{ing.unit} · {ing.category}</span>
                </div>
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                  {ing.alertReason}
                </span>
                <Link to="/ingredients" className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--accent)' }}>
                  Update →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}
