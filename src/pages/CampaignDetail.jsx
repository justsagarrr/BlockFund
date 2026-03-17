import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  isMetaMaskInstalled, getProvider, getSigner, getCampaignContractAsync,
  formatEth, parseEth, getCurrentAccount
} from '../utils/ethereum.js';

export default function CampaignDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const [campaign, setCampaign] = useState(null);
  const [onChain, setOnChain] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [investAmount, setInvestAmount] = useState('');
  const [investLoading, setInvestLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentAccount, setCurrentAccount] = useState(null);
  const [contribution, setContribution] = useState('0');
  const [investorCount, setInvestorCount] = useState(0);

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  async function fetchCampaign() {
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Campaign not found');
      const data = await res.json();
      setCampaign(data);

      if (isMetaMaskInstalled() && data.campaign_address) {
        await fetchOnChainData(data.campaign_address);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOnChainData(address) {
    try {
      const provider = getProvider();
      const contract = await getCampaignContractAsync(address, provider);
      const account = await getCurrentAccount();
      setCurrentAccount(account);

      const [totalRaised, goal, deadline, finalized, mCount, iCount] = await Promise.all([
        contract.totalRaised(),
        contract.goal(),
        contract.deadline(),
        contract.finalized(),
        contract.milestoneCount(),
        contract.investorCount()
      ]);

      setOnChain({
        totalRaised: totalRaised.toString(),
        goal: goal.toString(),
        deadline: Number(deadline),
        finalized
      });

      setInvestorCount(Number(iCount));

      // Fetch contribution
      if (account) {
        const contrib = await contract.contributions(account);
        setContribution(formatEth(contrib.toString()));
      }

      // Fetch milestones
      const milestoneData = [];
      for (let i = 0; i < Number(mCount); i++) {
        const m = await contract.getMilestone(i);
        let voted = false;
        if (account) {
          voted = await contract.hasVoted(i, account);
        }
        milestoneData.push({
          index: i,
          name: m[0],
          percent: Number(m[1]),
          amountToRelease: m[2].toString(),
          approved: m[3],
          executed: m[4],
          voteCount: Number(m[5]),
          hasVoted: voted
        });
      }
      setMilestones(milestoneData);
    } catch (err) {
      console.error('On-chain fetch error:', err);
    }
  }

  async function handleInvest() {
    setError(''); setSuccess('');
    if (!investAmount || parseFloat(investAmount) <= 0) {
      setError('Please enter a valid investment amount');
      return;
    }

    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed');
      return;
    }

    setInvestLoading(true);
    try {
      const signer = await getSigner();
      const contract = await getCampaignContractAsync(campaign.campaign_address, signer);
      const tx = await contract.invest({ value: parseEth(investAmount) });
      await tx.wait();
      setSuccess(`Successfully invested ${investAmount} ETH!`);
      setInvestAmount('');
      await fetchOnChainData(campaign.campaign_address);
    } catch (err) {
      setError(err.reason || err.message || 'Investment failed');
    } finally {
      setInvestLoading(false);
    }
  }

  async function handleRequestMilestone(index) {
    setError(''); setSuccess('');
    setActionLoading(`request-${index}`);
    try {
      const signer = await getSigner();
      const contract = await getCampaignContractAsync(campaign.campaign_address, signer);
      const tx = await contract.requestMilestone(index);
      await tx.wait();
      setSuccess(`Milestone ${index + 1} proposed for voting!`);
      await fetchOnChainData(campaign.campaign_address);
    } catch (err) {
      setError(err.reason || err.message || 'Failed to request milestone');
    } finally {
      setActionLoading('');
    }
  }

  async function handleVoteMilestone(index) {
    setError(''); setSuccess('');
    setActionLoading(`vote-${index}`);
    try {
      const signer = await getSigner();
      const contract = await getCampaignContractAsync(campaign.campaign_address, signer);
      const tx = await contract.voteMilestone(index);
      await tx.wait();
      setSuccess(`Voted for milestone ${index + 1}!`);
      await fetchOnChainData(campaign.campaign_address);
    } catch (err) {
      setError(err.reason || err.message || 'Vote failed');
    } finally {
      setActionLoading('');
    }
  }

  async function handleExecuteMilestone(index) {
    setError(''); setSuccess('');
    setActionLoading(`execute-${index}`);
    try {
      const signer = await getSigner();
      const contract = await getCampaignContractAsync(campaign.campaign_address, signer);
      const tx = await contract.executeMilestone(index);
      await tx.wait();
      setSuccess(`Milestone ${index + 1} executed! Funds released.`);
      await fetchOnChainData(campaign.campaign_address);
    } catch (err) {
      setError(err.reason || err.message || 'Execution failed');
    } finally {
      setActionLoading('');
    }
  }

  async function handleRefund() {
    setError(''); setSuccess('');
    setActionLoading('refund');
    try {
      const signer = await getSigner();
      const contract = await getCampaignContractAsync(campaign.campaign_address, signer);
      const tx = await contract.refund();
      await tx.wait();
      setSuccess('Refund successful!');
      await fetchOnChainData(campaign.campaign_address);
    } catch (err) {
      setError(err.reason || err.message || 'Refund failed');
    } finally {
      setActionLoading('');
    }
  }

  function getProgress() {
    if (!onChain) return 0;
    const goal = parseFloat(formatEth(onChain.goal));
    const raised = parseFloat(formatEth(onChain.totalRaised));
    if (goal === 0) return 0;
    return Math.min((raised / goal) * 100, 100);
  }

  function getTimeLeft() {
    if (!onChain) return { text: 'N/A', expired: false };
    const diff = onChain.deadline * 1000 - Date.now();
    if (diff <= 0) return { text: 'Campaign Ended', expired: true };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { text: `${days}d ${hours}h ${mins}m`, expired: false, days, hours, mins };
  }

  function isCreator() {
    return currentAccount && campaign?.creator_address?.toLowerCase() === currentAccount.toLowerCase();
  }

  function getVoteThreshold() {
    return Math.floor(investorCount / 2) + 1;
  }

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg"></div>
        <p>Loading campaign...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="page container">
        <div className="empty-state">
          <h3>Campaign not found</h3>
        </div>
      </div>
    );
  }

  const timeLeft = getTimeLeft();
  const progress = getProgress();

  return (
    <div className="page container fade-in">
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--space-8)', alignItems: 'start' }}>
        {/* Main Content */}
        <div>
          {campaign.image_url ? (
            <img
              src={campaign.image_url}
              alt={campaign.title}
              style={{ width: '100%', height: 360, objectFit: 'cover', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}
            />
          ) : (
            <div className="campaign-image-placeholder" style={{ height: 360, fontSize: 'var(--font-size-5xl)' }}>📋</div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            {campaign.category && <span className="badge badge-category">{campaign.category}</span>}
            <span className={`badge ${timeLeft.expired ? 'badge-ended' : 'badge-active'}`}>
              {timeLeft.expired ? 'Ended' : 'Active'}
            </span>
          </div>

          <h1 className="page-title">{campaign.title}</h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-base)', lineHeight: 1.8, marginTop: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
            {campaign.description}
          </p>

          {/* Milestones Section */}
          <div>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              Milestones
            </h2>

            {milestones.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No milestones data available</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {milestones.map(m => (
                  <div key={m.index} className="milestone-item">
                    <div className="milestone-info">
                      <div className="milestone-name">
                        {m.executed ? '✅ ' : m.approved ? '🗳️ ' : '⏳ '}
                        {m.name}
                      </div>
                      <div className="milestone-percent">
                        {m.percent}% · {formatEth(m.amountToRelease)} ETH
                      </div>
                    </div>

                    <div className="milestone-actions">
                      {m.approved && !m.executed && (
                        <span className="milestone-votes">
                          {m.voteCount}/{getVoteThreshold()} votes
                        </span>
                      )}

                      {/* Creator actions */}
                      {isCreator() && !m.approved && !m.executed && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRequestMilestone(m.index)}
                          disabled={actionLoading === `request-${m.index}`}
                        >
                          {actionLoading === `request-${m.index}` ? <span className="spinner" /> : 'Propose'}
                        </button>
                      )}

                      {isCreator() && m.approved && !m.executed && m.voteCount >= getVoteThreshold() && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleExecuteMilestone(m.index)}
                          disabled={actionLoading === `execute-${m.index}`}
                        >
                          {actionLoading === `execute-${m.index}` ? <span className="spinner" /> : 'Release Funds'}
                        </button>
                      )}

                      {/* Investor vote */}
                      {!isCreator() && m.approved && !m.executed && parseFloat(contribution) > 0 && !m.hasVoted && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleVoteMilestone(m.index)}
                          disabled={actionLoading === `vote-${m.index}`}
                        >
                          {actionLoading === `vote-${m.index}` ? <span className="spinner" /> : 'Vote Yes'}
                        </button>
                      )}

                      {m.hasVoted && !m.executed && (
                        <span className="badge badge-active">Voted</span>
                      )}

                      {m.executed && (
                        <span className="badge badge-active">Released</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ position: 'sticky', top: 90 }}>
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800 }}>
                {onChain ? formatEth(onChain.totalRaised) : '0'} ETH
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                raised of {onChain ? formatEth(onChain.goal) : campaign.goal_amount || '0'} ETH goal
              </div>
            </div>

            <div className="progress-bar" style={{ marginBottom: 'var(--space-4)', height: 10 }}>
              <div className={`progress-bar-fill ${progress >= 100 ? 'success' : ''}`} style={{ width: `${progress}%` }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>{progress.toFixed(0)}%</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Funded</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>{investorCount}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Backers</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>
                  {timeLeft.expired ? '0' : timeLeft.days || '0'}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {timeLeft.expired ? 'Ended' : 'Days Left'}
                </div>
              </div>
            </div>

            {/* Countdown */}
            {!timeLeft.expired && (
              <div className="countdown" style={{ marginBottom: 'var(--space-6)', justifyContent: 'center' }}>
                <div className="countdown-item">
                  <div className="countdown-value">{timeLeft.days || 0}</div>
                  <div className="countdown-label">Days</div>
                </div>
                <div className="countdown-item">
                  <div className="countdown-value">{timeLeft.hours || 0}</div>
                  <div className="countdown-label">Hours</div>
                </div>
                <div className="countdown-item">
                  <div className="countdown-value">{timeLeft.mins || 0}</div>
                  <div className="countdown-label">Mins</div>
                </div>
              </div>
            )}

            {/* Invest */}
            {user?.role === 'investor' && !timeLeft.expired && (
              <div>
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="Amount in ETH"
                    value={investAmount}
                    onChange={e => setInvestAmount(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  onClick={handleInvest}
                  disabled={investLoading}
                >
                  {investLoading ? <><span className="spinner" /> Processing...</> : '💎 Invest Now'}
                </button>
              </div>
            )}

            {/* Refund */}
            {user?.role === 'investor' && timeLeft.expired && parseFloat(contribution) > 0 && onChain && !onChain.finalized && (
              <button
                className="btn btn-danger"
                style={{ width: '100%' }}
                onClick={handleRefund}
                disabled={actionLoading === 'refund'}
              >
                {actionLoading === 'refund' ? <span className="spinner" /> : 'Request Refund'}
              </button>
            )}
          </div>

          {/* Your contribution */}
          {parseFloat(contribution) > 0 && (
            <div className="card">
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                Your Contribution
              </div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                {contribution} ETH
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
