import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Megaphone,
  RotateCcw,
  Wand2,
} from 'lucide-react';
import React, { useState } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import {
  CAMPAIGN_THEMES,
  evaluateAdCampaignPrompt,
  INITIAL_PROJECT_LEAD_CONFIG,
  PROJECT_LEAD_SPECS,
  type AdCampaignEvaluation,
} from '../../data/teamData';
import { computeTeamEngineeringSummary } from '../../simulation/integrationValidator';
import {
  type ProjectLeadConfiguration,
  type SponsorTier,
  type TeamRobotProject,
} from '../../types/robot';
import { ResetTaskModal } from './ResetTaskModal';

interface ProjectLeadScreenProps {
  project: TeamRobotProject;
  onUpdateProjectLead: (nextLead: ProjectLeadConfiguration) => void;
  onReturnToDashboard: () => void;
}

export const ProjectLeadScreen: React.FC<ProjectLeadScreenProps> = ({
  project,
  onUpdateProjectLead,
  onReturnToDashboard,
}) => {
  const lead = project.projectLead;
  const summary = computeTeamEngineeringSummary(project);

  const [activeTab, setActiveTab] = useState<'create' | 'procurement'>('create');
  // Starts EMPTY per requirement: No high-scoring starter prompt!
  const [promptText, setPromptText] = useState(lead.adPrompt || '');
  const [showResetModal, setShowResetModal] = useState(false);

  const [evaluation, setEvaluation] = useState<AdCampaignEvaluation | null>(() => {
    if (lead.campaignScore > 0 && lead.sponsorTier !== 'None' && lead.adPrompt) {
      return evaluateAdCampaignPrompt(lead.adPrompt, project);
    }
    return null;
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);

  const baseBudget = lead.baseBudgetUsd || 1800;
  const currentSponsorship = lead.sponsorshipUsd || 0;
  const totalAvailable = baseBudget + currentSponsorship;
  const remainingBudget = totalAvailable - summary.totalCostUsd;

  const updateLead = (updated: Partial<ProjectLeadConfiguration>) => {
    onUpdateProjectLead({ ...lead, ...updated });
  };

  const handleResetBusiness = () => {
    soundEngine.playInstall();
    setPromptText('');
    setEvaluation(null);
    setShowResultModal(false);
    updateLead({
      ...INITIAL_PROJECT_LEAD_CONFIG,
      baseBudgetUsd: 1800,
      budgetCapUsd: 1800,
      sponsorshipUsd: 0,
      sponsorTier: 'None',
      adPrompt: '',
      adHeadline: '',
      campaignScore: 0,
      activeSponsors: [],
      campaign: null,
      shippingTier: 'standard',
      sparePartsKit: 'drive',
      complianceSigned: false,
      isCompleted: false,
    });
    setShowResetModal(false);
  };

  const handleGenerateAd = () => {
    if (!promptText.trim() || isGenerating) return;
    soundEngine.playClick();
    setIsGenerating(true);

    window.setTimeout(() => {
      setIsGenerating(false);
      soundEngine.playInstall();
      const result = evaluateAdCampaignPrompt(promptText, project);
      setEvaluation(result);
      setShowResultModal(true);
    }, 1000);
  };

  const handleAcceptSponsorship = () => {
    if (!evaluation) return;
    soundEngine.playInstall();

    const newCap = baseBudget + evaluation.fundingUsd;
    updateLead({
      adPrompt: promptText,
      adHeadline: evaluation.headline,
      campaignScore: evaluation.score,
      sponsorshipUsd: evaluation.fundingUsd,
      sponsorTier: evaluation.tier as SponsorTier,
      budgetCapUsd: newCap,
      complianceSigned: true,
      isCompleted: true,
      campaign: {
        robotName: project.teamName || 'TITAN',
        headline: evaluation.headline,
        theme: evaluation.theme,
        approved: true,
      },
    });
    setShowResultModal(false);
  };

  const handleImproveCampaign = () => {
    soundEngine.playClick();
    setShowResultModal(false);
  };

  const toggleComplete = () => {
    soundEngine.playClick();
    updateLead({ isCompleted: !lead.isCompleted });
  };

  return (
    <div className="relative w-full h-full bg-[#080d1a] text-white overflow-y-auto flex flex-col justify-between p-4 md:p-6">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEngine.playClick();
              onReturnToDashboard();
            }}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono-num font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-700 hover:border-slate-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            DASHBOARD
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="text-[10px] font-mono-num uppercase tracking-wider text-purple-400 font-semibold">
                DISCIPLINE 04 • PROJECT LEAD
              </span>
            </div>
            <h2 className="font-display font-black text-2xl text-white">
              EARN YOUR SPONSORSHIP
            </h2>
          </div>
        </div>

        {/* Tab & Completion Controls */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-mono-num">
            <button
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('create');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'create'
                  ? 'bg-purple-500 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              AD CREATOR
            </button>
            <button
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('procurement');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'procurement'
                  ? 'bg-purple-500 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              BUDGET & SHIPPING
            </button>
          </div>

          <button
            onClick={() => setShowResetModal(true)}
            title="Reset Business task progress"
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono-num text-slate-400 hover:text-rose-300 bg-slate-900 border border-slate-800 hover:border-rose-900/50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>↻ Reset Task</span>
          </button>

          <button
            onClick={toggleComplete}
            disabled={!lead.isCompleted && currentSponsorship === 0}
            className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-display font-bold transition-all ${
              !lead.isCompleted && currentSponsorship === 0
                ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
                : lead.isCompleted
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                : 'bg-purple-500 text-white hover:bg-purple-400'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {lead.isCompleted ? 'DISCIPLINE COMPLETE' : 'ACCEPT & FINISH'}
          </button>
        </div>
      </div>

      <ResetTaskModal
        isOpen={showResetModal}
        roleTitle="BUSINESS"
        description="This will clear your advertisement prompt, erase generated campaign results, remove earned sponsorship funding, and mark the Business task as incomplete. Other team tasks will not be changed."
        onConfirm={handleResetBusiness}
        onCancel={() => setShowResetModal(false)}
      />

      {/* Current Funding Overview Bar */}
      <div className="my-3 p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono-num">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-400 block text-[10px]">BASE BUDGET</span>
            <span className="font-bold text-slate-200">${baseBudget.toLocaleString()}</span>
          </div>
          <span className="text-slate-600">+</span>
          <div>
            <span className="text-slate-400 block text-[10px]">SPONSORSHIP EARNED</span>
            <span className="font-bold text-amber-400">
              +${currentSponsorship.toLocaleString()}{' '}
              {lead.sponsorTier !== 'None' ? `(${lead.sponsorTier})` : ''}
            </span>
          </div>
          <span className="text-slate-600">=</span>
          <div>
            <span className="text-slate-400 block text-[10px]">TOTAL AVAILABLE</span>
            <span className="font-bold text-purple-300">${totalAvailable.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-400 block text-[10px]">ROBOT BOM COST</span>
            <span className="font-bold text-slate-200">${summary.totalCostUsd.toLocaleString()}</span>
          </div>
          <div className="w-px h-6 bg-slate-800" />
          <div>
            <span className="text-slate-400 block text-[10px]">REMAINING FUNDS</span>
            <span
              className={`font-bold text-sm ${remainingBudget < 0 ? 'text-red-400' : 'text-emerald-400'}`}
            >
              ${remainingBudget.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {activeTab === 'create' ? (
        /* ==========================================
           TAB 1: PROMPT-BASED ADVERTISEMENT CREATOR
           ========================================== */
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-[480px]">
          {/* Left: Prompt Input Form & Goal Guidance */}
          <div className="w-full lg:w-[460px] bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800 mb-3">
                <Megaphone className="w-4 h-4 text-purple-400" />
                <h3 className="font-display font-bold text-sm text-white">
                  DESCRIBE YOUR ADVERTISEMENT
                </h3>
              </div>

              {/* Goal Guidance Panel */}
              <div className="mb-3 p-3 bg-slate-900/90 border border-purple-900/40 rounded-xl text-xs font-mono-num text-slate-300 space-y-1.5">
                <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>CAMPAIGN GOAL QUESTIONS:</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-300">
                  <li>What makes your BattleBot memorable and intimidating?</li>
                  <li>What engineering strengths does your robot bring to combat?</li>
                  <li>Why would a company care about sponsoring your team?</li>
                  <li>How do you ask sponsors to support you today?</li>
                </ul>
              </div>

              {/* Natural Language Prompt Field */}
              <div className="relative">
                <textarea
                  rows={6}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Describe the advertisement you want to create..."
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-400 leading-relaxed resize-none"
                />
              </div>

              {/* Sponsor Tier Reward Reference */}
              <div className="mt-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] font-mono-num space-y-1">
                <span className="text-slate-400 block font-bold mb-1">SPONSORSHIP TIERS:</span>
                <div className="flex justify-between text-amber-400">
                  <span>🥉 BRONZE (40–64 pts)</span>
                  <strong className="font-bold">+$200</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>🥈 SILVER (65–84 pts)</span>
                  <strong className="font-bold">+$400</strong>
                </div>
                <div className="flex justify-between text-yellow-400">
                  <span>🥇 GOLD (85–100 pts)</span>
                  <strong className="font-bold">+$700</strong>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <span className="text-[11px] font-mono-num text-slate-500">
                Iterate as many times as needed.
              </span>
              <button
                onClick={handleGenerateAd}
                disabled={isGenerating || !promptText.trim()}
                className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-black text-sm bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25 transition-all transform hover:-translate-y-0.5"
              >
                <Wand2 className="w-4 h-4" />
                {isGenerating ? 'GENERATING...' : 'GENERATE AD'}
              </button>
            </div>
          </div>

          {/* Right: Rendered Advertisement Poster */}
          <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-6 flex items-center justify-center relative">
            {evaluation ? (
              <div className="w-full max-w-md rounded-2xl p-6 border border-slate-700 shadow-2xl relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#0a0f20] to-slate-950">
                {/* Visual Banner Accent */}
                <div
                  className={`h-2.5 -mx-6 -mt-6 mb-5 bg-gradient-to-r ${CAMPAIGN_THEMES[evaluation.theme].bannerColor}`}
                />

                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[9px] font-mono-num text-purple-400 uppercase tracking-widest font-bold block">
                      OFFICIAL TEAM ADVERTISEMENT
                    </span>
                    <h3 className="font-display font-black text-2xl text-white tracking-wide">
                      {project.teamName || 'BATTLEBOT'}
                    </h3>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-mono-num font-bold border ${
                      evaluation.tier === 'Gold'
                        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                        : evaluation.tier === 'Silver'
                        ? 'bg-slate-300/20 text-slate-200 border-slate-400'
                        : 'bg-amber-700/20 text-amber-300 border-amber-600/40'
                    }`}
                  >
                    {evaluation.tier.toUpperCase()} TIER (+${evaluation.fundingUsd})
                  </span>
                </div>

                <p className="text-xs text-purple-300 font-bold mb-4 tracking-wide uppercase">
                  "{evaluation.headline}"
                </p>

                {/* Robot Silhouette Graphic */}
                <div className="my-3 py-6 px-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col items-center justify-center">
                  <span className="text-3xl mb-1">🤖</span>
                  <span className="font-display font-bold text-sm text-white">
                    {project.mechanical.chassisId.toUpperCase()} CHASSIS • {project.mechanical.weaponId.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-mono-num text-slate-400">
                    Autonomous 30 lb Class Champion
                  </span>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-3 gap-2 my-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono-num">
                  <div>
                    <span className="text-[9px] text-slate-400 block">KINETIC FORCE</span>
                    <span className="font-bold text-xs text-amber-400">
                      {summary.stats.weaponEnergyJ} J
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block">TOP SPEED</span>
                    <span className="font-bold text-xs text-cyan-400">
                      {summary.stats.topSpeedMph.toFixed(1)} mph
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block">MASS</span>
                    <span className="font-bold text-xs text-white">
                      {summary.totalWeightLb} lb
                    </span>
                  </div>
                </div>

                {/* Sponsor Callout Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono-num text-slate-400">
                  <span>ENGINEERED BY {project.teamName || 'THE TEAM'}</span>
                  <span className="text-purple-400 font-bold">READY FOR COMBAT</span>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 max-w-sm text-slate-500 font-mono-num text-xs">
                <Megaphone className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p>Type a prompt on the left and click <strong>[GENERATE AD]</strong> to pitch sponsors.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==========================================
           TAB 2: PROCUREMENT & SHIPPING
           ========================================== */
        <div className="flex-1 my-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
            <h3 className="font-display font-bold text-sm text-white mb-3">SHIPPING & FREIGHT TIER</h3>
            <div className="space-y-3">
              {(['standard', 'expedited'] as const).map((tierKey) => {
                const spec = PROJECT_LEAD_SPECS.shippingTiers[tierKey];
                const isSelected = lead.shippingTier === tierKey;
                return (
                  <div
                    key={tierKey}
                    onClick={() => updateLead({ shippingTier: tierKey })}
                    className={`cursor-pointer p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-purple-500/15 border-purple-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex justify-between text-xs font-mono-num mb-1">
                      <span className="font-bold">{spec.name}</span>
                      <span className="text-purple-300 font-bold">${spec.costUsd}</span>
                    </div>
                    <p className="text-xs text-slate-400">{spec.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <h3 className="font-display font-bold text-sm text-white mb-3">PIT SPARE PARTS KIT</h3>
              <div className="space-y-2">
                {(['none', 'drive', 'full'] as const).map((kitKey) => {
                  const spec = PROJECT_LEAD_SPECS.spareKits[kitKey];
                  const isSelected = lead.sparePartsKit === kitKey;
                  return (
                    <div
                      key={kitKey}
                      onClick={() => updateLead({ sparePartsKit: kitKey })}
                      className={`cursor-pointer p-2.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-purple-500/15 border-purple-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex justify-between text-xs font-mono-num mb-0.5">
                        <span className="font-bold">{spec.name}</span>
                        <span className="text-purple-300 font-bold">${spec.costUsd}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{spec.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono-num flex justify-between">
              <span>LEAD TIME STATUS:</span>
              <span className={summary.leadTimeConflict ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                {summary.maxLeadTimeDays} Days / {PROJECT_LEAD_SPECS.competitionDeadlineDays} Day Deadline
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sponsorship Result Modal with 5-Category Breakdown & Retry Loop */}
      {showResultModal && evaluation && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#0b1020] border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start mb-3 pb-2 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-mono-num text-purple-400 uppercase tracking-widest font-bold block">
                  SPONSORSHIP EVALUATION
                </span>
                <h3 className="font-display font-black text-xl text-white">
                  {evaluation.tier === 'Gold'
                    ? '🥇 GOLD SPONSORSHIP OFFER'
                    : evaluation.tier === 'Silver'
                    ? '🥈 SILVER SPONSORSHIP OFFER'
                    : '🥉 BRONZE SPONSORSHIP OFFER'}
                </h3>
              </div>
              <span className="text-sm font-mono-num font-bold text-amber-400">
                {evaluation.score} / 100 PTS
              </span>
            </div>

            {/* Rubric Category Breakdown */}
            <div className="my-3 space-y-2">
              {[
                evaluation.criteria.robotIdentity,
                evaluation.criteria.engineeringStory,
                evaluation.criteria.sponsorValue,
                evaluation.criteria.callToAction,
                evaluation.criteria.creativeDirection,
              ]
                .filter(Boolean)
                .map((crit, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono-num"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-200 font-bold">{crit.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{crit.score} / {crit.maxScore} pts</span>
                        <span className={crit.passed ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                          {crit.passed ? '✓' : '△'}
                        </span>
                      </div>
                    </div>
                    {crit.hint && !crit.passed && (
                      <p className="text-[10px] text-amber-300/80 mt-0.5">{crit.hint}</p>
                    )}
                  </div>
                ))}
            </div>

            {/* Sponsor Feedback Quote */}
            <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/40 text-xs font-mono-num text-purple-200 mb-4 leading-relaxed">
              <strong>SPONSOR EVALUATION:</strong> "{evaluation.sponsorFeedback}"
            </div>

            {/* Funding Offer Callout */}
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-center justify-between text-xs font-mono-num mb-5">
              <span className="text-slate-300">CONFIRMED TEAM FUNDING:</span>
              <strong className="text-emerald-400 font-bold text-base">
                +${evaluation.fundingUsd}
              </strong>
            </div>

            {/* Action Buttons: Accept or Iterate */}
            <div className="flex justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={handleImproveCampaign}
                className="cursor-pointer px-4 py-2.5 rounded-xl text-xs font-mono-num text-slate-300 hover:text-white bg-slate-900 border border-slate-700 hover:border-slate-600 transition-colors"
              >
                ← EDIT & TRY AGAIN
              </button>

              <button
                onClick={handleAcceptSponsorship}
                className="cursor-pointer px-5 py-2.5 rounded-xl text-xs font-display font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/25 transition-all transform hover:-translate-y-0.5"
              >
                ACCEPT SPONSORSHIP (+${evaluation.fundingUsd})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
