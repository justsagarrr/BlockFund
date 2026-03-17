import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  isMetaMaskInstalled, getProvider, getSigner, getCampaignContractAsync,
  formatEth, getCurrentAccount
} from '../utils/ethereum.js';

export default function Portfolio() {
  const { user, token } = useAuth();
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchPortfolio();
  }, []);

  async function fetchPortfolio() {
    try {
      const res = await fetch('/api/campaigns', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allCampaigns = await res.json();

      if (!isMetaMaskInstalled() || allCampaigns.length === 0) {
        setLoading(false);
        return;
      }

      const provider = getProvider();
      const account = await getCurrentAccount();
      if (!account) {
        setLoading(false);
        return;
      }

      const portfolio = [];

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
            const investorCountVal = await contract.investorCount();

            // Fetch milestone details
            const milestoneData = [];
            for (let i = 0; i < Number(milestoneCount); i++) {
              const m = await contract.getMilestone(i);
              const hasVoted = await contract.hasVoted(i, account);
              milestoneData.push({
                index: i,
                name: m[0],
                percent: Number(m[1]),
                amountToRelease: m[2].toString(),
                approved: m[3],
                executed: m[4],
                voteCount: Number(m[5]),
                hasVoted
              });
            }

            portfolio.push({
              ...c,
              contribution: contribAmount,
              onChain: {
                totalRaised: totalRaised.toString(),
                goal: goal.toString(),
                deadline: Number(deadline),
                investorCount: Number(investorCountVal)
              },
              milestones: milestoneData
            });
          }
        } catch (err) {
          console.error('Error checking campaign:', c.campaign_address, err);
        }
      }

      setInvestments(portfolio);
    } catch (err) {
      console.error('Portfolio fetch error:', err);
      setError('Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(campaignAddress, milestoneIndex) {
    setError(''); setSuccess('');
    setActionLoading(`vote-${campaignAddress}-${milestoneIndex}`);
    try {
      const signer = await getSigner();
      const contract = await getCampaignContractAsync(campaignAddress, signer);
      const tx = await contract.voteMilestone(milestoneIndex);
      await tx.wait();
      setSuccess('Vote submitted successfully!');
      await fetchPortfolio();
    } catch (err) {
      setError(err.reason || err.message || 'Vote failed');
    } finally {
      setActionLoading('');
    }
  }

  function getProgress(investment) {
    if (!investment.onChain) return 0;
    const goal = parseFloat(formatEth(investment.onChain.goal));
    const raised = parseFloat(formatEth(investment.onChain.totalRaised));
    if (goal === 0) return 0;
    return Math.min((raised / goal) * 100, 100);
  }

  function getVoteThreshold(investment) {
    return Math.floor(investment.onChain.investorCount / 2) + 1;
  }

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg"></div>
        <p>Loading your portfolio...</p>
      </div>
    );
  }

  return (
    <div className="page container fade-in">
      <div className="page-header">
        <h1 className="page-title">My Portfolio</h1>
        <p className="page-subtitle">Track your investments and vote on milestones</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {investments.length === 0 ? (
        <div className="empty-state">
          <h3>No investments yet</h3>
          <p>Explore active campaigns and start investing in projects you believe in.</p>
          <Link to="/discover" className="btn btn-primary">
            Discover Campaigns
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {investments.map(investment => (
            <div key={investment.id} className="card slide-up">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                <div>
                  <Link to={`/campaign/${investment.id}`} style={{ textDecoration: 'none' }}>
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-1)' }}>
                      {investment.title}
                    </h3>
                  </Link>
                  {investment.category && (
                    <span className="badge badge-category">{investment.category}</span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                    {investment.contribution} ETH
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Your investment
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {formatEth(investment.onChain.totalRaised)} / {formatEth(investment.onChain.goal)} ETH
                  </span>
                  <span style={{ fontWeight: 600 }}>{getProgress(investment).toFixed(0)}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${getProgress(investment)}%` }} />
                </div>
              </div>

              {/* Milestones */}
              {investment.milestones.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Milestones
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {investment.milestones.map(m => (
                      <div key={m.index} className="milestone-item">
                        <div className="milestone-info">
                          <div className="milestone-name">
                            {m.executed ? '✅ ' : m.approved ? '🗳️ ' : '⏳ '}{m.name}
                          </div>
                          <div className="milestone-percent">
                            {m.percent}% · {formatEth(m.amountToRelease)} ETH
                            {m.approved && !m.executed && (
                              <span style={{ marginLeft: 'var(--space-3)' }}>
                                Votes: {m.voteCount}/{getVoteThreshold(investment)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="milestone-actions">
                          {m.approved && !m.executed && !m.hasVoted && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleVote(investment.campaign_address, m.index)}
                              disabled={actionLoading === `vote-${investment.campaign_address}-${m.index}`}
                            >
                              {actionLoading === `vote-${investment.campaign_address}-${m.index}`
                                ? <span className="spinner" />
                                : 'Vote Yes'}
                            </button>
                          )}
                          {m.hasVoted && !m.executed && (
                            <span className="badge badge-active">Voted ✓</span>
                          )}
                          {m.executed && (
                            <span className="badge badge-active">Released</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
