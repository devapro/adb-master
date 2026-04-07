import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDeviceStore } from '../../store/device.store';
import './Sidebar.css';

const navItems = [
  { path: '/devices', icon: 'M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z', key: 'devices', requiresDevice: false },
  { path: '/apps', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16', key: 'apps', requiresDevice: true },
  { path: '/files', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z', key: 'files', requiresDevice: true },
  { path: '/network', icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01M1.394 9.393a11 11 0 0116.212 0M4.758 12.758a7 7 0 019.484 0', key: 'network', requiresDevice: true },
  { path: '/logcat', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', key: 'logcat', requiresDevice: true },
  { path: '/terminal', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', key: 'terminal', requiresDevice: true },
] as const;

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const selectedSerial = useDeviceStore((s) => s.selectedSerial);

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span className="mono">{t('header.title')}</span>
      </div>

      <ul className="sidebar-nav">
        {navItems.map((item) => {
          const disabled = item.requiresDevice && !selectedSerial;
          const to = item.requiresDevice && selectedSerial
            ? `${item.path}/${selectedSerial}`
            : item.path;

          return (
            <li key={item.key}>
              <NavLink
                to={disabled ? '#' : to}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`
                }
                onClick={(e) => disabled && e.preventDefault()}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                <span>{t(`nav.${item.key}`)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
