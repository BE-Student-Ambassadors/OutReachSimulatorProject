import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Megaphone,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Wand2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { soundEngine } from '../../audio/soundEngine';
import {
  evaluateAdCampaignPrompt,
  INITIAL_PROJECT_LEAD_CONFIG,
  PROJECT_LEAD_SPECS,
  TEAM_NAME_PRESETS,
  getSponsorForTier,
  FICTIONAL_SPONSORS,
  type AdCampaignEvaluation,
  type FictionalSponsor,
} from '../../data/teamData';
import { computeTeamEngineeringSummary } from '../../simulation/integrationValidator';
import {
  type ActiveSponsorship,
  type ProjectLeadConfiguration,
  type RobotConfiguration,
  type SponsorTier,
  type TeamRobotProject,
} from '../../types/robot';
import { ResetTaskModal } from './ResetTaskModal';
import { CampaignPoster, type PosterTemplate } from './business/CampaignPoster';
import { Robot3D } from '../three/Robot3D';

interface ProjectLeadScreenProps {
  project: TeamRobotProject;
  onUpdateProjectLead: (nextLead: ProjectLeadConfiguration) => void;
  onReturnToDashboard: () => void;
  onNavigateToIntegration?: () => void;
  onUpdateTeamName?: (nextTeamName: string) => void;
  hideHeader?: boolean;
}

interface CelebrationData {
  sponsor: FictionalSponsor;
  teamName: string;
  fundingAmount: number;
  oldBudget: number;
  newBudget: number;
  activeSponsorship: ActiveSponsorship;
}

