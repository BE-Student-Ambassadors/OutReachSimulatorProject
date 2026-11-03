import { ABILITY_SPECS, WEAPON_SPECS } from '../data/heroCatalog'
import { BOSS_ATTACK_SPECS } from '../data/bossCatalog'
import { TILE_SIZE, TILE_SPECS } from '../data/arenaCatalog'
import type { ArenaLayout, BossConfig, HeroConfig, PlaytestResult, QaSettings } from '../types/project'
import { updateBossFsm } from './bossFsm'

export interface Projectile {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  damage: number
  owner: 'player' | 'boss'
  color: string
  distanceTraveled: number
  maxDistance: number
}

export interface FloatingText {
  id: string
  x: number
  y: number
  text: string
  color: string
  life: number
  maxLife: number
}

export interface Particle {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  color: string
  radius: number
  life: number
  maxLife: number
}

export interface CombatInputs {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  attack: boolean
  ability: boolean
}

export interface AttackTelegraph {
  shape: 'arc' | 'circle' | 'projectiles'
  x: number
  y: number
  angle: number
  radius: number
  progress: number // 0 to 1
}

export interface CombatSoundEvent {
  type:
    | 'slash'
    | 'blast'
    | 'hammer'
    | 'boss_windup'
    | 'boss_cleave'
    | 'boss_slam'
    | 'boss_fireball'
    | 'hit_player'
    | 'hit_boss'
    | 'dash'
    | 'shield'
    | 'heal'
    | 'hazard'
    | 'victory'
    | 'defeat'
}

export class CombatSimulation {
  readonly heroConfig: HeroConfig
  readonly bossConfig: BossConfig
  readonly arena: ArenaLayout
  readonly qaSettings?: QaSettings

  // Hero state
  heroX: number
  heroY: number
  heroVx = 0
  heroVy = 0
  heroRadius = 15
  heroHp: number
  heroFacingAngle = 0
  heroAttackCooldownTimer = 0
  heroAbilityCooldownTimer = 0
  heroAbilityActiveTimer = 0
  heroInvulnerableTimer = 0
  heroHitFlashTimer = 0
  heroShieldActive = false
  heroDashing = false

  // Boss state
  bossX: number
  bossY: number
  bossVx = 0
  bossVy = 0
  bossRadius = 26
  bossHp: number
  bossFacingAngle = Math.PI
  bossFsmState: import('../types/project').BossStateId = 'IDLE'
  bossFsmTimer = 0
  bossHitFlashTimer = 0
  bossTelegraph: AttackTelegraph | null = null
  bossIsVulnerable = false

  // Combat objects
  projectiles: Projectile[] = []
  floaters: FloatingText[] = []
  particles: Particle[] = []
  screenShake = 0

  // Telemetry
  battleTimeSeconds = 0
  heroDamageDealt = 0
  bossDamageDealt = 0
  hitsLanded = 0
  hitsReceived = 0
  attacksDodged = 0
  wasPlayerInTelegraph = false
  isGameOver = false
  winner: 'player' | 'boss' | null = null

  // Audio queue
  soundEvents: CombatSoundEvent[] = []

  // Hazard tick timer
  private hazardTickTimer = 0
  private nextId = 1

  constructor(hero: HeroConfig, boss: BossConfig, arena: ArenaLayout, qaSettings?: QaSettings) {
    this.heroConfig = hero
    this.bossConfig = boss
    this.arena = arena
    this.qaSettings = qaSettings

    const playerCol = arena?.playerSpawn?.col ?? 3
    const playerRow = arena?.playerSpawn?.row ?? 6
    this.heroX = (playerCol + 0.5) * TILE_SIZE
    this.heroY = (playerRow + 0.5) * TILE_SIZE
    this.heroHp = hero?.maxHealth ?? 120

    const bossCol = arena?.bossSpawn?.col ?? 12
    const bossRow = arena?.bossSpawn?.row ?? 6
    this.bossX = (bossCol + 0.5) * TILE_SIZE
    this.bossY = (bossRow + 0.5) * TILE_SIZE
    this.bossHp = boss?.maxHealth ?? 260
  }

