import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { isMetaMaskInstalled, getProvider, getCampaignContractAsync, formatEth, getCurrentAccount } from '../utils/ethereum.js';

export default function InvestorDashboard() {
  const { user, token } = useAuth();
  const [backedCampaigns, setBackedCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalInvested: '0', totalBacked: 0, pendingVotes: 0 });

  useEffect(() => {
    fetchBackedCampaigns();
  }, []);

  async function fetchBackedCampaigns() {
    try {
      const res = await fetch('/api/campaigns', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allCampaigns = await res.json();

      if (!isMetaMaskInstalled() || allCampaigns.length === 0) {
        setCampaigns(allCampaigns);
        setLoading(false);
        return;
      }

      const provider = getProvider();
      const account = await getCurrentAccount();
      if (!account) {
        setLoading(false);
        return;
      }

      const enriched = [];
      let totalInvested = 0;
      let pendingVotes = 0;

      for (const c of allCampaigns) {
        try {
          const contract = await getCampaignContractAsync(c.campaign_address, provider);
          const contribution = await contract.contributions(account);
          const contribAmount = parseFloat(formatEth(contribution.toString()));

          if (contribAmount > 0) {
            const totalRaised = await contract.totalRaised();
            const goal = await contract.goal();
            const deadline = await contract.deadline();
            const milestoneCount = await contract.milestoneCount();

            // Check for pending votes
            let pendingForThis = 0;
            for (let i = 0; i < Number(milestoneCount); i++) {
              const milestone = await contract.getMilestone(i);
              const hasVoted = await contract.hasVoted(i, account);
              if (milestone[3] && !milestone[4] && !hasVoted) { // approved && !executed && !voted
                pendingForThis++;
              }
            }

            totalInvested += contribAmount;
            pendingVotes += pendingForThis;

            enriched.push({
              ...c,
              contribution: contribAmount,
              onChain: {
                totalRaised: totalRaised.toString(),
                goal: goal.toString(),
                deadline: Number(deadline),
                milestoneCount: Number(milestoneCount)
              },
              pendingVotes: pendingForThis
            });
          }
        } catch (err) {
          console.error('Error checking campaign:', c.campaign_address, err);
        }
      }

      setBackedCampaigns(enriched);
      setStats({
        totalInvested: totalInvested.toFixed(4),
        totalBacked: enriched.length,
        pendingVotes
      });
    } catch (err) {
      console.error('Failed to fetch backed campaigns:', err);
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

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg"></div>
        <p>Loading your investments...</p>
      </div>
    );
  }

  return (
    <div className="page container fade-in">
      <div className="page-header">
        <h1 className="page-title">Investor Dashboard</h1>
        <p className="page-subtitle">Welcome back, {user?.name}!</p>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="stat-card">
          <div className="stat-value">{stats.totalInvested} ETH</div>
          <div className="stat-label">Total Invested</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalBacked}</div>
          <div className="stat-label">Campaigns Backed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: stats.pendingVotes > 0 ? 'var(--color-warning)' : undefined }}>
            {stats.pendingVotes}
          </div>
          <div className="stat-label">Pending Votes</div>
        </div>
      </div>

      {backedCampaigns.length === 0 ? (
        <div className="empty-state">
          <h3>No investments yet</h3>
          <p>Explore active campaigns and start investing in projects you believe in.</p>
          <Link to="/discover" className="btn btn-primary">
            Discover Campaigns
          </Link>
        </div>
      ) : (
        <div className="grid grid-2">
          {backedCampaigns.map(campaign => (
            <Link
              key={campaign.id}
              to={`/campaign/${campaign.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="card slide-up">
                {campaign.image_url ? (
                  <img src={campaign.image_url} alt={campaign.title} className="campaign-image" />
                ) : (
                  <div className="campaign-image-placeholder">💰</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h3 className="card-title">{campaign.title}</h3>
                  {campaign.pendingVotes > 0 && (
                    <span className="badge badge-pending">{campaign.pendingVotes} votes pending</span>
                  )}
                </div>

                <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  Your investment: <strong style={{ color: 'var(--text-primary)' }}>{campaign.contribution} ETH</strong>
                </div>

                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Funding Progress</span>
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
