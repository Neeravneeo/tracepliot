import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Moon, Sun } from 'lucide-react';

export const OrbitSwitch: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      className={`orbit-switch ${isDark ? 'is-dark' : 'is-light'}`}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <div className="orbit-track">
        <div className="orbit-body">
          {isDark ? (
            <Moon className="orbit-icon moon-icon" size={14} strokeWidth={2.5} />
          ) : (
            <Sun className="orbit-icon sun-icon" size={14} strokeWidth={2.5} />
          )}
        </div>
      </div>
    </button>
  );
};