  update(dt: number, inputs: CombatInputs) {
    if (this.isGameOver) return

    // Cap delta time to prevent tunneling during lag spikes
    const clampedDt = Math.min(0.05, dt)
    this.battleTimeSeconds += clampedDt

    // Decay screen shake & timers
    this.screenShake = Math.max(0, this.screenShake - clampedDt * 20)
    this.heroAttackCooldownTimer = Math.max(0, this.heroAttackCooldownTimer - clampedDt)
    this.heroAbilityCooldownTimer = Math.max(0, this.heroAbilityCooldownTimer - clampedDt)
    this.heroInvulnerableTimer = Math.max(0, this.heroInvulnerableTimer - clampedDt)
    this.heroHitFlashTimer = Math.max(0, this.heroHitFlashTimer - clampedDt)
    this.bossHitFlashTimer = Math.max(0, this.bossHitFlashTimer - clampedDt)

    // Handle Hero Ability State
    this.updateHeroAbilities(clampedDt, inputs)

    // Handle Hero Movement
    this.updateHeroMovement(clampedDt, inputs)

    // Handle Hero Attacks
    this.updateHeroAttacks(inputs)

    // Handle Boss AI & State Machine
    this.updateBoss(clampedDt)

    // Handle Projectiles
    this.updateProjectiles(clampedDt)

    // Handle Environmental Hazards
    this.updateHazards(clampedDt)

    // Update Particles and Floating Combat Text
    this.updateEffects(clampedDt)

    // Check Win/Loss conditions
    this.checkGameConditions()
  }

  private updateHeroAbilities(dt: number, inputs: CombatInputs) {
    const abilitySpec = ABILITY_SPECS[this.heroConfig.ability]

    if (this.heroAbilityActiveTimer > 0) {
      this.heroAbilityActiveTimer -= dt
      if (this.heroAbilityActiveTimer <= 0) {
        this.heroShieldActive = false
        this.heroDashing = false
      }
    }

    if (inputs.ability && this.heroAbilityCooldownTimer <= 0) {
      this.heroAbilityCooldownTimer = abilitySpec.cooldownSeconds
      this.heroAbilityActiveTimer = abilitySpec.durationSeconds

      if (this.heroConfig.ability === 'dash') {
        this.heroDashing = true
        this.heroInvulnerableTimer = abilitySpec.durationSeconds + 0.05
        this.soundEvents.push({ type: 'dash' })
        this.spawnBurstParticles(this.heroX, this.heroY, '#c084fc', 12)
        this.addFloater(this.heroX, this.heroY - 20, 'DASH!', '#c084fc')
      } else if (this.heroConfig.ability === 'shield') {
        this.heroShieldActive = true
        this.soundEvents.push({ type: 'shield' })
        this.spawnBurstParticles(this.heroX, this.heroY, '#38bdf8', 16)
        this.addFloater(this.heroX, this.heroY - 20, 'BARRIER ACTIVE', '#38bdf8')
      } else if (this.heroConfig.ability === 'heal') {
        const healAmt = 35
        const actualHeal = Math.min(healAmt, this.heroConfig.maxHealth - this.heroHp)
        this.heroHp = Math.min(this.heroConfig.maxHealth, this.heroHp + healAmt)
        this.soundEvents.push({ type: 'heal' })
        this.spawnBurstParticles(this.heroX, this.heroY, '#10b981', 20)
        this.addFloater(this.heroX, this.heroY - 25, `+${actualHeal} HP`, '#10b981')
      }
    }
  }

