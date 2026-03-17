import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { isMetaMaskInstalled, getSigner, getFactoryContract, parseEth } from '../utils/ethereum.js';

const CATEGORIES = ['Technology', 'Art & Design', 'Health', 'Education', 'Environment', 'Community', 'Finance', 'Other'];

export default function CreateCampaign() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState('');

  // Step 1: Campaign Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState('');
  const [goalEth, setGoalEth] = useState('');
  const [durationDays, setDurationDays] = useState('');

  // Step 2: Milestones
  const [milestones, setMilestones] = useState([{ name: '', percent: '' }]);

  function addMilestone() {
    setMilestones([...milestones, { name: '', percent: '' }]);
  }

  function removeMilestone(index) {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  }

  function updateMilestone(index, field, value) {
    const updated = milestones.map((m, i) =>
      i === index ? { ...m, [field]: value } : m
    );
    setMilestones(updated);
  }

  function getTotalPercent() {
    return milestones.reduce((sum, m) => sum + (parseInt(m.percent) || 0), 0);
  }

  function validateStep1() {
    if (!title.trim()) return 'Title is required';
    if (!description.trim()) return 'Description is required';
    if (!category) return 'Category is required';
    if (!goalEth || parseFloat(goalEth) <= 0) return 'Goal must be greater than 0 ETH';
    if (!durationDays || parseInt(durationDays) <= 0) return 'Duration must be at least 1 day';
    return null;
  }

  function validateStep2() {
    for (let i = 0; i < milestones.length; i++) {
      if (!milestones[i].name.trim()) return `Milestone ${i + 1} needs a name`;
      if (!milestones[i].percent || parseInt(milestones[i].percent) <= 0) return `Milestone ${i + 1} needs a valid percentage`;
    }
    if (getTotalPercent() !== 100) return `Milestone percentages must total 100% (currently ${getTotalPercent()}%)`;
    return null;
  }

  function handleNext() {
    setError('');
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
      setStep(2);
    } else if (step === 2) {
      const err = validateStep2();
      if (err) { setError(err); return; }
      setStep(3);
    }
  }

  function handleBack() {
    setError('');
    setStep(step - 1);
  }

  async function handleDeploy() {
    setError('');
    setLoading(true);

    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed. Please install MetaMask to deploy a campaign.');
      setLoading(false);
      return;
    }

    try {
      setTxStatus('Connecting to MetaMask...');
      const signer = await getSigner();
      const signerAddress = await signer.getAddress();

      setTxStatus('Deploying campaign contract...');
      const factory = await getFactoryContract(signer);

      const goalWei = parseEth(goalEth);
      const milestoneNames = milestones.map(m => m.name);
      const milestonePercents = milestones.map(m => parseInt(m.percent));

      const tx = await factory.createCampaign(
        goalWei,
        parseInt(durationDays),
        milestoneNames,
        milestonePercents
      );

      setTxStatus('Waiting for transaction confirmation...');
      const receipt = await tx.wait();

      // Get the campaign address from the event
      let campaignAddress = '';
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog(log);
          if (parsed && parsed.name === 'CampaignCreated') {
            campaignAddress = parsed.args.campaignAddress;
            break;
          }
        } catch { /* skip non-matching logs */ }
      }

      if (!campaignAddress) {
        throw new Error('Could not find campaign address from transaction receipt');
      }

      setTxStatus('Saving campaign metadata...');

      // Save to backend
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          campaign_address: campaignAddress,
          creator_address: signerAddress,
          title,
          description,
          image_url: imageUrl,
          category,
          goal_amount: goalEth,
          duration_days: parseInt(durationDays)
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save campaign');
      }

      setTxStatus('Campaign created successfully!');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      console.error('Deploy error:', err);
      setError(err.message || 'Failed to deploy campaign');
      setTxStatus('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page container fade-in" style={{ maxWidth: 700, margin: '0 auto' }}>
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h1 className="page-title">Create Campaign</h1>
        <p className="page-subtitle">Launch your project on the blockchain</p>
      </div>

      {/* Wizard Steps */}
      <div className="wizard-steps">
        <div className={`wizard-step ${step >= 1 ? (step > 1 ? 'completed' : 'active') : ''}`} />
        <div className={`wizard-step ${step >= 2 ? (step > 2 ? 'completed' : 'active') : ''}`} />
        <div className={`wizard-step ${step >= 3 ? 'active' : ''}`} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {txStatus && <div className="alert alert-info">{txStatus}</div>}

      <div className="card">
        {/* Step 1: Campaign Details */}
        {step === 1 && (
          <div className="slide-up">
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-6)' }}>
              Campaign Details
            </h2>

            <div className="form-group">
              <label className="form-label" htmlFor="title">Campaign Title</label>
              <input
                id="title"
                type="text"
                className="form-input"
                placeholder="My Awesome Project"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="description">Description</label>
              <textarea
                id="description"
                className="form-input"
                placeholder="Describe your project and what funds will be used for..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="imageUrl">Image URL</label>
              <input
                id="imageUrl"
                type="url"
                className="form-input"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="category">Category</label>
              <select
                id="category"
                className="form-input"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                <option value="">Select a category</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="goal">Funding Goal (ETH)</label>
                <input
                  id="goal"
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="10.0"
                  value={goalEth}
                  onChange={e => setGoalEth(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="duration">Duration (days)</label>
                <input
                  id="duration"
                  type="number"
                  className="form-input"
                  placeholder="30"
                  value={durationDays}
                  onChange={e => setDurationDays(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Milestones */}
        {step === 2 && (
          <div className="slide-up">
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Milestones
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-6)' }}>
              Define how funds will be released. Percentages must total 100%.
              <span style={{ float: 'right', fontWeight: 600, color: getTotalPercent() === 100 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                Total: {getTotalPercent()}%
              </span>
            </p>

            {milestones.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 40px',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-3)',
                  alignItems: 'end'
                }}
              >
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Milestone {i + 1}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. MVP Development"
                    value={m.name}
                    onChange={e => updateMilestone(i, 'name', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">%</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="25"
                    value={m.percent}
                    onChange={e => updateMilestone(i, 'percent', e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => removeMilestone(i)}
                  disabled={milestones.length <= 1}
                  style={{ marginBottom: 0, height: 42 }}
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={addMilestone}
              style={{ marginTop: 'var(--space-4)' }}
            >
              + Add Milestone
            </button>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="slide-up">
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-6)' }}>
              Review & Deploy
            </h2>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>Title</div>
              <div style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>{title}</div>

              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>Description</div>
              <div style={{ marginBottom: 'var(--space-4)', color: 'var(--text-secondary)' }}>{description}</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Category</div>
                  <div style={{ fontWeight: 600 }}>{category}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Goal</div>
                  <div style={{ fontWeight: 600 }}>{goalEth} ETH</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Duration</div>
                  <div style={{ fontWeight: 600 }}>{durationDays} days</div>
                </div>
              </div>

              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>Milestones</div>
              {milestones.map((m, i) => (
                <div key={i} className="milestone-item" style={{ marginBottom: 'var(--space-2)' }}>
                  <div className="milestone-info">
                    <div className="milestone-name">{m.name}</div>
                  </div>
                  <div className="milestone-percent">{m.percent}%</div>
                </div>
              ))}
            </div>

            <div className="alert alert-info" style={{ marginBottom: 'var(--space-4)' }}>
              ⚡ Deploying will create a smart contract on the blockchain. This requires a MetaMask transaction and gas fees.
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="wizard-nav">
          {step > 1 ? (
            <button className="btn btn-secondary" onClick={handleBack} disabled={loading}>
              Back
            </button>
          ) : <div />}

          {step < 3 ? (
            <button className="btn btn-primary" onClick={handleNext}>
              Next
            </button>
          ) : (
            <button
              className="btn btn-primary btn-lg"
              onClick={handleDeploy}
              disabled={loading}
            >
              {loading ? <><span className="spinner" /> Deploying...</> : '🚀 Deploy Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
