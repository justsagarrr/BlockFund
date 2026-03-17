import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { isMetaMaskInstalled, getProvider, getCampaignContractAsync, formatEth } from '../utils/ethereum.js';

const CATEGORIES = ['All', 'Technology', 'Art & Design', 'Health', 'Education', 'Environment', 'Community', 'Finance', 'Other'];

export default function Discover() {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    filterCampaigns();
  }, [search, selectedCategory, campaigns]);

  async function fetchCampaigns() {
    try {
      const res = await fetch('/api/campaigns', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const all = await res.json();

      // Enrich with on-chain data
      if (isMetaMaskInstalled() && all.length > 0) {
        const provider = getProvider();
        const enriched = await Promise.all(all.map(async (c) => {
          try {
            const contract = await getCampaignContractAsync(c.campaign_address, provider);
            const totalRaised = await contract.totalRaised();
            const goal = await contract.goal();
            const deadline = await contract.deadline();

            return {
              ...c,
              onChain: {
                totalRaised: totalRaised.toString(),
                goal: goal.toString(),
                deadline: Number(deadline)
              }
            };
          } catch {
            return { ...c, onChain: null };
          }
        }));
        setCampaigns(enriched);
      } else {
        setCampaigns(all);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  }

  function filterCampaigns() {
    let result = campaigns;

    if (selectedCategory !== 'All') {
      result = result.filter(c => c.category === selectedCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
      );
    }

    setFiltered(result);
  }

  function getProgress(campaign) {
    if (!campaign.onChain) return 0;
    const goal = parseFloat(formatEth(campaign.onChain.goal));
    const raised = parseFloat(formatEth(campaign.onChain.totalRaised));
    if (goal === 0) return 0;
    return Math.min((raised / goal) * 100, 100);
  }

  function isActive(campaign) {
    if (!campaign.onChain) return true;
    return campaign.onChain.deadline * 1000 > Date.now();
  }

  function getTimeLeft(campaign) {
    if (!campaign.onChain) return 'N/A';
    const diff = campaign.onChain.deadline * 1000 - Date.now();
    if (diff <= 0) return 'Ended';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  }

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg"></div>
        <p>Loading campaigns...</p>
      </div>
    );
  }

  return (
    <div className="page container fade-in">
      <div className="page-header">
        <h1 className="page-title">Discover Campaigns</h1>
        <p className="page-subtitle">Find and support projects that matter to you</p>
      </div>

      {/* Search & Filters */}
      <div className="search-bar">
        <input
          type="text"
          className="form-input"
          placeholder="Search campaigns..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="form-input"
          style={{ width: 'auto', minWidth: 160 }}
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No campaigns found</h3>
          <p>
            {search || selectedCategory !== 'All'
              ? 'Try adjusting your search or filters.'
              : 'Be the first to create a campaign!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-3">
          {filtered.map((campaign, index) => (
            <Link
              key={campaign.id}
              to={`/campaign/${campaign.id}`}
              style={{ textDecoration: 'none', animationDelay: `${index * 0.05}s` }}
              className="slide-up"
            >
              <div className="card" style={{ height: '100%' }}>
                {campaign.image_url ? (
                  <img src={campaign.image_url} alt={campaign.title} className="campaign-image" />
                ) : (
                  <div className="campaign-image-placeholder">🚀</div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                  <h3 className="card-title" style={{ fontSize: 'var(--font-size-lg)' }}>{campaign.title}</h3>
                  <span className={`badge ${isActive(campaign) ? 'badge-active' : 'badge-ended'}`}>
                    {isActive(campaign) ? 'Active' : 'Ended'}
                  </span>
                </div>

                {campaign.category && (
                  <span className="badge badge-category" style={{ marginBottom: 'var(--space-3)', display: 'inline-block' }}>
                    {campaign.category}
                  </span>
                )}

                {campaign.description && (
                  <p style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--space-4)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {campaign.description}
                  </p>
                )}

                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {campaign.onChain ? formatEth(campaign.onChain.totalRaised) : '0'} ETH
                    </span>
                    <span style={{ fontWeight: 600 }}>{getProgress(campaign).toFixed(0)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${getProgress(campaign)}%` }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  <span>Goal: {campaign.goal_amount || '0'} ETH</span>
                  <span>{getTimeLeft(campaign)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
