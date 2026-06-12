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
      'Use the same unit across the whole system — if you buy chicken in kg, always enter kg.',
      'Add every ingredient you use even if you do not have a price for it yet.',
    ],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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
    description: 'Click on any ingredient to open its price history. Enter the current market price you paid — you can add prices manually or import them automatically from DTI / DA bulletins.',
    tips: [
      'Prices should reflect what you actually pay per unit (e.g., ₱280 per kg of chicken).',
      'Update prices whenever the market changes — the system uses the most recent price by default.',
      'You can import prices in bulk from DTI or DA official bulletins using Price Extraction.',
    ],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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
    description: 'Add each dish on your menu as a recipe. Give it a name, a short description, and the number of servings the batch produces (e.g., 1 batch of Chicken Adobo yields 4 servings).',
    tips: [
      'Servings is the number of plates/portions that come from one full batch of the recipe.',
      'After creating a recipe, click "Manage" to add the ingredients and their quantities.',
    ],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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
      'The default pricing profile targets 35% food cost — meaning ingredients cost 35% of the selling price, which is the industry standard.',
      'You can create custom profiles in Settings if you want different margins for different dishes.',
      'The breakdown table shows exactly which ingredient is driving your cost.',
    ],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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
      'This is useful for planning ahead — e.g., "if pork goes up by ₱50/kg, how much should I raise my menu price?"',
      'The chart shows the cost difference visually so it is easy to present to stakeholders.',
    ],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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
      'Deleting an ingredient that is used in a recipe is not allowed — remove it from the recipe first.',
      'The "unit" must match what you use in your recipes (e.g., both in kg).',
    ],
  },
  {
    title: 'Recipes',
    path: '/recipes',
    summary: 'Your menu items. Each recipe is a dish with a list of ingredients and their quantities. The "Manage" button lets you add, edit, or remove ingredients from a recipe.',
    notes: [
      'Quantities use the same unit as the ingredient — if beef is in kg, enter 0.5 for half a kilo.',
      'Servings is the number of plates one full batch produces.',
    ],
  },
  {
    title: 'Price Extraction',
    path: '/extraction',
    summary: 'Automatically import prices from DTI or DA official bulletins instead of entering them one by one. Upload a PDF or image, or paste a URL. The system reads the table and matches prices to your ingredients.',
    notes: [
      'After extraction, review the matched results before saving — flagged rows need your approval.',
      'An ingredient must already exist in your list before it can be matched automatically.',
    ],
  },
  {
    title: 'Cost Computation',
    path: '/costing',
    summary: 'Pick a recipe, pick a pricing profile, and click Compute. The system multiplies each ingredient quantity by its current price, sums them up, divides by servings, and applies your food-cost target to recommend a selling price.',
    notes: [
      'Results are saved automatically so you can look back at past computations.',
      'If an ingredient has no price, it appears in the "Missing Prices" list — you need to add a price before the cost can be computed.',
    ],
  },
  {
    title: 'Impact Analysis',
    path: '/impact',
    summary: 'A what-if simulator. Enter the old and new price for one or more ingredients and see immediately how your portion cost and recommended selling price would change.',
    notes: [
      'Results are not saved — this is a planning tool, not a cost record.',
      'Use this before negotiating with suppliers or before updating your menu prices.',
    ],
  },
  {
    title: 'Settings',
    path: '/settings',
    summary: 'Set your restaurant name, choose your brand icon and color theme, configure price alert thresholds, manage pricing profiles, and choose a default price source.',
    notes: [
      'Pricing profiles let you use different food-cost targets for different dish categories.',
      'Rounding rules round up your recommended price to the nearest ₱5 or ₱10 for cleaner menu prices.',
    ],
  },
];

const GLOSSARY = [
  { term: 'Food Cost %', definition: 'The percentage of the selling price that goes to ingredients. A 35% food cost means if a dish sells for ₱100, the ingredients cost ₱35.' },
  { term: 'Portion Cost', definition: 'The ingredient cost for a single serving. Calculated as: Recipe Cost ÷ Number of Servings.' },
  { term: 'Recommended Price', definition: 'The suggested selling price. Calculated as: Portion Cost ÷ (Food Cost % ÷ 100).' },
  { term: 'Contribution Margin', definition: 'What you earn per plate after ingredient costs. Calculated as: Selling Price − Portion Cost.' },
  { term: 'Rounding Rule', definition: 'Rounds the recommended price up to the nearest ₱5 or ₱10 so menu prices look cleaner (e.g., ₱43.20 becomes ₱45.00).' },
  { term: 'Price Source', definition: 'Where the price came from: DTI bulletin, DA bulletin, or manual entry. You can filter computations to use only one source.' },
  { term: 'Extraction', definition: 'The process of automatically reading prices from a DTI or DA PDF or HTML bulletin and matching them to your ingredient list.' },
];

function StepCard({ step, index }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '18px',
        padding: '22px 24px',
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Step number accent bar */}
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: '4px',
        backgroundColor: 'var(--accent)',
        borderRadius: '14px 0 0 14px',
      }} />

      {/* Step number circle */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        backgroundColor: 'var(--accent-light)',
        color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '15px', flexShrink: 0,
        border: '1.5px solid var(--accent)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {step.number}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ color: 'var(--text-muted)' }}>{step.icon}</span>
          <h3 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', margin: 0 }}>
            {step.title}
          </h3>
        </div>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 0 12px' }}>
          {step.description}
        </p>
        {step.tips.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {step.tips.map((tip, i) => (
              <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px', fontWeight: 700 }}>–</span>
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
              border: '1px solid var(--accent-ring)',
              flexShrink: 0,
            }}
          >
            {feature.path === '/' ? '/' : feature.path.replace('/', '/')}
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
                <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px', fontWeight: 700 }}>–</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Help() {
  return (
    <div style={{ maxWidth: '820px' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Help &amp; Guide
        </h2>
        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
          Everything you need to know to start using Smart Menu Pricing
        </p>
      </div>

      {/* Welcome banner */}
      <div
        style={{
          padding: '22px 24px',
          backgroundColor: 'var(--accent-light)',
          border: '1px solid var(--accent-ring)',
          borderRadius: '14px',
          marginBottom: '28px',
          display: 'flex', gap: '16px', alignItems: 'flex-start',
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: '10px',
          backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2"/>
            <line x1="12" y1="11" x2="12" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="8" r="1" fill="white"/>
          </svg>
        </div>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            What does this system do?
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
            Smart Menu Pricing helps restaurant owners in Kidapawan City calculate exactly how much each dish costs to make — and suggests a fair selling price. Instead of guessing, you get accurate numbers based on current market prices from DTI and DA bulletins.
          </p>
        </div>
      </div>

      {/* Getting started */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>
            Getting started — 5 steps
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Follow these steps in order the first time you use the system.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {STEPS.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </div>
      </div>

      {/* Feature reference */}
      <div
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          marginBottom: '28px',
        }}
      >
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--card-bg-alt)',
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

      {/* Glossary */}
      <div
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--card-bg-alt)',
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
                minWidth: '150px', flexShrink: 0, paddingTop: '1px',
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

    </div>
  );
}
