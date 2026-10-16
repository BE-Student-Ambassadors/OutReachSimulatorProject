import type { PropertiesProps } from '../../core/scenario'
import { AIRFRAME_MATERIALS, CHUTE_SPECS, FIN_PROFILES, IMPULSE_CLASSES, NOSE_CONES, PAYLOAD_MOTORS } from './config'
import type { RocketObject } from './types'

export function RocketProperties({ object }: PropertiesProps<RocketObject>) {
  switch (object.kind) {
    case 'gyro': {
      const avg = Math.round((object.rollScore + object.pitchScore + object.yawScore) / 3)
      return (
        <div className="mt-2 space-y-1 font-mono text-xs text-ink/75">
          <div>Roll: {object.rollScore}% · Pitch: {object.pitchScore}% · Yaw: {object.yawScore}%</div>
          <div className="font-bold text-forest">Mean Calibration: {avg}%</div>
        </div>
      )
    }
    case 'payloadMotor': {
      const m = PAYLOAD_MOTORS[object.motorId]
      return (
        <div className="mt-2 space-y-1 font-mono text-xs text-ink/75">
          <div className="font-semibold text-ink">{m.name}</div>
          <div>Mass: {m.massKg} kg · Torque: {m.torqueNm} N·m</div>
        </div>
      )
    }
    case 'payloadTest': {
      const c = CHUTE_SPECS[object.chuteSize]
      return (
        <div className="mt-2 space-y-1 font-mono text-xs text-ink/75">
          <div>Drop Alt: {object.dropAltitudeFt} ft</div>
          <div>Chute Armed: {object.armedChuteAltFt} ft ({c.name})</div>
          <div>Wind Lead: {object.windLeadDeg}°</div>
        </div>
      )
    }
    case 'weightDist':
      return (
        <div className="mt-2 font-mono text-xs text-ink/75">
          Nose → Tail order: {object.bayOrder.length} bays configured
        </div>
      )
    case 'airframe': {
      const mat = AIRFRAME_MATERIALS[object.materialId]
      const nose = NOSE_CONES[object.noseConeId]
      const fin = FIN_PROFILES[object.finProfileId]
      return (
        <div className="mt-2 space-y-1 font-mono text-xs text-ink/75">
          <div>{mat.name}</div>
          <div>{nose.name} · {fin.name}</div>
        </div>
      )
    }
    case 'launchSetup': {
      const imp = IMPULSE_CLASSES[object.impulseId]
      return (
        <div className="mt-2 space-y-1 font-mono text-xs text-ink/75">
          <div>{imp.name}</div>
          <div>Rail: {object.railAngleDeg}° · Trim: +{object.ballastTrimKg} kg</div>
        </div>
      )
    }
    default:
      return null
  }
}
