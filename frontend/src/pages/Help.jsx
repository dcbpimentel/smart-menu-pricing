import { useState } from 'react';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    number: 1,
    title: 'Add your ingredients',
    path: '/ingredients',
    linkLabel: 'Go to Ingredients',
    description: 'Start by listing every ingredient your dishes use. For each one, enter the name, the unit it is measured in (kg, g, L, pc), and the category (Meat, Vegetable, etc.).',
    tips: [
      'Use the same unit across the whole system. If you buy chicken in kg, always enter kg.',
      'Add every ingredient you use even if you do not have a price for it yet.',
    ],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 22V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M5 7C5 7 6.5 4 12 4C17.5 4 19 7 19 7C19 7 19 14 12 14C5 14 5 7 5 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M8.5 9.5C8.5 9.5 10 8 12 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    number: 2,
    title: 'Enter market prices',
    path: '/ingredients',
    linkLabel: 'Go to Ingredients',
    description: 'Click on any ingredient to open its price history. Enter the current market price you paid. You can add prices manually or import them automatically from DTI / DA bulletins.',
    tips: [
      'Prices should reflect what you actually pay per unit (e.g. P280 per kg of chicken).',
      'Update prices whenever the market changes. The system uses the most recent price by default.',
      'You can import prices in bulk from DTI or DA official bulletins using Price Extraction.',
    ],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <polyline points="3,17 8,12 13,14 20,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="15,6 20,6 20,11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    number: 3,
    title: 'Create your recipes',
    path: '/recipes',
    linkLabel: 'Go to Recipes',
    description: 'Add each dish on your menu as a recipe. Give it a name, a short description, and the number of servings the batch produces (e.g. 1 batch of Chicken Adobo yields 4 servings).',
    tips: [
      'Servings is the number of plates or portions that come from one full batch of the recipe.',
      'After creating a recipe, click "Manage" to add the ingredients and their quantities.',
    ],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M8 3C8 3 7.5 4.5 9 5.5C10.5 6.5 10 8 10 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M14 3C14 3 13.5 4.5 15 5.5C16.5 6.5 16 8 16 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M4 11H20C20 11 19.5 18 12 18C4.5 18 4 11 4 11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="12" y1="18" x2="12" y2="21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    number: 4,
    title: 'Compute your dish cost',
    path: '/costing',
    linkLabel: 'Go to Cost Computation',
    description: 'Select a recipe and a pricing profile, then click Compute. The system calculates how much each serving costs and recommends a selling price based on your food-cost target.',
    tips: [
      'The default pricing profile targets 35% food cost, which is the industry standard.',
      'You can create custom profiles in Settings if you want different margins for different dishes.',
      'The breakdown table shows exactly which ingredient is driving your cost.',
    ],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/>
        <rect x="7" y="6.5" width="10" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="8.5" cy="14" r="1" fill="currentColor"/>
        <circle cx="12" cy="14" r="1" fill="currentColor"/>
        <circle cx="15.5" cy="14" r="1" fill="currentColor"/>
        <circle cx="8.5" cy="17.5" r="1" fill="currentColor"/>
        <circle cx="12" cy="17.5" r="1" fill="currentColor"/>
        <circle cx="15.5" cy="17.5" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    number: 5,
    title: 'Simulate price changes',
    path: '/impact',
    linkLabel: 'Go to Impact Analysis',
    description: 'Use Impact Analysis to see how a change in ingredient prices affects your costs before it actually happens. Enter old and new prices for any ingredient and compare the results side by side.',
    tips: [
      'Useful for planning ahead, e.g. "if pork goes up by P50/kg, how much should I raise my menu price?"',
      'The chart shows the cost difference visually so it is easy to present to stakeholders.',
    ],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <polyline points="22,7 13,16 8,11 2,17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="16,7 22,7 22,13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

const FEATURES = [
  {
    title: 'Dashboard',
    path: '/',
    summary: 'Your home screen. See at a glance: how many ingredients and recipes you have, recent cost computations, and any price alerts for ingredients with outdated prices.',
    notes: [
      'Price alerts appear when an ingredient price has not been updated in more than 7 days (configurable in Settings).',
      'Quick Action buttons let you jump straight to any task.',
    ],
  },
  {
    title: 'Ingredients',
    path: '/ingredients',
    summary: 'The master list of everything you buy. Add, edit, or remove ingredients here. Click the clock icon on any ingredient to see its full price history or add a new price entry.',
    notes: [
      'Deleting an ingredient that is used in a recipe is not allowed. Remove it from the recipe first.',
      'The "unit" must match what you use in your recipes (e.g. both in kg).',
    ],
  },
  {
    title: 'Recipes',
    path: '/recipes',
    summary: 'Your menu items. Each recipe is a dish with a list of ingredients and their quantities. The "Manage" button lets you add, edit, or remove ingredients from a recipe.',
    notes: [
      'Quantities use the same unit as the ingredient. If beef is in kg, enter 0.5 for half a kilo.',
      'Servings is the number of plates one full batch produces.',
    ],
  },
  {
    title: 'Price Extraction',
    path: '/extraction',
    summary: 'Automatically import prices from DTI or DA official bulletins instead of entering them one by one. Upload a PDF or image, or paste a URL. The system reads the table and matches prices to your ingredients.',
    notes: [
      'After extraction, review the matched results before saving. Flagged rows need your approval.',
      'An ingredient must already exist in your list before it can be matched automatically.',
    ],
  },
  {
    title: 'Cost Computation',
    path: '/costing',
    summary: 'Pick a recipe, pick a pricing profile, and click Compute. The system multiplies each ingredient quantity by its current price, sums them up, divides by servings, and applies your food-cost target to recommend a selling price.',
    notes: [
      'Results are saved automatically so you can look back at past computations.',
      'If an ingredient has no price, it appears in the "Missing Prices" list. You need to add a price before the cost can be computed.',
    ],
  },
  {
    title: 'Impact Analysis',
    path: '/impact',
    summary: 'A what-if simulator. Enter the old and new price for one or more ingredients and see immediately how your portion cost and recommended selling price would change.',
    notes: [
      'Results are not saved. This is a planning tool, not a cost record.',
      'Use this before negotiating with suppliers or before updating your menu prices.',
    ],
  },
  {
    title: 'Settings',
    path: '/settings',
    summary: 'Set your restaurant name, configure price alert thresholds, manage pricing profiles, and choose a default price source.',
    notes: [
      'Pricing profiles let you use different food-cost targets for different dish categories.',
      'Rounding rules round up your recommended price to the nearest P5 or P10 for cleaner menu prices.',
    ],
  },
];

