import { useLocation, useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'

const HomeFilled = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.03 2.59a1.5 1.5 0 0 1 1.94 0l7.5 6.363A1.5 1.5 0 0 1 21 10.097V19.5a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4.5H10V19.5A1.5 1.5 0 0 1 8.5 21h-4A1.5 1.5 0 0 1 3 19.5v-9.403a1.5 1.5 0 0 1 .53-1.144l7.5-6.363Z" />
  </svg>
)

const HomeOutline = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-4.5v-5h-5v5H4a1 1 0 0 1-1-1V11.5Z" />
  </svg>
)

const PlusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const ClockFilled = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm.75 5a.75.75 0 0 0-1.5 0v5.25l3.25 2.437a.75.75 0 1 0 .9-1.2L12.75 11.5V7Z" />
  </svg>
)

const ClockOutline = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15.5 14.5" />
  </svg>
)

const ChartFilled = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </svg>
)

const ChartOutline = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </svg>
)

const tabs = [
  { to: '/dashboard', label: 'Dashboard', ActiveIcon: HomeFilled, InactiveIcon: HomeOutline },
  { to: '/log',       label: 'Log',       ActiveIcon: PlusIcon,   InactiveIcon: PlusIcon    },
  { to: '/history',   label: 'History',   ActiveIcon: ClockFilled, InactiveIcon: ClockOutline },
  { to: '/progress',  label: 'Progress',  ActiveIcon: ChartFilled, InactiveIcon: ChartOutline },
]

export default function BottomNav() {
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
        width: '90%',
        maxWidth: '460px',
        zIndex: 40,
        background: isDark ? 'rgba(18,18,22,0.88)' : 'rgba(245,245,248,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
        borderRadius: '100px',
        display: 'flex',
        alignItems: 'center',
        height: '56px',
        padding: '0 8px',
      }}
    >
      {tabs.map(tab => {
        const active = location.pathname.startsWith(tab.to)
        const Icon = active ? tab.ActiveIcon : tab.InactiveIcon

        return (
          <button
            key={tab.to}
            onClick={() => navigate(tab.to)}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
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
                width: '48px',
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
