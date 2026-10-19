import * as THREE from 'three'

/** Points that leave smoke this frame (rocket nozzle, the still-burning motor after a breakup). */
export interface SmokeEmitter {
  pos: THREE.Vector3
  active: boolean
  size: number
}
export interface SmokeEmitters {
  nozzle: SmokeEmitter
  motor: SmokeEmitter
}

export function makeEmitters(): SmokeEmitters {
  return {
    nozzle: { pos: new THREE.Vector3(), active: false, size: 1.0 },
    motor: { pos: new THREE.Vector3(), active: false, size: 0.55 },
  }
}