  private updateHeroMovement(dt: number, inputs: CombatInputs) {
    let dx = 0
    let dy = 0
    if (inputs.left) dx -= 1
    if (inputs.right) dx += 1
    if (inputs.up) dy -= 1
    if (inputs.down) dy += 1

    const len = Math.hypot(dx, dy)
    let speed = this.heroConfig.moveSpeed

    if (this.heroDashing) {
      speed *= 3.5
    }

    if (len > 0) {
      const nx = dx / len
      const ny = dy / len
      this.heroFacingAngle = Math.atan2(ny, nx)
      this.heroVx = nx * speed
      this.heroVy = ny * speed
    } else {
      this.heroVx *= 0.6
      this.heroVy *= 0.6
    }

    // Collide with arena walls
    const nextX = this.heroX + this.heroVx * dt
    const nextY = this.heroY + this.heroVy * dt

    this.heroX = this.resolveWallCollision(this.heroX, nextX, this.heroY, this.heroRadius, 'x')
    this.heroY = this.resolveWallCollision(this.heroY, nextY, this.heroX, this.heroRadius, 'y')
  }

  private updateHeroAttacks(inputs: CombatInputs) {
    if (!inputs.attack || this.heroAttackCooldownTimer > 0) return

    const weaponSpec = WEAPON_SPECS[this.heroConfig.weapon]
    const baseCooldown = this.heroConfig.attackCooldown * weaponSpec.cooldownModifier
    this.heroAttackCooldownTimer = Math.max(0.2, baseCooldown)

    const baseDamage = Math.round(this.heroConfig.attackDamage * weaponSpec.damageMultiplier)

    if (this.heroConfig.weapon === 'sword') {
      this.soundEvents.push({ type: 'slash' })
      this.executeSwordAttack(baseDamage, weaponSpec.rangePx)
    } else if (this.heroConfig.weapon === 'blaster') {
      this.soundEvents.push({ type: 'blast' })
      this.executeBlasterAttack(baseDamage)
    } else if (this.heroConfig.weapon === 'hammer') {
      this.soundEvents.push({ type: 'hammer' })
      this.executeHammerAttack(baseDamage, weaponSpec.rangePx, weaponSpec.knockback)
    }
  }

  private executeSwordAttack(damage: number, defaultRange: number) {
    const range = this.heroConfig.attackReach || defaultRange
    const degrees = this.heroConfig.attackArcDegrees || 120
    const arcSpread = (degrees * Math.PI) / 180

    const dist = Math.hypot(this.bossX - this.heroX, this.bossY - this.heroY)
    const angleToBoss = Math.atan2(this.bossY - this.heroY, this.bossX - this.heroX)
    const offsetRad = ((this.heroConfig.attackOffsetAngle || 0) * Math.PI) / 180
    let diff = Math.abs(angleToBoss - (this.heroFacingAngle + offsetRad))
    while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI)

    // Hitbox check
    if (dist <= range + this.bossRadius && diff <= arcSpread / 2) {
      this.damageBoss(damage, 'BLADE SLASH')
    }