const GLOSSARY = [
  { term: 'Food Cost %', definition: 'The percentage of the selling price that goes to ingredients. A 35% food cost means if a dish sells for P100, the ingredients cost P35.' },
  { term: 'Portion Cost', definition: 'The ingredient cost for a single serving. Calculated as: Recipe Cost divided by Number of Servings.' },
  { term: 'Recommended Price', definition: 'The suggested selling price. Calculated as: Portion Cost divided by (Food Cost % divided by 100).' },
  { term: 'Contribution Margin', definition: 'What you earn per plate after ingredient costs. Calculated as: Selling Price minus Portion Cost.' },
  { term: 'Rounding Rule', definition: 'Rounds the recommended price up to the nearest P5 or P10 so menu prices look cleaner (e.g. P43.20 becomes P45.00).' },
  { term: 'Price Source', definition: 'Where the price came from: DTI bulletin, DA bulletin, or manual entry. You can filter computations to use only one source.' },
  { term: 'Extraction', definition: 'The process of automatically reading prices from a DTI or DA PDF or HTML bulletin and matching them to your ingredient list.' },
];

function StepCard({ step }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '16px',
          padding: '16px 20px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        {/* Step number */}
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          backgroundColor: 'var(--accent-light)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '14px', border: '1.5px solid var(--accent)',
        }}>
          {step.number}
        </div>
        {/* Icon + title */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{step.icon}</span>
          <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{step.title}</span>
        </div>
        {/* Chevron */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{ padding: '0 20px 18px 70px' }}>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 0 10px' }}>
            {step.description}
          </p>
          {step.tips.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {step.tips.map((tip, i) => (
                <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }}>•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to={step.path}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              marginTop: '14px', fontSize: '12px', fontWeight: 600,
              color: 'var(--accent)', textDecoration: 'none',
            }}
          >
            {step.linkLabel}
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}

function FeatureRow({ feature }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 0', background: 'transparent', border: 'none', cursor: 'pointer',
          textAlign: 'left', gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            to={feature.path}
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--accent)',
              textDecoration: 'none', letterSpacing: '0.03em', textTransform: 'uppercase',
              background: 'var(--accent-light)', padding: '2px 8px', borderRadius: '6px',
              border: '1px solid var(--accent)',
              flexShrink: 0, opacity: 0.8,
            }}
          >
            {feature.path === '/' ? '/' : feature.path.replace('/', '')}
          </Link>
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {feature.title}
          </span>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 16 16" fill="none"
          style={{ flexShrink: 0, color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{ paddingBottom: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 0 10px' }}>
            {feature.summary}
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {feature.notes.map((note, i) => (
              <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }}>•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: 'start',    label: 'Quick Start' },
  { id: 'features', label: 'Feature Guide' },
  { id: 'glossary', label: 'Glossary' },
];

export default function Help() {
  const [tab, setTab] = useState('start');

  return (
    <div style={{ maxWidth: 860 }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Help &amp; Guide
        </h2>
        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
          Select a topic to get started.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'inline-flex', gap: '4px', marginBottom: '20px',
        background: 'var(--input-bg, #F7F5F0)', padding: '4px', borderRadius: '12px',
        border: '1px solid var(--border)',
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 20px', borderRadius: '9px', border: 'none',
              fontWeight: tab === t.id ? 700 : 500, fontSize: '13.5px',
              background: tab === t.id ? '#FFFFFF' : 'transparent',
              color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Quick Start tab */}
      {tab === 'start' && (
        <div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px', marginTop: 0 }}>
            Follow these 5 steps in order the first time you use the system. Click any step to expand it.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {STEPS.map(step => <StepCard key={step.number} step={step} />)}
          </div>
        </div>
      )}

      {/* Feature Guide tab */}
      {tab === 'features' && (
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 24px', borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--card-bg-alt, #FDFBF8)',
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>
              Feature reference
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
              Click any page to see what it does and how to use it.
            </p>
          </div>
          <div style={{ padding: '0 24px' }}>
            {FEATURES.map(f => <FeatureRow key={f.path} feature={f} />)}
          </div>
        </div>
      )}

      {/* Glossary tab */}
      {tab === 'glossary' && (
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 24px', borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--card-bg-alt, #FDFBF8)',
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>
              Key terms explained
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
              Plain-language definitions for terms used throughout the system.
            </p>
          </div>
          <div style={{ padding: '8px 24px 16px' }}>
            {GLOSSARY.map(({ term, definition }) => (
              <div
                key={term}
                style={{
                  display: 'flex', gap: '16px', padding: '12px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span style={{
                  fontSize: '12px', fontWeight: 700, color: 'var(--accent)',
                  minWidth: '160px', flexShrink: 0, paddingTop: '1px',
                  fontFamily: 'SF Mono, Geist Mono, monospace',
                  letterSpacing: '-0.01em',
                }}>
                  {term}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {definition}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
