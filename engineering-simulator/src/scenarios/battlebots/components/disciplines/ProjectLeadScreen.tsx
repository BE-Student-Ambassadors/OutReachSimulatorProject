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
import { CampaignPoster, type PosterTemplate } from './business/CampaignPoster';

interface ProjectLeadScreenProps {
  project: TeamRobotProject;
  onUpdateProjectLead: (nextLead: ProjectLeadConfiguration) => void;
  onReturnToDashboard: () => void;
  hideHeader?: boolean;
}

export const ProjectLeadScreen: React.FC<ProjectLeadScreenProps> = ({
  project,
  onUpdateProjectLead,
  onReturnToDashboard,
  hideHeader = false,
}) => {
  const lead = project.projectLead;
  const summary = computeTeamEngineeringSummary(project);

  const [activeTab, setActiveTab] = useState<'create' | 'procurement'>('create');
  // Starts EMPTY per requirement: No high-scoring starter prompt!
  const [promptText, setPromptText] = useState(lead.adPrompt || '');
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PosterTemplate | undefined>(undefined);

  const [evaluation, setEvaluation] = useState<AdCampaignEvaluation | null>(() => {
    if (lead.campaignScore > 0 && lead.sponsorTier !== 'None' && lead.adPrompt) {
      return evaluateAdCampaignPrompt(lead.adPrompt);
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
      const result = evaluateAdCampaignPrompt(promptText);
      setEvaluation(result);
      setShowResultModal(true);
    }, 900);
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
    <div className="relative w-full h-full bg-slate-50 text-slate-800 overflow-y-auto flex flex-col justify-between p-4 md:p-5 font-sans">
      {/* Optional Top Sub-Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onReturnToDashboard();
              }}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 transition-colors shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 font-bold">
                  Discipline 04 • Business
                </span>
              </div>
              <h2 className="font-display font-black text-lg text-slate-900 leading-tight">
                Sponsorship Studio & Budget
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setActiveTab('create');
                }}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  activeTab === 'create'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ad Creator
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setActiveTab('procurement');
                }}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  activeTab === 'procurement'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Logistics & Shipping
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              title="Reset Business task progress"
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-600 bg-white border border-slate-200 hover:border-rose-200 transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>↻ Reset Task</span>
            </button>

            <button
              type="button"
              onClick={toggleComplete}
              disabled={!lead.isCompleted && currentSponsorship === 0}
              className={`cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-display font-bold transition-all ${
                !lead.isCompleted && currentSponsorship === 0
                  ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-500'
                  : lead.isCompleted
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{lead.isCompleted ? 'Discipline Complete ✓' : 'Accept & Finish'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Sub-tab switcher when header is hidden */}
      {hideHeader && (
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-200">
          <div className="flex rounded-xl bg-slate-200/70 p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('create');
              }}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                activeTab === 'create'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ad Studio
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('procurement');
              }}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                activeTab === 'procurement'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Logistics & Shipping
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleComplete}
              disabled={!lead.isCompleted && currentSponsorship === 0}
              className={`cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-display font-bold transition-all ${
                !lead.isCompleted && currentSponsorship === 0
                  ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-500'
                  : lead.isCompleted
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{lead.isCompleted ? 'Sponsorship Active ✓' : 'Accept & Finish'}</span>
            </button>
          </div>
        </div>
      )}

      <ResetTaskModal
        isOpen={showResetModal}
        roleTitle="BUSINESS"
        description="This will clear your advertisement prompt, erase generated campaign results, remove earned sponsorship funding, and mark the Business task as incomplete. Other team tasks will not be changed."
        onConfirm={handleResetBusiness}
        onCancel={() => setShowResetModal(false)}
      />

      {/* Current Funding Overview Bar */}
      <div className="my-2.5 p-3.5 bg-white border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-400 block text-[10px] font-sans font-semibold">BASE LAB BUDGET</span>
            <span className="font-bold text-slate-800">${baseBudget.toLocaleString()}</span>
          </div>
          <span className="text-slate-300 font-sans">+</span>
          <div>
            <span className="text-slate-400 block text-[10px] font-sans font-semibold">SPONSORSHIP EARNED</span>
            <span className="font-bold text-emerald-600">
              +${currentSponsorship.toLocaleString()}{' '}
              {lead.sponsorTier !== 'None' ? `(${lead.sponsorTier})` : ''}
            </span>
          </div>
          <span className="text-slate-300 font-sans">=</span>
          <div>
            <span className="text-slate-400 block text-[10px] font-sans font-semibold">TOTAL AVAILABLE</span>
            <span className="font-bold text-slate-900">${totalAvailable.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-400 block text-[10px] font-sans font-semibold">ROBOT PARTS COST</span>
            <span className="font-bold text-slate-800">${summary.totalCostUsd.toLocaleString()}</span>
          </div>
          <div className="w-px h-6 bg-slate-200" />
          <div>
            <span className="text-slate-400 block text-[10px] font-sans font-semibold">REMAINING MONEY</span>
            <span
              className={`font-bold text-sm ${remainingBudget < 0 ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}
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
        <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-[520px]">
          {/* Left Column (30-33%): Prompt Input Form, Live Rubric Feedback & Controls */}
          <div className="w-full lg:w-[32%] xl:w-[30%] bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs shrink-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-display font-bold text-sm text-slate-900">
                    Campaign Pitch Editor
                  </h3>
                </div>
                {evaluation && (
                  <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {evaluation.score}/100 pts
                  </span>
                )}
              </div>

              {/* Natural Language Prompt Field */}
              <div>
                <label className="text-[10px] font-mono uppercase font-bold text-slate-400 block mb-1">
                  Sponsor Pitch Description:
                </label>
                <textarea
                  rows={5}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Describe your robot, strengths, and pitch to prospective sponsors..."
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 leading-relaxed resize-none"
                />
              </div>

              {/* Rubric Criteria Evaluation Card (When Pitch is Evaluated) */}
              {evaluation ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span>Rubric Score Breakdown:</span>
                    <span className="text-emerald-700 font-mono">
                      {evaluation.tier.toUpperCase()} TIER (+${evaluation.fundingUsd})
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
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
                          className={`p-2 rounded-xl border text-[11px] ${
                            crit.passed
                              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                              : 'bg-amber-50/60 border-amber-200 text-amber-950'
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span>{crit.label}</span>
                            <div className="flex items-center gap-1.5 font-mono">
                              <span>
                                {crit.score}/{crit.maxScore}
                              </span>
                              <span>{crit.passed ? '✓' : '△'}</span>
                            </div>
                          </div>
                          {crit.hint && !crit.passed && (
                            <p className="text-[10px] text-amber-800 mt-0.5 leading-snug">
                              {crit.hint}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>

                  {/* Sponsor Feedback Quote */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-snug italic">
                    "{evaluation.sponsorFeedback}"
                  </div>
                </div>
              ) : (
                /* Goal Guidance & Tier Reference (When not yet evaluated) */
                <div className="space-y-2.5">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px]">
                      <HelpCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Pitch Scoring Rubric:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-slate-500 font-sans">
                      <li>Robot identity & combat persona</li>
                      <li>Engineering strengths & stats</li>
                      <li>Value proposition for sponsor</li>
                      <li>Clear direct call-to-action</li>
                    </ul>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-mono space-y-1">
                    <span className="text-slate-400 font-sans font-bold block mb-0.5 uppercase tracking-wider text-[9px]">
                      Sponsorship Rewards:
                    </span>
                    <div className="flex justify-between text-amber-700">
                      <span>🥉 Bronze (40–64 pts)</span>
                      <strong className="font-bold">+$200</strong>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>🥈 Silver (65–84 pts)</span>
                      <strong className="font-bold">+$400</strong>
                    </div>
                    <div className="flex justify-between text-emerald-700">
                      <span>🥇 Gold (85–100 pts)</span>
                      <strong className="font-bold">+$700</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-200 flex flex-col gap-2 mt-3">
              <button
                type="button"
                onClick={handleGenerateAd}
                disabled={isGenerating || !promptText.trim()}
                className="cursor-pointer w-full py-2.5 px-4 rounded-xl font-display font-black text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                <Wand2 className="w-4 h-4" />
                <span>{isGenerating ? 'Evaluating Pitch...' : evaluation ? 'Re-Evaluate Pitch' : 'Pitch to Sponsors'}</span>
              </button>

              {evaluation && (
                <button
                  type="button"
                  onClick={handleAcceptSponsorship}
                  className="cursor-pointer w-full py-2 px-3 rounded-xl font-display font-bold text-xs uppercase bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all"
                >
                  Accept Offer (+${evaluation.fundingUsd})
                </button>
              )}
            </div>
          </div>

          {/* Right Column (68-70%): Procedural Marketing Poster Canvas */}
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center relative shadow-xs overflow-hidden">
            <CampaignPoster
              project={project}
              promptText={promptText}
              evaluation={evaluation}
              selectedTemplate={selectedTemplate}
              onSelectTemplate={(tmpl) => setSelectedTemplate(tmpl)}
              stats={{
                weaponEnergyJ: summary.stats.weaponEnergyJ,
                topSpeedMph: summary.stats.topSpeedMph,
                totalWeightLb: summary.totalWeightLb,
                frontArmorScore: summary.stats.frontArmorScore,
              }}
            />
          </div>
        </div>
      ) : (
        /* ==========================================
           TAB 2: PROCUREMENT & SHIPPING
           ========================================== */
        <div className="flex-1 my-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <h3 className="font-display font-bold text-sm text-slate-900 mb-3">Freight & Shipping Tier</h3>
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
                        ? 'bg-emerald-50 border-emerald-500 text-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="font-bold font-sans">{spec.name}</span>
                      <span className="text-emerald-700 font-bold">${spec.costUsd}</span>
                    </div>
                    <p className="text-xs text-slate-500">{spec.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div>
              <h3 className="font-display font-bold text-sm text-slate-900 mb-3">Pit Spare Parts Kit</h3>
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
                          ? 'bg-emerald-50 border-emerald-500 text-slate-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between text-xs font-mono mb-0.5">
                        <span className="font-bold font-sans">{spec.name}</span>
                        <span className="text-emerald-700 font-bold">${spec.costUsd}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{spec.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono flex justify-between">
              <span className="font-sans text-slate-500">Lead Time Status:</span>
              <span className={summary.leadTimeConflict ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}>
                {summary.maxLeadTimeDays} Days / {PROJECT_LEAD_SPECS.competitionDeadlineDays} Day Deadline
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sponsorship Result Modal with 5-Category Breakdown & Retry Loop */}
      {showResultModal && evaluation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start mb-3 pb-2 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-mono text-emerald-700 uppercase tracking-widest font-bold block">
                  Sponsorship Evaluation
                </span>
                <h3 className="font-display font-black text-xl text-slate-900">
                  {evaluation.tier === 'Gold'
                    ? '🥇 Gold Sponsorship Offer'
                    : evaluation.tier === 'Silver'
                    ? '🥈 Silver Sponsorship Offer'
                    : '🥉 Bronze Sponsorship Offer'}
                </h3>
              </div>
              <span className="text-sm font-mono font-bold text-amber-600">
                {evaluation.score} / 100 pts
              </span>
            </div>

            {/* Rubric Category Breakdown */}
            <div className="my-3 space-y-2 font-sans">
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
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-slate-800 font-semibold">{crit.label}</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-500">{crit.score} / {crit.maxScore} pts</span>
                        <span className={crit.passed ? 'text-emerald-600 font-bold' : 'text-amber-600'}>
                          {crit.passed ? '✓' : '△'}
                        </span>
                      </div>
                    </div>
                    {crit.hint && !crit.passed && (
                      <p className="text-[11px] text-amber-700 mt-0.5">{crit.hint}</p>
                    )}
                  </div>
                ))}
            </div>

            {/* Sponsor Feedback Quote */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 mb-4 leading-relaxed font-sans">
              <strong className="text-slate-900">Sponsor Feedback:</strong> "{evaluation.sponsorFeedback}"
            </div>

            {/* Funding Offer Callout */}
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs mb-5 font-sans">
              <span className="text-slate-700">Confirmed Team Funding:</span>
              <strong className="text-emerald-700 font-bold text-base font-mono">
                +${evaluation.fundingUsd}
              </strong>
            </div>

            {/* Action Buttons: Accept or Iterate */}
            <div className="flex justify-between gap-3 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={handleImproveCampaign}
                className="cursor-pointer px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
              >
                ← Edit & Try Again
              </button>

              <button
                type="button"
                onClick={handleAcceptSponsorship}
                className="cursor-pointer px-5 py-2.5 rounded-xl text-xs font-display font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all"
              >
                Accept Sponsorship (+${evaluation.fundingUsd})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