    // Spawn decorative blade slash particles
    const slashDist = range * 0.7
    const sx = this.heroX + Math.cos(this.heroFacingAngle) * slashDist
    const sy = this.heroY + Math.sin(this.heroFacingAngle) * slashDist
    this.spawnBurstParticles(sx, sy, '#06b6d4', 8)
  }

  private executeBlasterAttack(damage: number) {
    const projSpeed = 480
    const vx = Math.cos(this.heroFacingAngle) * projSpeed
    const vy = Math.sin(this.heroFacingAngle) * projSpeed

    this.projectiles.push({
      id: `proj-${this.nextId++}`,
      x: this.heroX + Math.cos(this.heroFacingAngle) * (this.heroRadius + 8),
      y: this.heroY + Math.sin(this.heroFacingAngle) * (this.heroRadius + 8),
      vx,
      vy,
      radius: 6,
      damage,
      owner: 'player',
      color: '#38bdf8',
      distanceTraveled: 0,
      maxDistance: 500,
    })
  }

  private executeHammerAttack(damage: number, defaultRange: number, knockback: number) {
    this.screenShake = 12

    const range = (this.heroConfig.attackReach || defaultRange) + 15
    const degrees = Math.min(180, (this.heroConfig.attackArcDegrees || 140) + 15)
    const arcSpread = (degrees * Math.PI) / 180

    const dist = Math.hypot(this.bossX - this.heroX, this.bossY - this.heroY)
    const angleToBoss = Math.atan2(this.bossY - this.heroY, this.bossX - this.heroX)
    const offsetRad = ((this.heroConfig.attackOffsetAngle || 0) * Math.PI) / 180
    let diff = Math.abs(angleToBoss - (this.heroFacingAngle + offsetRad))
    while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI)

    if (dist <= range + this.bossRadius && diff <= arcSpread / 2) {
      // Knockback boss
      const kx = Math.cos(angleToBoss) * knockback * 6
      const ky = Math.sin(angleToBoss) * knockback * 6
      this.bossX = this.resolveWallCollision(this.bossX, this.bossX + kx * 0.05, this.bossY, this.bossRadius, 'x')
      this.bossY = this.resolveWallCollision(this.bossY, this.bossY + ky * 0.05, this.bossX, this.bossRadius, 'y')

      this.damageBoss(damage, 'TITAN SLAM!')
    }

    // Ground shockwave particles
    const impactX = this.heroX + Math.cos(this.heroFacingAngle) * 35
    const impactY = this.heroY + Math.sin(this.heroFacingAngle) * 35
    this.spawnBurstParticles(impactX, impactY, '#f59e0b', 24)
  }

  private updateBoss(dt: number) {
    const distToHero = Math.hypot(this.heroX - this.bossX, this.heroY - this.bossY)
    const bossHpPct = (this.bossHp / this.bossConfig.maxHealth) * 100

    const prevFsmState = this.bossFsmState
    const fsmResult = updateBossFsm(
      this.bossFsmState,
      this.bossFsmTimer,
      dt,
      this.bossConfig.behavior,
      distToHero,
      bossHpPct,
    )

    this.bossIsVulnerable = fsmResult.isVulnerable

    if (fsmResult.resetTimer || fsmResult.nextState !== prevFsmState) {
      this.bossFsmTimer = 0
      this.bossFsmState = fsmResult.nextState

      if (this.bossFsmState === 'WINDUP') {
        this.soundEvents.push({ type: 'boss_windup' })
        // Check if player was initially inside the windup area
        this.wasPlayerInTelegraph = this.isPlayerInBossTelegraph()
      }
    } else {
      this.bossFsmTimer += dt
    }

    // Update Telegraph
    if (fsmResult.telegraphActive) {
      const attackSpec = BOSS_ATTACK_SPECS[this.bossConfig.behavior.attackType]
      this.bossTelegraph = {
        shape: attackSpec.shape,
        x: this.bossX,
        y: this.bossY,
        angle: this.bossFacingAngle,
        radius: attackSpec.hitboxRadius,
        progress: fsmResult.telegraphProgress,
      }
    } else {
      // If we just ended a windup and player dodged out of it
      if (prevFsmState === 'WINDUP' && this.wasPlayerInTelegraph) {
        const stillInTelegraph = this.isPlayerInBossTelegraph()
        if (!stillInTelegraph) {
          this.attacksDodged++
          this.addFloater(this.heroX, this.heroY - 20, 'DODGE!', '#eab308')
        }
      }
      this.bossTelegraph = null
    }

    // Update Boss Movement
    if (fsmResult.canMove) {
      const angle = Math.atan2(this.heroY - this.bossY, this.heroX - this.bossX)
      this.bossFacingAngle = angle

      let speed = this.bossConfig.behavior.chaseSpeed
      let moveAngle = angle

      if (fsmResult.moveDirection === 'away') {
        moveAngle = angle + Math.PI // Run away
        speed *= 1.15
      } else if (fsmResult.moveDirection === 'flank') {
        moveAngle = angle + Math.PI / 2 // Circle sideways
        speed *= 0.85
      }

      this.bossVx = Math.cos(moveAngle) * speed
      this.bossVy = Math.sin(moveAngle) * speed

      const nextX = this.bossX + this.bossVx * dt
      const nextY = this.bossY + this.bossVy * dt

      this.bossX = this.resolveWallCollision(this.bossX, nextX, this.bossY, this.bossRadius, 'x')
      this.bossY = this.resolveWallCollision(this.bossY, nextY, this.bossX, this.bossRadius, 'y')
    } else {
      this.bossVx = 0
      this.bossVy = 0
    }

    // Execute Boss Attack on trigger
    if (fsmResult.shouldFireAttack) {
      this.executeBossAttack()
    }
  }

  private isPlayerInBossTelegraph(): boolean {
    const attackSpec = BOSS_ATTACK_SPECS[this.bossConfig.behavior.attackType]
    const dist = Math.hypot(this.heroX - this.bossX, this.heroY - this.bossY)

    if (attackSpec.shape === 'circle') {
      return dist <= attackSpec.hitboxRadius + this.heroRadius
    }

    if (attackSpec.shape === 'arc') {
      const angleToHero = Math.atan2(this.heroY - this.bossY, this.heroX - this.bossX)
      let diff = Math.abs(angleToHero - this.bossFacingAngle)
      while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI)
      return dist <= attackSpec.hitboxRadius + this.heroRadius && diff <= (130 * Math.PI) / 180 / 2
    }

    return dist <= 120
  }

  private executeBossAttack() {
    const attackType = this.bossConfig.behavior.attackType
    const damage = this.bossConfig.attackDamage

    if (attackType === 'heavy_cleave') {
      this.soundEvents.push({ type: 'boss_cleave' })
      this.screenShake = 10
      if (this.isPlayerInBossTelegraph()) {
        this.damageHero(damage, 'BOSS CLEAVE')
      }
      this.spawnBurstParticles(
        this.bossX + Math.cos(this.bossFacingAngle) * 50,
        this.bossY + Math.sin(this.bossFacingAngle) * 50,
        '#ef4444',
        20,
      )
    } else if (attackType === 'slam_shockwave') {
      this.soundEvents.push({ type: 'boss_slam' })
      this.screenShake = 16
      if (this.isPlayerInBossTelegraph()) {
        this.damageHero(damage, 'EARTHQUAKE SLAM')
        // Push hero back
        const angle = Math.atan2(this.heroY - this.bossY, this.heroX - this.bossX)
        this.heroX = this.resolveWallCollision(this.heroX, this.heroX + Math.cos(angle) * 45, this.heroY, this.heroRadius, 'x')
        this.heroY = this.resolveWallCollision(this.heroY, this.heroY + Math.sin(angle) * 45, this.heroX, this.heroRadius, 'y')
      }
      this.spawnBurstParticles(this.bossX, this.bossY, '#f59e0b', 30)
    } else if (attackType === 'fireball_spray') {
      this.soundEvents.push({ type: 'boss_fireball' })
      const spreadAngles = [-0.25, 0, 0.25]
      for (const offset of spreadAngles) {
        const fireAngle = this.bossFacingAngle + offset
        this.projectiles.push({
          id: `boss-proj-${this.nextId++}`,
          x: this.bossX + Math.cos(fireAngle) * (this.bossRadius + 10),
          y: this.bossY + Math.sin(fireAngle) * (this.bossRadius + 10),
          vx: Math.cos(fireAngle) * 260,
          vy: Math.sin(fireAngle) * 260,
          radius: 9,
          damage: Math.round(damage * 0.75),
          owner: 'boss',
          color: '#ec4899',
          distanceTraveled: 0,
          maxDistance: 420,
        })
      }
    }
  }

  private updateProjectiles(dt: number) {
    const remaining: Projectile[] = []

    for (const p of this.projectiles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      const stepDist = Math.hypot(p.vx * dt, p.vy * dt)
      p.distanceTraveled += stepDist

      // Wall hit check
      const tileC = Math.floor(p.x / TILE_SIZE)
      const tileR = Math.floor(p.y / TILE_SIZE)
      const tile = this.arena.tiles[tileR]?.[tileC] ?? 'wall'

      if ((tile === 'wall' || tile === 'cover') && !(p.owner === 'boss' && this.qaSettings?.projectileWallRule === 'continue_moving')) {
        this.spawnBurstParticles(p.x, p.y, p.color, 6)
        continue // Destroyed
      }

      if (p.distanceTraveled >= p.maxDistance) {
        continue // Expired
      }

      // Hit unit check
      if (p.owner === 'player') {
        const distToBoss = Math.hypot(p.x - this.bossX, p.y - this.bossY)
        if (distToBoss <= p.radius + this.bossRadius) {
          this.damageBoss(p.damage, 'PULSE IMPACT')
          continue // Consumed
        }
      } else if (p.owner === 'boss') {
        const distToHero = Math.hypot(p.x - this.heroX, p.y - this.heroY)
        if (distToHero <= p.radius + this.heroRadius) {
          this.damageHero(p.damage, 'PLASMA FIRE')
          continue // Consumed
        }
      }

      remaining.push(p)
    }

    this.projectiles = remaining
  }

  private updateHazards(dt: number) {
    this.hazardTickTimer += dt
    if (this.hazardTickTimer < 0.5) return
    this.hazardTickTimer = 0

    // Check Hero in hazard
    const heroCol = Math.floor(this.heroX / TILE_SIZE)
    const heroRow = Math.floor(this.heroY / TILE_SIZE)
    if (this.arena.tiles[heroRow]?.[heroCol] === 'hazard') {
      this.soundEvents.push({ type: 'hazard' })
      this.damageHero(4, 'HAZARD')
      this.spawnBurstParticles(this.heroX, this.heroY, '#ef4444', 4)
    }

    // Check Boss in hazard
    const bossCol = Math.floor(this.bossX / TILE_SIZE)
    const bossRow = Math.floor(this.bossY / TILE_SIZE)
    if (this.arena.tiles[bossRow]?.[bossCol] === 'hazard') {
      this.damageBoss(4, 'HAZARD')
      this.spawnBurstParticles(this.bossX, this.bossY, '#ef4444', 4)
    }
  }

  private damageHero(amount: number, label: string) {
    if (this.heroInvulnerableTimer > 0) return

    let finalDamage = amount
    if (this.heroShieldActive) {
      finalDamage = Math.max(1, Math.round(amount * 0.25)) // 75% absorption
      this.addFloater(this.heroX, this.heroY - 15, `BLOCKED (-${finalDamage})`, '#38bdf8')
    } else {
      this.addFloater(this.heroX, this.heroY - 15, `-${finalDamage} ${label}`, '#ef4444')
    }

    this.heroHp = Math.max(0, this.heroHp - finalDamage)
    this.bossDamageDealt += finalDamage
    this.hitsReceived++
    this.heroHitFlashTimer = 0.08
    this.heroInvulnerableTimer = 0.15
    this.soundEvents.push({ type: 'hit_player' })
  }

  damageBoss(amount: number, label?: string) {
    let finalDamage = amount
    // Extra vulnerability bonus during recovery state
    if (this.bossIsVulnerable) {
      finalDamage = Math.round(finalDamage * 1.35)
      this.addFloater(this.bossX, this.bossY - 25, `CRIT! -${finalDamage}`, '#fbbf24')
    } else {
      this.addFloater(this.bossX, this.bossY - 20, label ? `${label} -${finalDamage}` : `-${finalDamage}`, '#f8fafc')
    }

    this.bossHp = Math.max(0, this.bossHp - finalDamage)
    this.heroDamageDealt += finalDamage
    this.hitsLanded++
    this.bossHitFlashTimer = 0.08
    this.soundEvents.push({ type: 'hit_boss' })
    this.spawnBurstParticles(this.bossX, this.bossY, '#f59e0b', 8)
  }

  private resolveWallCollision(oldVal: number, newVal: number, otherAxis: number, radius: number, axis: 'x' | 'y'): number {
    const testX = axis === 'x' ? newVal : otherAxis
    const testY = axis === 'y' ? newVal : otherAxis

    const minC = Math.max(0, Math.floor((testX - radius) / TILE_SIZE))
    const maxC = Math.min(this.arena.cols - 1, Math.floor((testX + radius) / TILE_SIZE))
    const minR = Math.max(0, Math.floor((testY - radius) / TILE_SIZE))
    const maxR = Math.min(this.arena.rows - 1, Math.floor((testY + radius) / TILE_SIZE))

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const tile = this.arena.tiles[r]?.[c] ?? 'wall'
        const tileSpec = TILE_SPECS[tile]
        if (tileSpec.blocksMovement) {
          // AABB vs Circle
          const tileLeft = c * TILE_SIZE
          const tileRight = (c + 1) * TILE_SIZE
          const tileTop = r * TILE_SIZE
          const tileBottom = (r + 1) * TILE_SIZE

          const closestX = Math.max(tileLeft, Math.min(testX, tileRight))
          const closestY = Math.max(tileTop, Math.min(testY, tileBottom))

          const distX = testX - closestX
          const distY = testY - closestY
          const distSq = distX * distX + distY * distY

          if (distSq < radius * radius) {
            return oldVal // Block movement along this axis
          }
        }
      }
    }

    return newVal
  }

  private updateEffects(dt: number) {
    // Floaters
    this.floaters = this.floaters
      .map((f) => ({ ...f, y: f.y - 30 * dt, life: f.life - dt }))
      .filter((f) => f.life > 0)

    // Particles
    this.particles = this.particles
      .map((p) => ({
        ...p,
        x: p.x + p.vx * dt,
        y: p.y + p.vy * dt,
        vx: p.vx * 0.92,
        vy: p.vy * 0.92,
        life: p.life - dt,
      }))
      .filter((p) => p.life > 0)
  }

  private addFloater(x: number, y: number, text: string, color: string) {
    this.floaters.push({
      id: `float-${this.nextId++}`,
      x,
      y,
      text,
      color,
      life: 0.9,
      maxLife: 0.9,
    })
  }

  private spawnBurstParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 40 + Math.random() * 120
      this.particles.push({
        id: `part-${this.nextId++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        radius: 2 + Math.random() * 3,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
      })
    }
  }

  private checkGameConditions() {
    if (this.bossHp <= 0) {
      this.isGameOver = true
      this.winner = 'player'
      this.soundEvents.push({ type: 'victory' })
    } else if (this.heroHp <= 0) {
      this.isGameOver = true
      this.winner = 'boss'
      this.soundEvents.push({ type: 'defeat' })
    }
  }

  generateResult(attemptNumber: number): PlaytestResult {
    return {
      id: `run-${Date.now()}-${attemptNumber}`,
      attemptNumber,
      timestamp: Date.now(),
      winner: this.winner ?? 'boss',
      durationSeconds: Math.round(this.battleTimeSeconds * 10) / 10,
      heroDamageDealt: this.heroDamageDealt,
      bossDamageDealt: this.bossDamageDealt,
      hitsLanded: this.hitsLanded,
      hitsReceived: this.hitsReceived,
      attacksDodged: this.attacksDodged,
      heroRemainingHpPct: Math.round((Math.max(0, this.heroHp) / this.heroConfig.maxHealth) * 100),
      bossRemainingHpPct: Math.round((Math.max(0, this.bossHp) / this.bossConfig.maxHealth) * 100),
      heroWeapon: this.heroConfig.weapon,
      heroAbility: this.heroConfig.ability,
    }
  }
}
