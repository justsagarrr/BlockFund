import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { connectWallet, getCurrentAccount, isMetaMaskInstalled } from '../utils/ethereum.js';
import './Navbar.css';

export default function Navbar() {
  const { user, isAuthenticated, logout, updateWallet } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkWallet();

    if (isMetaMaskInstalled()) {
      window.ethereum.on('accountsChanged', (accounts) => {
        setWalletAddress(accounts[0] || null);
      });
    }
  }, []);

  async function checkWallet() {
    const account = await getCurrentAccount();
    if (account) {
      setWalletAddress(account);
    }
  }

  async function handleConnectWallet() {
    if (!isMetaMaskInstalled()) {
      alert('Please install MetaMask to connect your wallet.');
      return;
    }

    setWalletLoading(true);
    try {
      const account = await connectWallet();
      setWalletAddress(account);
      if (isAuthenticated) {
        updateWallet(account);
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setWalletLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  function truncateAddress(addr) {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="navbar-brand-icon">B</span>
          BlockFund
        </Link>

        {isAuthenticated && (
          <div className="navbar-links">
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/discover"
              className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
            >
              Discover
            </NavLink>

            {user?.role === 'campaigner' && (
              <NavLink
                to="/create"
                className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
              >
                Create Campaign
              </NavLink>
            )}

            {user?.role === 'investor' && (
              <NavLink
                to="/portfolio"
                className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
              >
                Portfolio
              </NavLink>
            )}
          </div>
        )}

        <div className="navbar-actions">
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          <button
            className="wallet-btn"
            onClick={handleConnectWallet}
            disabled={walletLoading}
          >
            <span className={`wallet-dot ${walletAddress ? '' : 'disconnected'}`} />
            {walletLoading ? (
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
            ) : walletAddress ? (
              <span className="wallet-address">{truncateAddress(walletAddress)}</span>
            ) : (
              'Connect Wallet'
            )}
          </button>

          {isAuthenticated ? (
            <div className="user-menu">
              <span className="user-role-badge">{user?.role}</span>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <div className="navbar-actions">
              <Link to="/login" className="btn btn-secondary btn-sm">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
