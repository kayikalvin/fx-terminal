import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Alerts from './components/Alerts';
import Charts from './components/Charts';
import Correlation from './components/Correlation';
import Strength from './components/Strength';
import Backtester from './components/Backtester';
import News from './components/News';
import MLResearch from './components/MLResearch';
import Journal from './components/Journal';
import Settings from './components/Settings';

const tabs = [
  { num: '01', label: 'Dashboard', path: '/', component: Dashboard },
  { num: '02', label: 'Alerts', path: '/alerts', component: Alerts },
  { num: '03', label: 'Charts', path: '/charts', component: Charts },
  { num: '04', label: 'Correlation', path: '/correlation', component: Correlation },
  { num: '05', label: 'Strength', path: '/strength', component: Strength },
  { num: '06', label: 'Backtester', path: '/backtest', component: Backtester },
  { num: '07', label: 'News & COT', path: '/news', component: News },
  { num: '08', label: 'ML Research', path: '/ml', component: MLResearch },
  { num: '09', label: 'Journal', path: '/journal', component: Journal },
  { num: '10', label: 'Settings', path: '/settings', component: Settings },
];

export default function App() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <nav className="topbar">
        <div className="brand">FX<span>/</span>TERMINAL</div>
        <div className="nav-tabs">
          {tabs.map(tab => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === '/'}
              className={({ isActive }) =>
                `nav-tab ${isActive ? 'active' : ''}`
              }
            >
              <span className="tab-num">{tab.num}</span>
              {tab.label}
            </NavLink>
          ))}
        </div>
        <div className="pill">RESEARCH ONLY · NOT FINANCIAL ADVICE</div>
      </nav>
      <main className="py-7 px-7 max-w-[1400px] mx-auto">
        <Routes>
          {tabs.map(tab => (
            <Route key={tab.path} path={tab.path} element={<tab.component />} />
          ))}
        </Routes>
      </main>
    </div>
  );
}