export const ProjectLeadScreen: React.FC<ProjectLeadScreenProps> = ({
  project,
  onUpdateProjectLead,
  onReturnToDashboard,
  onNavigateToIntegration,
  onUpdateTeamName,
  hideHeader = false,
}) => {
  const lead = project.projectLead;
  const summary = computeTeamEngineeringSummary(project);

  const [activeTab, setActiveTab] = useState<'create' | 'procurement'>('create');
  const [promptText, setPromptText] = useState(lead.adPrompt || '');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showRubricDetails, setShowRubricDetails] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PosterTemplate | undefined>(
    lead.campaign?.posterTemplate
  );

  const [isSpinningName, setIsSpinningName] = useState(false);
  const [hasSpunName, setHasSpunName] = useState(false);
  const [celebrationData, setCelebrationData] = useState<CelebrationData | null>(null);

  const [evaluation, setEvaluation] = useState<AdCampaignEvaluation | null>(() => {
    if (lead.campaignScore > 0 && lead.sponsorTier !== 'None' && lead.adPrompt) {
      return evaluateAdCampaignPrompt(lead.adPrompt, project.teamName);
    }
    return null;
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const baseBudget = lead.baseBudgetUsd || 1800;
  const currentSponsorship = lead.sponsorshipUsd || 0;
  const totalAvailable = baseBudget + currentSponsorship;
  const remainingBudget = totalAvailable - summary.totalCostUsd;

  const isBusinessCompleted = Boolean(
    lead.isCompleted &&
    lead.sponsorTier !== 'None' &&
    ((lead.activeSponsors && lead.activeSponsors.length > 0) || lead.sponsorshipUsd > 0)
  );

  const activeSponsor: ActiveSponsorship | null = useMemo(() => {
    if (lead.activeSponsors && lead.activeSponsors.length > 0) {
      return lead.activeSponsors[0];
    }
    if (lead.sponsorTier && lead.sponsorTier !== 'None') {
      const fallback = getSponsorForTier(lead.sponsorTier);
      if (fallback) {
        return {
          sponsorId: fallback.id,
          sponsorName: fallback.name,
          amountUsd: fallback.amountUsd,
          tier: fallback.tier,
          logoKey: fallback.logoKey,
          brandColor: fallback.brandColor,
          tagline: fallback.tagline,
        };
      }
    }
    return null;
  }, [lead.activeSponsors, lead.sponsorTier]);

  const playerRobotConfig = useMemo<RobotConfiguration>(
    () => ({
      name: project.teamName || 'TITAN',
      chassisId: project.mechanical.chassisId,
      driveId: project.mechanical.driveId,
      wheelsId: project.mechanical.wheelsId,
      armorId: project.mechanical.armorId,
      armorThickness: project.mechanical.armorThickness,
      weaponId: project.mechanical.weaponId,
      utilityId: project.mechanical.utilityId,
      batteryId: project.electrical.batteryId,
      accentColor: project.mechanical.accentColor,
      customWeapon: null,
      customUtility: null,
    }),
    [project]
  );

  const otherDisciplinesComplete =
    project.mechanical.isCompleted &&
    project.electrical.isCompleted &&
    project.software.isCompleted;

  const updateLead = (updated: Partial<ProjectLeadConfiguration>) => {
    onUpdateProjectLead({ ...lead, ...updated });
  };

  const handleSpinName = () => {
    if (isSpinningName) return;
    setIsSpinningName(true);
    soundEngine.playClick();

    let count = 0;
    const maxTicks = 12;
    const interval = setInterval(() => {
      count++;
      const randomPick = TEAM_NAME_PRESETS[Math.floor(Math.random() * TEAM_NAME_PRESETS.length)];
      if (onUpdateTeamName) {
        onUpdateTeamName(randomPick);
      }
      soundEngine.playClick();

      if (count >= maxTicks) {
        clearInterval(interval);
        setIsSpinningName(false);
        setHasSpunName(true);
        soundEngine.playInstall();
      }
    }, 65);
  };

  const handleResetBusiness = () => {
    soundEngine.playInstall();
    setPromptText('');
    setEvaluation(null);
    setSelectedTemplate(undefined);
    setCelebrationData(null);
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
      const result = evaluateAdCampaignPrompt(promptText, project.teamName);
      setEvaluation(result);
    }, 700);
  };

  const handleAcceptSponsorship = () => {
    if (!evaluation) return;
    soundEngine.playInstall();

    const chosenSponsor =
      evaluation.suggestedSponsor ||
      getSponsorForTier(evaluation.tier, promptText, evaluation.theme) ||
      FICTIONAL_SPONSORS['forge-industries'];

    const sponsorObj: ActiveSponsorship = {
      sponsorId: chosenSponsor.id,
      sponsorName: chosenSponsor.name,
      amountUsd: evaluation.fundingUsd,
      tier: evaluation.tier as 'Bronze' | 'Silver' | 'Gold',
      logoKey: chosenSponsor.logoKey,
      brandColor: chosenSponsor.brandColor,
      tagline: chosenSponsor.tagline,
    };

    const newCap = baseBudget + evaluation.fundingUsd;

    // Launch celebratory sequence
    setCelebrationData({
      sponsor: chosenSponsor,
      teamName: project.teamName || 'CIRCUIT BREAKERS',
      fundingAmount: evaluation.fundingUsd,
      oldBudget: baseBudget,
      newBudget: newCap,
      activeSponsorship: sponsorObj,
    });

    updateLead({
      adPrompt: promptText,
      adHeadline: evaluation.headline,
      campaignScore: evaluation.score,
      sponsorshipUsd: evaluation.fundingUsd,
      sponsorTier: evaluation.tier as SponsorTier,
      budgetCapUsd: newCap,
      activeSponsors: [sponsorObj],
      complianceSigned: true,
      isCompleted: true,
      campaign: {
        robotName: project.teamName || 'CIRCUIT BREAKERS',
        headline: evaluation.headline,
        theme: evaluation.theme,
        approved: true,
        posterTemplate: selectedTemplate || 'hero-poster',
        sponsorName: sponsorObj.sponsorName,
        sponsorTier: sponsorObj.tier,
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
      {/* ============================================================
          CELEBRATION PAYOFF MODAL (2-4s / Interactive & Skippable)
          ============================================================ */}
      {celebrationData && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl p-6 md:p-8 shadow-2xl flex flex-col justify-between gap-6 relative overflow-hidden select-none">
            {/* Ambient Brand Glow */}
            <div
              className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl opacity-30 pointer-events-none"
              style={{ backgroundColor: celebrationData.sponsor.brandColor }}
            />
            <div
              className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ backgroundColor: '#10b981' }}
            />

            {/* Modal Top Header */}
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 border border-amber-400/40">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span>Sponsorship Accepted!</span>
                </div>
                <h2 className="font-display font-black text-2xl md:text-3xl text-white tracking-tight">
                  <span style={{ color: celebrationData.sponsor.brandColor }}>
                    {celebrationData.sponsor.name}
                  </span>{' '}
                  is sponsoring{' '}
                  <span className="text-white underline decoration-cyan-400">
                    {celebrationData.teamName}
                  </span>
                </h2>
              </div>
              <div className="px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                {celebrationData.sponsor.tier.toUpperCase()} TIER • +${celebrationData.fundingAmount}
              </div>
            </div>

            {/* Modal Body: Budget Counter & Robot Branding Payoff */}
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Left Column (5 Cols): Budget Increase & Sponsor Details */}
              <div className="md:col-span-5 space-y-4">
                {/* Budget Increase Card */}
                <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700/80 space-y-2">
                  <span className="text-[11px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                    Shared Team Budget Increase
                  </span>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-lg text-slate-400 line-through">
                      ${celebrationData.oldBudget.toLocaleString()}
                    </span>
                    <ArrowRight className="w-5 h-5 text-emerald-400 animate-pulse" />
                    <span className="text-3xl font-black text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]">
                      ${celebrationData.newBudget.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-sans">
                    +${celebrationData.fundingAmount} in funding has been committed directly to your team's hardware budget!
                  </p>
                </div>

                {/* Sponsor Dossier */}
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-3 rounded-full shrink-0"
                      style={{ backgroundColor: celebrationData.sponsor.brandColor }}
                    />
                    <span className="font-display font-bold text-sm text-white">
                      {celebrationData.sponsor.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 italic">
                    "{celebrationData.sponsor.tagline}"
                  </p>
                </div>

                {/* Confirmation Checklist */}
                <div className="space-y-1.5 text-xs text-slate-300 font-sans">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Sponsor logo decal attached to your robot</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Poster finalized for Tournament Arena signage</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Business discipline marked complete</span>
                  </div>
                </div>
              </div>

              {/* Right Column (7 Cols): 3D Robot Branding Visual */}
              <div className="md:col-span-7 h-[300px] sm:h-[340px] rounded-2xl bg-gradient-to-b from-slate-950 via-[#0a0f1d] to-slate-950 border border-slate-700/80 relative overflow-hidden flex flex-col justify-between p-3">
                <div className="relative z-10 flex justify-between items-center px-2 pt-1 pointer-events-none">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-800 px-2.5 py-0.5 rounded-full">
                    Sponsor Decal Applied
                  </span>
                  <span className="text-[10px] text-slate-400 font-sans">
                    Drag to rotate 360°
                  </span>
                </div>

                <div className="absolute inset-0 z-0">
                  <Canvas shadows camera={{ position: [2.2, 1.6, 2.4], fov: 40 }}>
                    <ambientLight intensity={1.2} />
                    <directionalLight position={[4, 6, 4]} intensity={2.0} castShadow />
                    <directionalLight position={[-3, 3, -2]} intensity={0.8} />

                    <group position={[0, -0.04, 0]}>
                      <mesh receiveShadow position={[0, -0.02, 0]}>
                        <cylinderGeometry args={[1.6, 1.7, 0.06, 32]} />
                        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
                      </mesh>
                    </group>

                    <Robot3D
                      config={playerRobotConfig}
                      wheelSpeedRad={0}
                      sponsor={celebrationData.activeSponsorship}
                    />

                    <OrbitControls
                      enablePan={false}
                      minDistance={1.6}
                      maxDistance={3.8}
                      autoRotate
                      autoRotateSpeed={1.5}
                    />
                  </Canvas>
                </div>

                <div className="relative z-10 text-center pointer-events-none pb-1">
                  <span className="text-[11px] font-mono text-slate-400">
                    Live Decal: {celebrationData.sponsor.name} on upper deck & side panels
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Bottom Action */}
            <div className="relative z-10 pt-4 border-t border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setCelebrationData(null);
                }}
                className="cursor-pointer px-6 py-2.5 rounded-xl font-display font-black text-xs uppercase tracking-wider text-slate-900 bg-emerald-400 hover:bg-emerald-300 shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2"
              >
                <span>Continue to Business Summary</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

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
                {isBusinessCompleted ? 'SPONSORSHIP FINALIZED' : 'CREATE A SPONSOR AD'}
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
              {isBusinessCompleted ? 'SPONSORSHIP FINALIZED' : 'CREATE A SPONSOR AD'}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {isBusinessCompleted
                ? 'Your campaign was accepted and sponsor funds are committed to your build.'
                : 'Describe the advertisement you want.'}
            </p>
          </div>
          {lead.sponsorTier !== 'None' && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {activeSponsor?.sponsorName.toUpperCase() || lead.sponsorTier.toUpperCase()} SPONSOR (+${lead.sponsorshipUsd})
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
        isBusinessCompleted ? (
          /* ============================================================
             COMPLETED BUSINESS WORKSPACE: SPONSOR, ROBOT & ARENA PAYOFF
             ============================================================ */
          <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-[520px]">
            {/* Left Column (~44%): Sponsor Summary, 3D Branded Robot, & Next Action */}
            <div className="w-full lg:w-[44%] xl:w-[42%] bg-white border border-slate-200 rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-xs shrink-0 gap-4">
              <div className="space-y-4">
                {/* 1. Official Sponsor Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white space-y-2 relative overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase font-bold text-cyan-400 tracking-wider">
                      Official Team Sponsor
                    </span>
                    <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                      {activeSponsor?.tier.toUpperCase()} TIER
                    </span>
                  </div>
                  <h3 className="font-display font-black text-2xl text-white tracking-tight">
                    {activeSponsor?.sponsorName}
                  </h3>
                  {activeSponsor?.tagline && (
                    <p className="text-xs text-slate-300 italic">
                      "{activeSponsor.tagline}"
                    </p>
                  )}
                  <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">FUNDING SECURED:</span>
                    <strong className="text-emerald-400 text-sm">
                      +${activeSponsor?.amountUsd.toLocaleString()}
                    </strong>
                  </div>
                </div>

                {/* 2. Robot Branding Payoff (3D View with Decal) */}
                <div className="rounded-2xl border border-slate-200 p-3 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-display font-bold text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Robot Branding: Sponsor Decal Applied</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Drag to inspect
                    </span>
                  </div>
                  <div className="h-44 w-full rounded-xl bg-slate-900 overflow-hidden relative shadow-inner">
                    <Canvas shadows camera={{ position: [2.1, 1.5, 2.3], fov: 40 }}>
                      <ambientLight intensity={1.2} />
                      <directionalLight position={[4, 6, 4]} intensity={2.0} castShadow />
                      <directionalLight position={[-3, 3, -2]} intensity={0.8} />

                      <group position={[0, -0.04, 0]}>
                        <mesh receiveShadow position={[0, -0.02, 0]}>
                          <cylinderGeometry args={[1.5, 1.6, 0.06, 32]} />
                          <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
                        </mesh>
                      </group>

                      <Robot3D
                        config={playerRobotConfig}
                        wheelSpeedRad={0}
                        sponsor={activeSponsor}
                      />

                      <OrbitControls
                        enablePan={false}
                        minDistance={1.6}
                        maxDistance={3.8}
                        autoRotate
                        autoRotateSpeed={1.2}
                      />
                    </Canvas>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Your sponsor decal is mounted to the upper deck and side armor of <strong className="text-slate-700 font-semibold">{project.teamName || 'your robot'}</strong> and will be visible in the Arena.
                  </p>
                </div>

                {/* 3. Discipline Progress Checklist */}
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5 font-mono">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-sans">
                    Team Discipline Status
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="font-sans text-slate-600">Mechanical:</span>
                      <strong className={project.mechanical.isCompleted ? 'text-emerald-600' : 'text-amber-600'}>
                        {project.mechanical.isCompleted ? '✓ Done' : 'In Progress'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="font-sans text-slate-600">Electrical:</span>
                      <strong className={project.electrical.isCompleted ? 'text-emerald-600' : 'text-amber-600'}>
                        {project.electrical.isCompleted ? '✓ Done' : 'In Progress'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="font-sans text-slate-600">Software:</span>
                      <strong className={project.software.isCompleted ? 'text-emerald-600' : 'text-amber-600'}>
                        {project.software.isCompleted ? '✓ Done' : 'In Progress'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                      <span className="font-sans text-emerald-700">Business:</span>
                      <strong className="text-emerald-700">✓ Complete</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clear Next Action Button */}
              <div className="pt-3 border-t border-slate-200">
                {otherDisciplinesComplete ? (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playInstall();
                      if (onNavigateToIntegration) {
                        onNavigateToIntegration();
                      } else {
                        onReturnToDashboard();
                      }
                    }}
                    className="cursor-pointer w-full py-3 px-4 rounded-xl font-display font-black text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Continue to System Integration</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onReturnToDashboard();
                    }}
                    className="cursor-pointer w-full py-2.5 px-4 rounded-xl font-display font-black text-xs uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-white shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <span>Return to Team Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Right Column (~56%): Finalized Poster View */}
            <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-between relative shadow-xs overflow-hidden gap-3">
              <div className="w-full flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h4 className="font-display font-bold text-xs uppercase tracking-wider text-slate-800">
                    Finalized Tournament Poster
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Scheduled for North Wall Billboard in the Tournament Arena
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Arena Signage Locked
                </span>
              </div>

              <div className="w-full flex-1 flex items-center justify-center">
                <CampaignPoster
                  project={project}
                  promptText={lead.adPrompt}
                  evaluation={evaluation}
                  selectedTemplate={lead.campaign?.posterTemplate || selectedTemplate}
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
          </div>
        ) : (
          /* ============================================================
             TAB 1: DRAFTING STUDIO (Prompt, Feedback & Large Poster Canvas)
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

                {/* Team Name Selector: Type or Spin */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                      Team Name (Authoritative)
                    </label>
                    <button
                      type="button"
                      onClick={handleSpinName}
                      disabled={isSpinningName}
                      className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                        isSpinningName
                          ? 'bg-amber-100 text-amber-800 animate-pulse'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs'
                      }`}
                    >
                      <Shuffle className={`w-3.5 h-3.5 ${isSpinningName ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
                      <span>{isSpinningName ? 'SPINNING...' : hasSpunName ? 'SPIN AGAIN' : 'SPIN FOR A NAME'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={project.teamName || ''}
                    onChange={(e) => onUpdateTeamName?.(e.target.value)}
                    placeholder="Type your team name..."
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 tracking-wide uppercase"
                  />
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
                        <strong className="font-mono text-slate-700">30 pts</strong>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>• Call to action</span>
                        <strong className="font-mono text-slate-700">15 pts</strong>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>• Creative tone & clarity</span>
                        <strong className="font-mono text-slate-700">10 pts</strong>
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

                    {/* Actionable Feedback Suggestions */}
                    {evaluation.score < 85 && evaluation.improvementSuggestions && evaluation.improvementSuggestions.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>WAYS TO STRENGTHEN YOUR POSTER</span>
                        </div>
                        <ul className="space-y-1 text-[11px] text-amber-900/90 leading-snug list-disc list-inside">
                          {evaluation.improvementSuggestions.map((suggestion, idx) => (
                            <li key={idx} className="pl-0.5">{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {evaluation.score >= 85 && (
                      <div className="p-2.5 rounded-xl bg-emerald-100/70 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Premier pitch! All engineering & sponsorship criteria fulfilled.</span>
                      </div>
                    )}

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
                        className="cursor-pointer py-2 px-3 rounded-xl text-xs font-display font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-xs transition-all text-center flex items-center justify-center gap-1"
                      >
                        <span>ACCEPT (+${evaluation.fundingUsd})</span>
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
        )
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
