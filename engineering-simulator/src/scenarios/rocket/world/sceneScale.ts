/** World feet → scene units. Altitude is squashed harder than ground distance so 10,000 ft fits. */
export const ALT_SCALE = 1 / 38
export const DIST_SCALE = 1 / 4.5
/** Launch tower x position in scene units. */
export const PAD_X = -28
/** Scene height of the rocket's center when it sits on the pad. */
export const PAD_Y = 6.2

/** Scene-space position of a world-feet point along the rocket's flight. */
export function rocketScenePos(ft: [number, number, number]): [number, number, number] {
  return [PAD_X + ft[0] * DIST_SCALE, Math.max(PAD_Y, ft[1] * ALT_SCALE + PAD_Y), ft[2] * DIST_SCALE]
}
