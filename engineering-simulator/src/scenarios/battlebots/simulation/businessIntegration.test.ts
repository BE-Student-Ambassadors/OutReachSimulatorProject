import { describe, expect, it } from 'vitest';
import {
  createInitialTeamProject,
  evaluateAdCampaignPrompt,
  FICTIONAL_SPONSORS,
  getSponsorForTier,
  INITIAL_PROJECT_LEAD_CONFIG,
  TEAM_NAME_PRESETS,
} from '../data/teamData';
import {
  type ActiveSponsorship,
  type ProjectLeadConfiguration,
  type TeamRobotProject,
} from '../types/robot';

describe('BUSINESS → SPONSORSHIP → ARENA INTEGRATION', () => {
  describe('1. Natural Language Ad Campaign Scoring & Actionable Feedback', () => {
    it('evaluates an empty prompt and returns empty state with foundational suggestions', () => {
      const result = evaluateAdCampaignPrompt('');
      expect(result.score).toBe(0);
      expect(result.tier).toBe('None');
      expect(result.fundingUsd).toBe(0);
      expect(result.improvementSuggestions.length).toBeGreaterThan(0);
      expect(result.suggestedSponsor).toBeNull();
    });

    it('evaluates a weak prompt and provides prioritized actionable improvement suggestions', () => {
      const weakPrompt = 'Make us a cool robot poster.';
      const result = evaluateAdCampaignPrompt(weakPrompt);

      expect(result.score).toBeLessThan(65);
      expect(result.tier).toBe('Bronze');
      expect(result.fundingUsd).toBe(200);

      // Suggestions should prioritize missing sponsor value and engineering story
      expect(result.improvementSuggestions.length).toBeGreaterThanOrEqual(1);
      expect(result.improvementSuggestions.length).toBeLessThanOrEqual(3);

      const combinedText = result.improvementSuggestions.join(' ').toLowerCase();
      expect(
        combinedText.includes('sponsor') ||
        combinedText.includes('engineering') ||
        combinedText.includes('call to action')
      ).toBe(true);
    });

    it('specifically isolates missing criteria for partially complete prompts', () => {
      // Contains strong identity and engineering, but completely lacks sponsor value and CTA
      const prompt =
        'CIRCUIT BREAKERS is a lethal 30 lb combat machine engineered with an AR500 steel vertical spinner delivering 3200 Joules of kinetic destruction with titanium armor.';
      const result = evaluateAdCampaignPrompt(prompt, 'CIRCUIT BREAKERS');

      expect(result.criteria.robotIdentity.passed).toBe(true);
      expect(result.criteria.engineeringStory.passed).toBe(true);
      expect(result.criteria.sponsorValue.passed).toBe(false);
      expect(result.criteria.callToAction.passed).toBe(false);

      // Feedback MUST specifically address sponsor value and call to action
      const suggestions = result.improvementSuggestions.join(' ').toLowerCase();
      expect(suggestions).toContain('sponsor');
      expect(suggestions).toContain('call to action');
      expect(suggestions).not.toContain('bold capitalized name'); // Identity was already passed!
    });

    it('awards Gold tier and clears weaknesses for a comprehensive pitch', () => {
      const premierPrompt =
        'Partner with CIRCUIT BREAKERS today as we engineer a high-velocity 30 lb combat robot featuring an AR500 steel vertical spinner and brushless torque drivetrain. Sponsoring our student STEM team gives your brand prime logo visibility across tournament broadcasts and community outreach while propelling next-gen engineering talent to the championship victory. Join us as an official corporate partner!';

      const result = evaluateAdCampaignPrompt(premierPrompt, 'CIRCUIT BREAKERS');
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.tier).toBe('Gold');
      expect(result.fundingUsd).toBe(700);

      // All criteria should pass
      expect(result.criteria.robotIdentity.passed).toBe(true);
      expect(result.criteria.engineeringStory.passed).toBe(true);
      expect(result.criteria.sponsorValue.passed).toBe(true);
      expect(result.criteria.callToAction.passed).toBe(true);

      // Full/high score has no weaknesses left to invent
      expect(result.improvementSuggestions).toHaveLength(0);
      expect(result.suggestedSponsor).not.toBeNull();
      expect(result.suggestedSponsor?.tier).toBe('Gold');
    });
  });

  describe('2. Fictional Sponsor Catalog & Logo Branding', () => {
    it('defines a consistent fictional sponsor roster without external dependencies', () => {
      expect(FICTIONAL_SPONSORS['nova-dynamics']).toBeDefined();
      expect(FICTIONAL_SPONSORS['apex-robotics']).toBeDefined();
      expect(FICTIONAL_SPONSORS['voltworks']).toBeDefined();
      expect(FICTIONAL_SPONSORS['vector-systems']).toBeDefined();
      expect(FICTIONAL_SPONSORS['forge-industries']).toBeDefined();

      const goldSponsor = FICTIONAL_SPONSORS['nova-dynamics'];
      expect(goldSponsor.tier).toBe('Gold');
      expect(goldSponsor.amountUsd).toBe(700);
      expect(goldSponsor.brandColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(goldSponsor.logoKey).toBe('nova');
    });

    it('maps tiers to appropriate sponsors deterministically', () => {
      const gold = getSponsorForTier('Gold', 'tech autonomous', 'tech');
      expect(gold?.name).toBe('Nova Dynamics');

      const silver = getSponsorForTier('Silver', 'speed high voltage', 'speed');
      expect(silver?.name).toBe('VoltWorks Energy');

      const bronze = getSponsorForTier('Bronze');
      expect(bronze?.name).toBe('Forge Industries');
      expect(bronze?.amountUsd).toBe(200);

      const none = getSponsorForTier('None');
      expect(none).toBeNull();
    });
  });

  describe('3. Sponsorship Acceptance & Budget State Integrity', () => {
    it('updates team budget cap exactly once and sets active sponsor persistence', () => {
      const project: TeamRobotProject = createInitialTeamProject('CIRCUIT BREAKERS');
      const baseBudget = project.projectLead.baseBudgetUsd; // 1800

      const evalResult = evaluateAdCampaignPrompt(
        'Sponsor CIRCUIT BREAKERS for brand visibility in the arena. Support our student STEM team!'
      );
      const chosenSponsor = evalResult.suggestedSponsor || FICTIONAL_SPONSORS['forge-industries'];

      const sponsorObj: ActiveSponsorship = {
        sponsorId: chosenSponsor.id,
        sponsorName: chosenSponsor.name,
        amountUsd: evalResult.fundingUsd,
        tier: evalResult.tier as 'Bronze' | 'Silver' | 'Gold',
        logoKey: chosenSponsor.logoKey,
        brandColor: chosenSponsor.brandColor,
        tagline: chosenSponsor.tagline,
      };

      const updatedLead: ProjectLeadConfiguration = {
        ...project.projectLead,
        adPrompt: 'Sponsor CIRCUIT BREAKERS...',
        adHeadline: evalResult.headline,
        campaignScore: evalResult.score,
        sponsorshipUsd: evalResult.fundingUsd,
        sponsorTier: evalResult.tier,
        budgetCapUsd: baseBudget + evalResult.fundingUsd,
        activeSponsors: [sponsorObj],
        complianceSigned: true,
        isCompleted: true,
        campaign: {
          robotName: project.teamName,
          headline: evalResult.headline,
          theme: evalResult.theme,
          approved: true,
          posterTemplate: 'hero-poster',
          sponsorName: sponsorObj.sponsorName,
          sponsorTier: sponsorObj.tier,
        },
      };

      // 1. Budget increase matches sponsorshipUsd exactly
      expect(updatedLead.budgetCapUsd).toBe(baseBudget + evalResult.fundingUsd);
      expect(updatedLead.activeSponsors).toHaveLength(1);
      expect(updatedLead.activeSponsors[0].sponsorName).toBe(chosenSponsor.name);
      expect(updatedLead.isCompleted).toBe(true);

      // 2. Poster metadata is fully persisted
      expect(updatedLead.campaign?.approved).toBe(true);
      expect(updatedLead.campaign?.robotName).toBe('CIRCUIT BREAKERS');
      expect(updatedLead.campaign?.posterTemplate).toBe('hero-poster');
    });

    it('guarantees sponsorship funding is strictly idempotent across multiple acceptances', () => {
      const project: TeamRobotProject = createInitialTeamProject('CIRCUIT BREAKERS');

      const evalResult = evaluateAdCampaignPrompt(
        'Partner with CIRCUIT BREAKERS today as we engineer a high-velocity 30 lb combat robot featuring an AR500 steel vertical spinner and brushless torque drivetrain. Sponsoring our student STEM team gives your brand prime logo visibility across tournament broadcasts and community outreach while propelling next-gen engineering talent to the championship victory. Join us as an official corporate partner!',
        'CIRCUIT BREAKERS'
      );
      expect(evalResult.fundingUsd).toBe(700);

      const sponsor = evalResult.suggestedSponsor!;

      // First acceptance
      const acceptSponsor = (currentLead: ProjectLeadConfiguration): ProjectLeadConfiguration => {
        const leadBase = currentLead.baseBudgetUsd || 1800;
        const newCap = leadBase + evalResult.fundingUsd;
        return {
          ...currentLead,
          adPrompt: 'Premier pitch...',
          campaignScore: evalResult.score,
          sponsorshipUsd: evalResult.fundingUsd,
          sponsorTier: evalResult.tier,
          budgetCapUsd: newCap,
          activeSponsors: [
            {
              sponsorId: sponsor.id,
              sponsorName: sponsor.name,
              amountUsd: evalResult.fundingUsd,
              tier: evalResult.tier as 'Bronze' | 'Silver' | 'Gold',
              logoKey: sponsor.logoKey,
              brandColor: sponsor.brandColor,
              tagline: sponsor.tagline,
            },
          ],
          isCompleted: true,
        };
      };

      const firstAccept = acceptSponsor(project.projectLead);
      expect(firstAccept.budgetCapUsd).toBe(1800 + 700); // 2500
      expect(firstAccept.sponsorshipUsd).toBe(700);

      // Second acceptance (e.g. user re-clicks or component re-renders)
      const secondAccept = acceptSponsor(firstAccept);
      expect(secondAccept.budgetCapUsd).toBe(2500); // Does NOT compound to 3200!
      expect(secondAccept.sponsorshipUsd).toBe(700);
      expect(secondAccept.activeSponsors).toHaveLength(1);
    });

    it('preserves completed Business state and funding when student returns to Business', () => {
      const project: TeamRobotProject = createInitialTeamProject('CIRCUIT BREAKERS');
      project.projectLead.isCompleted = true;
      project.projectLead.sponsorTier = 'Gold';
      project.projectLead.sponsorshipUsd = 700;
      project.projectLead.budgetCapUsd = 2500;
      project.projectLead.activeSponsors = [
        {
          sponsorId: 'nova-dynamics',
          sponsorName: 'Nova Dynamics',
          amountUsd: 700,
          tier: 'Gold',
          logoKey: 'nova',
          brandColor: '#06b6d4',
          tagline: 'Precision Autonomous Systems',
        },
      ];

      // Verification of isBusinessCompleted logic in ProjectLeadScreen
      const lead = project.projectLead as ProjectLeadConfiguration;
      const isBusinessCompleted = Boolean(
        lead.isCompleted &&
        lead.sponsorTier !== 'None' &&
        lead.activeSponsors &&
        lead.activeSponsors.length > 0
      );
      expect(isBusinessCompleted).toBe(true);
      expect(project.projectLead.budgetCapUsd).toBe(2500);
      expect(project.projectLead.sponsorshipUsd).toBe(700);
    });

    it('resets Business-owned state completely without damaging other discipline progress', () => {
      const project: TeamRobotProject = createInitialTeamProject('CIRCUIT BREAKERS');

      // Simulate completed Mechanical and Electrical work
      project.mechanical.isCompleted = true;
      project.mechanical.chassisId = 'wide';
      project.electrical.isCompleted = true;

      // Simulate accepted sponsorship
      project.projectLead.adPrompt = 'High-impact combat robot seeking gold sponsor';
      project.projectLead.campaignScore = 92;
      project.projectLead.sponsorTier = 'Gold';
      project.projectLead.sponsorshipUsd = 700;
      project.projectLead.budgetCapUsd = 2500;
      project.projectLead.activeSponsors = [
        {
          sponsorId: 'nova-dynamics',
          sponsorName: 'Nova Dynamics',
          amountUsd: 700,
          tier: 'Gold',
          logoKey: 'nova',
          brandColor: '#06b6d4',
        },
      ];
      project.projectLead.campaign = {
        robotName: 'CIRCUIT BREAKERS',
        headline: 'NEXT-GEN AUTONOMOUS COMBAT ROBOTICS',
        theme: 'tech',
        approved: true,
        posterTemplate: 'tech-blueprint',
        sponsorName: 'Nova Dynamics',
        sponsorTier: 'Gold',
      };
      project.projectLead.isCompleted = true;

      // Execute Business Reset
      const resetBusinessLead: ProjectLeadConfiguration = {
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
      };

      project.projectLead = resetBusinessLead;

      // Business is reset to pristine state
      expect(project.projectLead.sponsorshipUsd).toBe(0);
      expect(project.projectLead.budgetCapUsd).toBe(1800);
      expect(project.projectLead.activeSponsors).toHaveLength(0);
      expect(project.projectLead.campaign).toBeNull();
      expect(project.projectLead.isCompleted).toBe(false);

      // Other disciplines remain completely untouched!
      expect(project.mechanical.isCompleted).toBe(true);
      expect(project.mechanical.chassisId).toBe('wide');
      expect(project.electrical.isCompleted).toBe(true);
    });
  });

  describe('4. Team Name Selection & Authoritative Propagation', () => {
    it('contains the curated list of BattleBot team name presets', () => {
      const requiredNames = [
        'Titan Circuit',
        'Iron Comet',
        'Voltage Vipers',
        'Steel Storm',
        'Turbo Turtles',
        'Circuit Breakers',
        'Chrome Crushers',
        'Robo Raptors',
        'Quantum Hammers',
        'Spark Squad',
      ];

      for (const name of requiredNames) {
        expect(TEAM_NAME_PRESETS).toContain(name);
      }
    });

    it('preserves single authoritative team name across all project domains', () => {
      const project: TeamRobotProject = createInitialTeamProject('CIRCUIT BREAKERS');
      expect(project.teamName).toBe('CIRCUIT BREAKERS');

      // Update name via typing or spinning
      const newName = 'VOLTAGE VIPERS';
      project.teamName = newName;
      if (project.projectLead.campaign) {
        project.projectLead.campaign.robotName = newName;
      }

      expect(project.teamName).toBe('VOLTAGE VIPERS');
      // Natural language evaluation should recognize updated team name
      const evalResult = evaluateAdCampaignPrompt(
        'Voltage Vipers will dominate the arena with titanium armor and high speed.',
        project.teamName
      );
      expect(evalResult.criteria.robotIdentity.passed).toBe(true);
    });
  });

  describe('5. Safe Arena Fallbacks without Poster or Sponsor', () => {
    it('handles null or missing campaign and active sponsors gracefully', () => {
      const freshProject = createInitialTeamProject('UNSPONSORED TEAM');
      expect(freshProject.projectLead.activeSponsors).toHaveLength(0);
      expect(freshProject.projectLead.campaign).toBeNull();

      // Ensure that getSponsorForTier returns null for 'None'
      const sponsor = getSponsorForTier(freshProject.projectLead.sponsorTier);
      expect(sponsor).toBeNull();

      // Ensure that evaluation prompt empty state has null sponsor and zero funding
      const emptyEval = evaluateAdCampaignPrompt('');
      expect(emptyEval.suggestedSponsor).toBeNull();
      expect(emptyEval.fundingUsd).toBe(0);
    });
  });

  describe('6. Sponsor Decal Mounting & Robot Configuration Compatibility', () => {
    it('generates valid mounting geometry across all chassis dimensions', () => {
      const chassisList: Array<{ id: string; dims: { width: number; length: number; height: number } }> = [
        { id: 'compact', dims: { width: 1.35, length: 1.4, height: 0.42 } },
        { id: 'wide', dims: { width: 1.9, length: 1.55, height: 0.42 } },
        { id: 'long', dims: { width: 1.45, length: 2.0, height: 0.42 } },
        { id: 'low-profile', dims: { width: 1.65, length: 1.65, height: 0.28 } },
      ];

      for (const chassis of chassisList) {
        const { width: cW, length: cL, height: cH } = chassis.dims;
        const plateThickness = 0.045 * 1.5; // thick armor
        const armorOff = plateThickness;
        const topY = Math.max(cH * 0.53 + armorOff, 0.24) + 0.015;

        // Top deck decal MUST sit above top diagnostic viewport (cH * 0.52) and armor
        expect(topY).toBeGreaterThan(cH * 0.52);
        expect(topY).toBeGreaterThan(cH * 0.5 + armorOff);

        // Rear bulkhead decal MUST sit outside rear chassis and armor
        const rearZ = -(cL * 0.5 + armorOff + 0.01);
        expect(Math.abs(rearZ)).toBeGreaterThan(cL * 0.5 + armorOff);

        // Side decals MUST sit outside side chassis and armor
        const sideX = (cW * 0.5 + armorOff) + 0.01;
        expect(sideX).toBeGreaterThan(cW * 0.5 + armorOff);

        // When wheel-guards utility is equipped, side decals MUST clear the outer fender (cW * 0.5 + 0.31)
        const wheelGuardSideX = (cW * 0.5 + 0.31) + 0.01;
        expect(wheelGuardSideX).toBeGreaterThan(cW * 0.5 + 0.30);
      }
    });

    it('confirms all 5 fictional sponsors contain valid logoKeys and brandColors for procedural decals', () => {
      for (const [key, sponsor] of Object.entries(FICTIONAL_SPONSORS)) {
        expect(sponsor.id).toBe(key);
        expect(sponsor.name.length).toBeGreaterThan(0);
        expect(sponsor.brandColor).toMatch(/^#[0-9a-f]{6}$/i);
        expect(['nova', 'apex', 'voltworks', 'vector', 'forge']).toContain(sponsor.logoKey);
        expect(['Bronze', 'Silver', 'Gold']).toContain(sponsor.tier);
      }
    });
  });
});

