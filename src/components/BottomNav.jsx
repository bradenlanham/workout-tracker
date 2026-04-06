import { useLocation, useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'

const HomeFilled = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.5L3 10.5V21h6v-5.5h6V21h6V10.5L12 2.5Z" />
  </svg>
)

const HomeOutline = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10.5L12 2.5l9 8V21h-6v-5.5h-6V21H3V10.5Z" />
  </svg>
)

const PlusIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const ClockFilled = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm.75 5a.75.75 0 0 0-1.5 0v5.25l3.25 2.437a.75.75 0 1 0 .9-1.2L12.75 11.5V7Z" />
  </svg>
)

const ClockOutline = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7.5 12 12 15.5 14.5" />
  </svg>
)

const ChartFilled = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3.5" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="16.5" y="3" width="4" height="18" rx="1" />
  </svg>
)

const ChartOutline = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="16.5" y="3" width="4" height="18" rx="1" />
  </svg>
)

const GearFilled = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
  </svg>
)

const GearOutline = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const tabs = [
  { to: '/dashboard', label: 'Dashboard', ActiveIcon: HomeFilled,  InactiveIcon: HomeOutline  },
  { to: '/log',       label: 'Log',       ActiveIcon: PlusIcon,    InactiveIcon: PlusIcon     },
  { to: '/history',   label: 'History',   ActiveIcon: ClockFilled, InactiveIcon: ClockOutline },
  { to: '/progress',  label: 'Progress',  ActiveIcon: ChartFilled, InactiveIcon: ChartOutline },
  { action: 'menu',   label: 'Settings',  ActiveIcon: GearFilled,  InactiveIcon: GearOutline  },
]

export default function BottomNav({ onMenuOpen, menuOpen }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { settings } = useStore()
  const theme = getTheme(settings.accentColor)
  const isDark = settings.backgroundTheme !== 'daylight'

  const isLogging = location.pathname.startsWith('/log/bb/')
  const isWelcome = location.pathname === '/welcome'
  if (isLogging || isWelcome) return null

  const inactiveColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '94%',
        maxWidth: '500px',
        zIndex: 40,
        background: isDark ? 'rgba(18,18,22,0.88)' : 'rgba(245,245,248,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
        borderRadius: '100px',
        display: 'flex',
        alignItems: 'center',
        height: '56px',
        padding: '0 4px',
      }}
    >
      {tabs.map(tab => {
        const active = tab.action === 'menu'
          ? !!menuOpen
          : location.pathname.startsWith(tab.to)
        const Icon = active ? tab.ActiveIcon : tab.InactiveIcon
        const handleClick = tab.action === 'menu'
          ? onMenuOpen
          : () => navigate(tab.to)

        return (
          <button
            key={tab.label}
            onClick={handleClick}
            aria-label={tab.label}
            aria-current={tab.action !== 'menu' && active ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '44px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '60px',
                height: '36px',
                borderRadius: '20px',
                background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: active ? theme.hex : inactiveColor,
                transition: 'background 0.18s ease, color 0.18s ease',
              }}
            >
              <Icon />
            </span>
          </button>
        )
      })}
    </nav>
  )
}
