import { describe, expect, it } from 'vitest';
import {
  createInitialTeamProject,
  DEFAULT_SIMPLIFIED_WIRES,
  DEFAULT_VALID_WIRES,
  PROJECT_LEAD_SPECS,
  SPONSORS_CATALOG,
  validateElectricalCircuit,
  validateSimplifiedElectrical,
  INITIAL_BOTCODE_SCRIPT,
  checkBotCodeBugs,
  evaluateAdCampaignPrompt,
} from '../data/teamData';
import {
  computeTeamEngineeringSummary,
  validateSystemIntegration,
} from './integrationValidator';
import { createBattleSimulation, stepBattleSimulation } from './battleEngine';
import type { WireConnection } from '../types/robot';

describe('Collaborative 4-Student BattleBot Incubator', () => {
  it('initializes a valid starting team project with all 4 disciplines', () => {
    const project = createInitialTeamProject('STUDENT TEAM DELTA');
    expect(project.teamName).toBe('STUDENT TEAM DELTA');
    expect(project.mechanical).toBeDefined();
    expect(project.electrical).toBeDefined();
    expect(project.software).toBeDefined();
    expect(project.projectLead).toBeDefined();
    expect(project.mechanical.isCompleted).toBe(false);
    expect(project.electrical.wiringVerified).toBe(false);
    expect(project.software.approach).toBe('charge');
    expect(project.projectLead.baseBudgetUsd).toBe(1800);
  });

  describe('Discipline 2: Electrical Interactive Wiring Harness', () => {
    it('rejects an empty wiring harness', () => {
      const result = validateElectricalCircuit([]);
      expect(result.valid).toBe(false);
      expect(result.observations.some((o) => o.includes('Wiring harness is empty'))).toBe(true);
    });

    it('validates a properly routed wiring harness', () => {
      const result = validateElectricalCircuit(DEFAULT_VALID_WIRES);
      expect(result.valid).toBe(true);
      expect(result.observations).toHaveLength(0);
      expect(result.passedChecks.length).toBeGreaterThan(5);
    });

    it('detects direct short circuit across battery rails', () => {
      const shortWires: WireConnection[] = [
        ...DEFAULT_VALID_WIRES,
        { id: 'short', fromPort: 'bat_pos', toPort: 'bat_neg' },
      ];
      const result = validateElectricalCircuit(shortWires);
      expect(result.valid).toBe(false);
      expect(result.observations.some((o) => o.includes('SHORT CIRCUIT'))).toBe(true);
    });

    it('detects overvoltage when battery is routed directly to 5V computer', () => {
      const overvoltageWires: WireConnection[] = [
        ...DEFAULT_VALID_WIRES.filter((w) => w.fromPort !== 'bec_out_5v_pos'),
        { id: 'ov', fromPort: 'bat_pos', toPort: 'comp_pwr_pos' },
      ];
      const result = validateElectricalCircuit(overvoltageWires);
      expect(result.valid).toBe(false);
      expect(result.observations.some((o) => o.includes('OVERVOLTAGE'))).toBe(true);
    });

    it('detects missing motor controller when motor is wired directly to battery bus', () => {
      const rawMotorWires: WireConnection[] = [
        ...DEFAULT_VALID_WIRES,
        { id: 'raw-motor', fromPort: 'bat_pos', toPort: 'mot_drive_in' },
      ];
      const result = validateElectricalCircuit(rawMotorWires);
      expect(result.valid).toBe(false);
      expect(result.observations.some((o) => o.includes('NO MOTOR CONTROLLER'))).toBe(true);
    });

    it('requires electrical wiring harness inspection before integration clearance', () => {
      const project = createInitialTeamProject();
      project.electrical.wiringVerified = false;

      const integration = validateSystemIntegration(project);
      expect(integration.electricalPassed).toBe(false);
      expect(integration.failures.some((f) => f.includes('safety inspection'))).toBe(true);
    });
  });

  describe('Cross-Discipline Tradeoffs & Constraints', () => {
    it('detects overweight when Mechanical adds thick steel armor with large battery', () => {
      const project = createInitialTeamProject();
      project.mechanical.armorId = 'steel';
      project.mechanical.armorThickness = 'thick';
      project.electrical.batteryId = 'large';

      const summary = computeTeamEngineeringSummary(project);
      expect(summary.totalWeightLb).toBeGreaterThan(30.0);
      expect(summary.isOverweight).toBe(true);

      const integration = validateSystemIntegration(project);
      expect(integration.mechanicalPassed).toBe(false);
      expect(integration.overallPassed).toBe(false);
      expect(integration.failures.some((f) => f.includes('overweight'))).toBe(true);
    });

    it('detects electrical overcurrent when Mechanical selects high-power spinner with small battery', () => {
      const project = createInitialTeamProject();
      project.mechanical.weaponId = 'vertical-spinner'; // 75A peak
      project.electrical.batteryId = 'small'; // 80A continuous
      project.electrical.currentLimiterA = 0; // Uncapped
      project.electrical.wiringVerified = true;

      const summary = computeTeamEngineeringSummary(project);
      expect(summary.isOverCurrent).toBe(true);

      const integration = validateSystemIntegration(project);
      expect(integration.electricalPassed).toBe(false);
      expect(integration.overallPassed).toBe(false);
      expect(integration.failures.some((f) => f.includes('continuous battery capability'))).toBe(true);
    });

    it('resolves overcurrent when Electrical applies a current limiter governor', () => {
      const project = createInitialTeamProject();
      project.mechanical.weaponId = 'vertical-spinner'; // 75A peak
      project.electrical.batteryId = 'medium'; // 115A continuous
      project.electrical.currentLimiterA = 100; // Capped at 100A

      const summary = computeTeamEngineeringSummary(project);
      expect(summary.effectivePeakDemandA).toBeLessThanOrEqual(100);
      expect(summary.isOverCurrent).toBe(false);
    });

    it('detects schedule conflict when Titanium armor is purchased with standard shipping', () => {
      const project = createInitialTeamProject();
      project.mechanical.armorId = 'titanium'; // 21 days lead time
      project.projectLead.shippingTier = 'standard'; // 0 days reduction

      const summary = computeTeamEngineeringSummary(project);
      expect(summary.maxLeadTimeDays).toBeGreaterThan(PROJECT_LEAD_SPECS.competitionDeadlineDays);
      expect(summary.leadTimeConflict).toBe(true);

      const integration = validateSystemIntegration(project);
      expect(integration.projectLeadPassed).toBe(false);
      expect(integration.failures.some((f) => f.includes('exceeds competition deadline'))).toBe(true);
    });

    it('resolves Titanium schedule conflict when Project Lead purchases expedited air freight', () => {
      const project = createInitialTeamProject();
      project.mechanical.armorId = 'titanium'; // 21 days lead time
      project.projectLead.shippingTier = 'expedited'; // Cuts 7 days -> 14 days!

      const summary = computeTeamEngineeringSummary(project);
      expect(summary.maxLeadTimeDays).toBeLessThanOrEqual(PROJECT_LEAD_SPECS.competitionDeadlineDays);
      expect(summary.leadTimeConflict).toBe(false);
    });

    it('detects budget overrun on base $1,800 budget and resolves when Business Lead secures sponsors', () => {
      const project = createInitialTeamProject();
      project.mechanical.armorId = 'titanium'; // $720
      project.mechanical.weaponId = 'vertical-spinner'; // $620
      project.electrical.batteryId = 'large'; // $280
      project.electrical.driveEscRatingA = 70; // $220
      project.electrical.weaponEscRatingA = 120; // $240
      project.projectLead.shippingTier = 'expedited'; // $160
      project.projectLead.sparePartsKit = 'full'; // $280

      const summaryBefore = computeTeamEngineeringSummary(project);
      expect(summaryBefore.totalCostUsd).toBeGreaterThan(project.projectLead.baseBudgetUsd);
      expect(summaryBefore.isOverBudget).toBe(true);

      // Business Lead pitches sponsors to expand the budget
      const mfChoice = SPONSORS_CATALOG.motionforge.choices[0];
      const titanChoice = SPONSORS_CATALOG.titanmaterials.choices[0];
      const blChoice = SPONSORS_CATALOG.batterylabs.choices[0];

      project.projectLead.activeSponsors = [
        { sponsorId: 'motionforge', sponsorName: 'MotionForge', amountUsd: mfChoice.offerUsd, tier: mfChoice.tier },
        { sponsorId: 'titanmaterials', sponsorName: 'Titan Materials', amountUsd: titanChoice.offerUsd, tier: titanChoice.tier },
        { sponsorId: 'batterylabs', sponsorName: 'BatteryLabs', amountUsd: blChoice.offerUsd, tier: blChoice.tier },
      ];
      project.projectLead.budgetCapUsd =
        project.projectLead.baseBudgetUsd +
        mfChoice.offerUsd +
        titanChoice.offerUsd +
        blChoice.offerUsd;

      const summaryAfter = computeTeamEngineeringSummary(project);
      expect(summaryAfter.totalCostUsd).toBeLessThanOrEqual(project.projectLead.budgetCapUsd);
      expect(summaryAfter.isOverBudget).toBe(false);
    });

    it('requires software virtual bench test before integration clearance', () => {
      const project = createInitialTeamProject();
      project.software.testPassed = false;

      const integration = validateSystemIntegration(project);
      expect(integration.softwarePassed).toBe(false);
      expect(integration.failures.some((f) => f.includes('Virtual Test Bench'))).toBe(true);
    });

    it('requires business lead inspection signoff before integration clearance', () => {
      const project = createInitialTeamProject();
      project.projectLead.complianceSigned = false;

      const integration = validateSystemIntegration(project);
      expect(integration.projectLeadPassed).toBe(false);
      expect(integration.failures.some((f) => f.includes('Technical Inspection'))).toBe(true);
    });
  });

  describe('Full System Integration Pass Scenario', () => {
    it('passes integration when all 4 disciplines coordinate a balanced, legal design', () => {
      const project = createInitialTeamProject('CHAMPIONSHIP SQUAD');

      // 1. Mechanical chooses balanced setup under 30 lb
      project.mechanical = {
        chassisId: 'compact',
        driveId: 'balanced',
        wheelsId: 'small',
        armorId: 'aluminum',
        armorThickness: 'medium',
        weaponId: 'wedge',
        utilityId: 'none',
        accentColor: '#22d3ee',
        isCompleted: true,
      };

      // 2. Electrical wires harness and sizes safe battery
      project.electrical = {
        batteryId: 'medium',
        driveEscRatingA: 50,
        weaponEscRatingA: 80,
        currentLimiterA: 120,
        coolingSystem: 'fan',
        wires: [...DEFAULT_VALID_WIRES],
        wiringVerified: true,
        isCompleted: true,
      };

      // 3. Software configures streamlined flowchart and passes test bench
      project.software = {
        computerConnected: true,
        bugsFixed: true,
        softwareUploaded: true,
        codeContent: '// BOTCODE OK',
        approach: 'careful',
        attack: 'line_up',
        recovery: 'reverse_turn',
        rules: [
          {
            id: 'r1',
            sensor: 'robot_tilt',
            conditionValue: 'flipped',
            action: 'recover_self_right',
            label: 'Self Right',
          },
          {
            id: 'r2',
            sensor: 'opponent_angle',
            conditionValue: 'front',
            action: 'full_charge',
            label: 'Charge Front',
          },
        ],
        sensorPackage: 'basic',
        isCompleted: true,
        testPassed: true,
      };

      // 4. Business Lead secures sponsors, stays within budget, and signs off
      project.projectLead = {
        baseBudgetUsd: 1800,
        budgetCapUsd: 2350,
        sponsorshipUsd: 550,
        sponsorTier: 'Gold',
        adPrompt: 'A formidable robot',
        adHeadline: 'Engineered for Ruthless Impact',
        campaignScore: 90,
        activeSponsors: [
          { sponsorId: 'motionforge', sponsorName: 'MotionForge', amountUsd: 550, tier: 'Gold' },
        ],
        campaign: {
          robotName: 'TITAN PRIME',
          headline: 'Engineered for Ruthless Impact',
          theme: 'aggressive',
          approved: true,
        },
        shippingTier: 'standard',
        sparePartsKit: 'drive',
        complianceSigned: true,
        isCompleted: true,
      };

      const integration = validateSystemIntegration(project);
      expect(integration.failures).toHaveLength(0);
      expect(integration.mechanicalPassed).toBe(true);
      expect(integration.electricalPassed).toBe(true);
      expect(integration.softwarePassed).toBe(true);
      expect(integration.projectLeadPassed).toBe(true);
      expect(integration.overallPassed).toBe(true);
    });
  });

  describe('Arena Combat Execution with Disciplines', () => {
    it('creates and steps battle simulation using student software rules against The Bull', () => {
      const project = createInitialTeamProject();
      const sim = createBattleSimulation(
        {
          name: 'STUDENT BOT',
          chassisId: 'compact',
          driveId: 'speed',
          wheelsId: 'small',
          armorId: 'aluminum',
          armorThickness: 'medium',
          weaponId: 'wedge',
          batteryId: 'medium',
          utilityId: 'none',
          accentColor: '#22d3ee',
        },
        'control',
        'bull',
        project.software.rules,
        project.electrical.currentLimiterA,
        15 // 15°C cooling bonus
      );

      expect(sim.bossId).toBe('bull');
      expect(sim.softwareRules).toHaveLength(4);
      expect(sim.electricalLimiterA).toBe(120);

      // Step simulation for 1 second of combat
      for (let i = 0; i < 30; i++) {
        stepBattleSimulation(sim, 0.033);
      }

      expect(sim.timeSec).toBeGreaterThan(0.9);
      expect(sim.player.aiStateLabel).toBeDefined();
    });
  });

  describe('Simplified Electrical Interactive Wiring Suite', () => {
    it('validates a complete simplified 5-stage wiring harness', () => {
      const result = validateSimplifiedElectrical(DEFAULT_SIMPLIFIED_WIRES);
      expect(result.valid).toBe(true);
      expect(result.batteryConnected).toBe(true);
      expect(result.mainPowerConnected).toBe(true);
      expect(result.drivePowered).toBe(true);
      expect(result.weaponPowered).toBe(true);
      expect(result.computerPowered).toBe(true);
      expect(result.observations).toHaveLength(0);
    });

    it('identifies unpowered stages in incomplete simplified harness', () => {
      // Missing computer connection and drive motor line
      const partialWires = DEFAULT_SIMPLIFIED_WIRES.filter(
        (w) => w.toPort !== 'comp_in' && w.toPort !== 'mot_drive_in'
      );
      const result = validateSimplifiedElectrical(partialWires);
      expect(result.valid).toBe(false);
      expect(result.computerPowered).toBe(false);
      expect(result.drivePowered).toBe(false);
      expect(result.batteryConnected).toBe(true);
      expect(result.observations.some((o) => o.includes('ROBOT COMPUTER HAS NO POWER'))).toBe(true);
      expect(result.observations.some((o) => o.includes('DRIVE SYSTEM HAS NO POWER'))).toBe(true);
    });
  });

  describe('Software BotCode Debugging & Upload Suite', () => {
    it('detects all 4 bugs in the initial BotCode script', () => {
      const bugStatus = checkBotCodeBugs(INITIAL_BOTCODE_SCRIPT);
      expect(bugStatus.remainingBugs).toHaveLength(4);
      expect(bugStatus.remainingBugs.map((b) => b.id).sort()).toEqual(['bug_deteced', 'bug_forwrd', 'bug_spni', 'bug_wepon']);
    });

    it('detects resolved bugs as the student corrects BotCode typos', () => {
      // Fix 'deteced' -> 'detected'
      let code = INITIAL_BOTCODE_SCRIPT.replace('deteced', 'detected');
      let bugStatus = checkBotCodeBugs(code);
      expect(bugStatus.remainingBugs).toHaveLength(3);
      expect(bugStatus.remainingBugs.some((b) => b.id === 'bug_deteced')).toBe(false);

      // Fix 'FORWRD' -> 'FORWARD'
      code = code.replace('FORWRD', 'FORWARD');
      bugStatus = checkBotCodeBugs(code);
      expect(bugStatus.remainingBugs).toHaveLength(2);

      // Fix 'wepon' -> 'weapon'
      code = code.replace('wepon', 'weapon');
      bugStatus = checkBotCodeBugs(code);
      expect(bugStatus.remainingBugs).toHaveLength(1);

      // Fix 'SPNI' -> 'SPIN'
      code = code.replace('SPNI', 'SPIN');
      bugStatus = checkBotCodeBugs(code);
      expect(bugStatus.remainingBugs).toHaveLength(0);
      expect(bugStatus.allFixed).toBe(true);
    });

    it('allows system integration clearance once BotCode is uploaded', () => {
      const project = createInitialTeamProject();
      project.software.computerConnected = true;
      project.software.bugsFixed = true;
      project.software.softwareUploaded = true;
      project.software.testPassed = true;

      const report = validateSystemIntegration(project);
      expect(report.softwarePassed).toBe(true);
    });
  });

  describe('Business Prompt-Based Ad & Sponsorship Suite', () => {
    it('evaluates minimal prompt and grants Bronze sponsorship', () => {
      const project = createInitialTeamProject();
      const evalResult = evaluateAdCampaignPrompt('A battlebot for the arena', project);
      expect(evalResult.score).toBeGreaterThanOrEqual(40);
      expect(evalResult.score).toBeLessThan(70);
      expect(evalResult.tier).toBe('Bronze');
      expect(evalResult.fundingUsd).toBe(200);
      expect(evalResult.criteria.robotIdentity).toBeDefined();
    });

    it('evaluates descriptive prompt and grants Silver or Gold sponsorship', () => {
      const project = createInitialTeamProject();
      const goldPrompt =
        'Create a futuristic, high-tech advertisement for our combat robot NIGHTFALL. Highlight our deadly vertical spinner weapon and advanced autonomous AI sensor technology. Sponsor our team as we dominate the arena and become champion!';
      const evalResult = evaluateAdCampaignPrompt(goldPrompt, project);
      expect(evalResult.score).toBeGreaterThanOrEqual(85);
      expect(evalResult.tier).toBe('Gold');
      expect(evalResult.fundingUsd).toBe(700);
      expect(evalResult.criteria.robotIdentity.passed).toBe(true);
      expect(evalResult.criteria.engineeringStory.passed).toBe(true);
      expect(evalResult.criteria.sponsorAppeal.passed).toBe(true);
      expect(evalResult.criteria.clearMessage.passed).toBe(true);
    });

    it('expands effective budget without duplicate sponsorship stacking', () => {
      const project = createInitialTeamProject();
      expect(project.projectLead.baseBudgetUsd).toBe(1800);
      expect(project.projectLead.sponsorshipUsd).toBe(0);

      // First evaluation: Bronze (+$200)
      const bronzeEval = evaluateAdCampaignPrompt('BattleBot robot show', project);
      project.projectLead.sponsorshipUsd = bronzeEval.fundingUsd;
      project.projectLead.sponsorTier = bronzeEval.tier;
      project.projectLead.budgetCapUsd = project.projectLead.baseBudgetUsd + project.projectLead.sponsorshipUsd;
      expect(computeTeamEngineeringSummary(project).effectiveBudgetUsd).toBe(2000);

      // Improving prompt replaces offer with Gold (+$700), does NOT stack to 200 + 700 = 900
      const goldEval = evaluateAdCampaignPrompt(
        'NIGHTFALL our autonomous vertical spinner robot. High-tech AI battlebot. Invest in our team today to win the championship!',
        project
      );
      project.projectLead.sponsorshipUsd = goldEval.fundingUsd;
      project.projectLead.sponsorTier = goldEval.tier;
      project.projectLead.budgetCapUsd = project.projectLead.baseBudgetUsd + project.projectLead.sponsorshipUsd;
      expect(computeTeamEngineeringSummary(project).effectiveBudgetUsd).toBe(2500);
    });
  });
});
