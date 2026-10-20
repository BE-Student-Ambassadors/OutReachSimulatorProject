import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
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
  const [promptText, setPromptText] = useState(lead.adPrompt || '');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showRubricDetails, setShowRubricDetails] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PosterTemplate | undefined>(undefined);

  const [evaluation, setEvaluation] = useState<AdCampaignEvaluation | null>(() => {
    if (lead.campaignScore > 0 && lead.sponsorTier !== 'None' && lead.adPrompt) {
      return evaluateAdCampaignPrompt(lead.adPrompt);
    }
    return null;
  });

  const [isGenerating, setIsGenerating] = useState(false);

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
    }, 700);
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
  };

  const handleTryAgain = () => {
    soundEngine.playClick();
    setEvaluation(null);
  };

  const toggleComplete = () => {
    soundEngine.playClick();
    updateLead({ isCompleted: !lead.isCompleted });
  };

  return (
    <div className="relative w-full h-full bg-slate-50 text-slate-800 overflow-y-auto flex flex-col justify-between p-4 md:p-5 font-sans">
      {/* Optional Top Sub-Header (when not inside global shell) */}
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
                CREATE A SPONSOR AD
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
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

      {/* Primary Instruction & Sub-Tabs Bar */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-display font-black text-base text-slate-900 leading-tight">
              CREATE A SPONSOR AD
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Describe the advertisement you want.
            </p>
          </div>
          {lead.sponsorTier !== 'None' && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {lead.sponsorTier.toUpperCase()} SPONSOR (+${lead.sponsorshipUsd})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sub-tab switcher */}
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
              Logistics
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
        </div>
      </div>

      <ResetTaskModal
        isOpen={showResetModal}
        roleTitle="BUSINESS"
        description="This will clear your advertisement prompt, erase generated campaign results, remove earned sponsorship funding, and mark the Business task as incomplete. Other team tasks will not be changed."
        onConfirm={handleResetBusiness}
        onCancel={() => setShowResetModal(false)}
      />

      {/* Clean Funding Status Strip */}
      <div className="mb-3 p-3 bg-white border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-xs">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-slate-400 block text-[9px] font-sans font-semibold">LAB BUDGET</span>
            <span className="font-bold text-slate-800">${baseBudget.toLocaleString()}</span>
          </div>
          <span className="text-slate-300 font-sans">+</span>
          <div>
            <span className="text-slate-400 block text-[9px] font-sans font-semibold">SPONSORSHIP</span>
            <span className="font-bold text-emerald-600">
              +${currentSponsorship.toLocaleString()}{' '}
              {lead.sponsorTier !== 'None' ? `(${lead.sponsorTier})` : ''}
            </span>
          </div>
          <span className="text-slate-300 font-sans">=</span>
          <div>
            <span className="text-slate-400 block text-[9px] font-sans font-semibold">TOTAL AVAILABLE</span>
            <span className="font-bold text-slate-900">${totalAvailable.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div>
            <span className="text-slate-400 block text-[9px] font-sans font-semibold">PARTS COST</span>
            <span className="font-bold text-slate-800">${summary.totalCostUsd.toLocaleString()}</span>
          </div>
          <div className="w-px h-5 bg-slate-200" />
          <div>
            <span className="text-slate-400 block text-[9px] font-sans font-semibold">REMAINING MONEY</span>
            <span
              className={`font-bold text-sm ${remainingBudget < 0 ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}
            >
              ${remainingBudget.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {activeTab === 'create' ? (
        /* ============================================================
           TAB 1: CREATE A SPONSOR AD (Prompt + Large Poster Canvas)
           ============================================================ */
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-[520px]">
          {/* Left Column (~32%): Prompt Editor, Result Banner, Collapsible Rubric */}
          <div className="w-full lg:w-[32%] xl:w-[30%] bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs shrink-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-display font-bold text-sm text-slate-900">
                    Campaign Pitch
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRubricDetails(!showRubricDetails)}
                  className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-emerald-700 transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Rubric Details</span>
                  {showRubricDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Natural Language Prompt Box */}
              <div>
                <label className="text-[10px] font-mono uppercase font-bold text-slate-400 block mb-1">
                  Describe the advertisement you want:
                </label>
                <textarea
                  rows={4}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Describe your robot, combat strengths, and pitch to prospective sponsors..."
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 leading-relaxed resize-none"
                />
              </div>

              {/* Collapsible Rubric Breakdown */}
              {showRubricDetails && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2 animate-in fade-in">
                  <span className="font-bold text-slate-700 text-[11px] block">
                    Scoring Criteria (100 Points Total):
                  </span>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-slate-600">
                      <span>• Robot identity & combat persona</span>
                      <strong className="font-mono text-slate-700">20 pts</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>• Engineering story & key stats</span>
                      <strong className="font-mono text-slate-700">25 pts</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>• Sponsor business value proposition</span>
                      <strong className="font-mono text-slate-700">25 pts</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>• Call to action</span>
                      <strong className="font-mono text-slate-700">15 pts</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>• Creative tone & styling</span>
                      <strong className="font-mono text-slate-700">15 pts</strong>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 text-[10px] font-mono flex justify-between">
                    <span className="text-amber-700 font-bold">🥉 Bronze: +$200</span>
                    <span className="text-slate-700 font-bold">🥈 Silver: +$400</span>
                    <span className="text-emerald-700 font-bold">🥇 Gold: +$700</span>
                  </div>
                </div>
              )}

              {/* Result Banner when Ad is Generated */}
              {evaluation && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-800">
                      Campaign Score: {evaluation.score} / 100
                    </span>
                    <span className="font-mono text-xs font-black uppercase text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-300">
                      {evaluation.tier.toUpperCase()} SPONSOR +${evaluation.fundingUsd}
                    </span>
                  </div>

                  {/* Sponsor Quote */}
                  <p className="text-[11px] text-emerald-900/90 italic leading-snug">
                    "{evaluation.sponsorFeedback}"
                  </p>

                  {/* Immediate Action Buttons: TRY AGAIN or ACCEPT */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTryAgain}
                      className="cursor-pointer py-2 px-3 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 transition-colors text-center"
                    >
                      TRY AGAIN
                    </button>
                    <button
                      type="button"
                      onClick={handleAcceptSponsorship}
                      className="cursor-pointer py-2 px-3 rounded-xl text-xs font-display font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-xs transition-all text-center"
                    >
                      ACCEPT (+${evaluation.fundingUsd})
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Primary Generation Control */}
            <div className="pt-3 border-t border-slate-200 mt-3">
              <button
                type="button"
                onClick={handleGenerateAd}
                disabled={isGenerating || !promptText.trim()}
                className="cursor-pointer w-full py-2.5 px-4 rounded-xl font-display font-black text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                <Wand2 className="w-4 h-4" />
                <span>{isGenerating ? 'Generating Ad...' : 'GENERATE AD'}</span>
              </button>
            </div>
          </div>

          {/* Right Column (Dominant ~70%): Large Generated Marketing Advertisement */}
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
        /* ============================================================
           TAB 2: PROCUREMENT & SHIPPING
           ============================================================ */
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
    </div>
  );
};
