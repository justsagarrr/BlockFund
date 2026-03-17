import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { isMetaMaskInstalled, getProvider, getCampaignContractAsync, formatEth } from '../utils/ethereum.js';

export default function CampaignerDashboard() {
  const { user, token } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, totalRaised: '0', activeCampaigns: 0 });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    try {
      const res = await fetch('/api/campaigns', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const all = await res.json();

      // Filter by creator wallet address
      const myCampaigns = all.filter(
        c => c.creator_address?.toLowerCase() === user?.wallet_address?.toLowerCase()
      );

      // Enrich with on-chain data
      if (isMetaMaskInstalled() && myCampaigns.length > 0) {
        const provider = getProvider();
        const enriched = await Promise.all(myCampaigns.map(async (c) => {
          try {
            const contract = await getCampaignContractAsync(c.campaign_address, provider);
            const totalRaised = await contract.totalRaised();
            const goal = await contract.goal();
            const deadline = await contract.deadline();
            const milestoneCount = await contract.milestoneCount();

            return {
              ...c,
              onChain: {
                totalRaised: totalRaised.toString(),
                goal: goal.toString(),
                deadline: Number(deadline),
                milestoneCount: Number(milestoneCount)
              }
            };
          } catch {
            return { ...c, onChain: null };
          }
        }));

        setCampaigns(enriched);

        const totalR = enriched.reduce((sum, c) =>
          sum + parseFloat(c.onChain ? formatEth(c.onChain.totalRaised) : 0), 0
        );
        const active = enriched.filter(c =>
          c.onChain && c.onChain.deadline * 1000 > Date.now()
        ).length;

        setStats({ total: enriched.length, totalRaised: totalR.toFixed(4), activeCampaigns: active });
      } else {
        setCampaigns(myCampaigns);
        setStats({ total: myCampaigns.length, totalRaised: '0', activeCampaigns: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  }

  function getProgress(campaign) {
    if (!campaign.onChain) return 0;
    const goal = parseFloat(formatEth(campaign.onChain.goal));
    const raised = parseFloat(formatEth(campaign.onChain.totalRaised));
    if (goal === 0) return 0;
    return Math.min((raised / goal) * 100, 100);
  }

  function isExpired(campaign) {
    if (!campaign.onChain) return false;
    return campaign.onChain.deadline * 1000 < Date.now();
  }

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg"></div>
        <p>Loading your campaigns...</p>
      </div>
    );
  }

  return (
    <div className="page container fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Campaigner Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.name}!</p>
        </div>
        <Link to="/create" className="btn btn-primary">
          + New Campaign
        </Link>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Campaigns</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalRaised} ETH</div>
          <div className="stat-label">Total Raised</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.activeCampaigns}</div>
          <div className="stat-label">Active Campaigns</div>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="empty-state">
          <h3>No campaigns yet</h3>
          <p>Create your first campaign and start raising funds on the blockchain.</p>
          <Link to="/create" className="btn btn-primary">
            Create Campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-2">
          {campaigns.map(campaign => (
            <Link
              key={campaign.id}
              to={`/campaign/${campaign.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="card slide-up">
                {campaign.image_url ? (
                  <img src={campaign.image_url} alt={campaign.title} className="campaign-image" />
                ) : (
                  <div className="campaign-image-placeholder">📋</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h3 className="card-title">{campaign.title}</h3>
                  <span className={`badge ${isExpired(campaign) ? 'badge-ended' : 'badge-active'}`}>
                    {isExpired(campaign) ? 'Ended' : 'Active'}
                  </span>
                </div>

                {campaign.category && (
                  <span className="badge badge-category" style={{ marginBottom: 'var(--space-3)' }}>
                    {campaign.category}
                  </span>
                )}

                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Progress</span>
                    <span style={{ fontWeight: 600 }}>{getProgress(campaign).toFixed(1)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${getProgress(campaign)}%` }} />
                  </div>
                </div>

                {campaign.onChain && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                    <span>{formatEth(campaign.onChain.totalRaised)} ETH raised</span>
                    <span>Goal: {formatEth(campaign.onChain.goal)} ETH</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
