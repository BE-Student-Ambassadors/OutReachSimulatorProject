import { count, money } from '../../core/format'
import type { GuidePage } from '../../shared/ui/Guide'
import { CIRCUITS, LINES, REQUIRED, SEED_FUNDS } from './config'
import type { RocketRoleId } from './types'

/** Explains the system and the options. Never what to change to pass. */

const apogee = `${count(REQUIRED.targetApogeeFt)} ft (± ${REQUIRED.apogeeToleranceFt})`
const lead = (id: string) => LINES.find((l) => l.id === id)!

export const CHALLENGE_GUIDE: GuidePage = {
  title: 'Rocket Team: fly to a target height',
  lead: 'University rocketry clubs build hobby rockets and fly them to a set height at competitions. Your team builds one on almost no money: a tube with a motor, fins, a nose cone and a parachute, plus a small flight computer that lights the motor and pops out the parachute.',
  sections: [
    {
      heading: 'The mission (all three must pass)',
      terms: [
        { term: `Apogee ${apogee}`, meaning: 'Apogee is the highest point of the flight. Too low misses the target, and so does too high.' },
        { term: `Landing ≤ ${REQUIRED.maxLandingFps} ft/s`, meaning: 'How fast the rocket hits the ground. The parachute slows it so it can fly again.' },
        {
          term: 'Money',
          meaning: `The team starts with ${money(SEED_FUNDS)}. Parts spent must be no more than that plus what sponsors pay. Going over never stops anyone from buying; it only fails this requirement.`,
        },
      ],
    },
    {
      heading: 'A flight, step by step',
      steps: [
        'The flight computer runs its program and sends power to the igniter, which lights the motor.',
        'The motor burns and pushes the rocket up. It keeps climbing for a while after the motor stops.',
        'At the top (apogee) the rocket starts to fall. The altimeter tells the computer it’s falling.',
        'The computer fires the ejection charge, which pushes the parachute out of the tube.',
        'The rocket floats down under the parachute and lands.',
      ],
    },
    {
      heading: 'Four jobs, one rocket',
      body: ['The rocket only flies when all four jobs are done, and every job affects the others.'],
      terms: [
        { term: 'Electrical', meaning: 'Wires the circuit boards and the battery leads. Without them the motor never lights and the parachute never comes out.' },
        { term: 'Mechanical', meaning: 'Buys the parts and builds the rocket. The parts decide its weight, drag, thrust, how fast it can go before breaking, and how softly it lands.' },
        { term: 'Software', meaning: 'Fixes and tunes the flight program: how hard and how long the motor burns, and when the parachute opens.' },
        { term: 'Business', meaning: 'Wins sponsor deals. The money pays for every part.' },
      ],
    },
    {
      heading: 'How to play',
      steps: [
        'Pick your job with the Roles button. You can open every station to see what teammates are doing or to help out.',
        'Follow the checklist under the tabs. It ticks itself off as you go. Each station also has its own guide.',
        'Launch from the Launch Pad whenever you like. Every launch is a test flight that plays on the whole team’s screens, and everyone flies a camera drone to watch.',
        'Read what happened, change something, and launch again.',
      ],
      body: ['There’s no single right rocket. Cheap parts, premium parts and everything in between can pass.'],
    },
  ],
}

export const STATION_GUIDES: Record<RocketRoleId | 'launch', GuidePage> = {
  electrical: {
    title: 'Electrical: circuit boards and battery leads',
    lead: 'You wire the rocket’s electronics: two circuit boards (breadboards) and the two leads from the battery.',
    sections: [
      {
        heading: 'Why it matters',
        body: [
          'The flight computer is the rocket’s brain. Each circuit connects it to one part of the rocket, and a part with no circuit simply doesn’t work.',
          `One 9 V battery feeds everything, but the parts don’t want 9 V. The flight computer is rated ${lead('computer').lo}–${lead('computer').hi} V and the igniter ${lead('igniter').lo}–${lead('igniter').hi} V. Out of range, the computer never runs its program or the motor never lights.`,
        ],
      },
      {
        heading: 'Steps',
        steps: [
          'Open the electronics kit.',
          'Wire the flight computer board: draw a wire between the two matching pins of each circuit. Wires can’t cross, and a finished board uses every hole.',
          'Wire the sensor board the same way.',
          'For each battery lead: cut it somewhere along its length, crimp a connector onto both ends, splice in a resistor, and turn the dial while you watch the voltage.',
        ],
      },
      {
        heading: 'The circuits',
        terms: CIRCUITS.map((c) => ({ term: c.label, meaning: c.summary })),
      },
      {
        heading: 'What the words mean',
        terms: [
          { term: 'Breadboard', meaning: 'A board full of holes for building circuits without soldering.' },
          { term: 'Voltage (V)', meaning: 'The electrical “push”. Each part lists the range it’s rated for.' },
          { term: 'Current (A)', meaning: 'How much electricity flows. Each lead shows how much its part draws.' },
          { term: 'Resistor', meaning: 'Lowers the voltage by current × resistance (V = I × R). The dial sets R in ohms (Ω). The energy it removes becomes heat: P = I² × R.' },
          { term: 'Crimp', meaning: 'Squeezing a metal connector onto a bare wire end. A weak crimp adds resistance.' },
          { term: 'Moving stretch', meaning: 'Part of a lead that gets bumped, like the stretch past the arming switch. A weak crimp there can shake loose at liftoff.' },
          { term: 'AWG', meaning: 'Wire size. A smaller number means a thicker wire.' },
        ],
      },
    ],
  },

  mechanical: {
    title: 'Mechanical: buy the parts, build the rocket',
    lead: 'You shop for the rocket’s parts online and assemble them on the blueprint. Every part is a trade-off between price, weight and performance.',
    sections: [
      {
        heading: 'Why it matters',
        body: [
          'A rocket climbs when its motor pushes harder than gravity and the air push back. Heavier rockets need more thrust and fall faster. Every part also has limits: go faster than a part is rated for and it breaks.',
          'With only a little money, the cheapest part isn’t always enough, and the best part isn’t always affordable.',
        ],
      },
      {
        heading: 'Steps',
        steps: [
          'Open SurplusBay and buy one of each part: nose cone, body tube, fin set, motor and parachute. Listings show the condition (new, used, open box, handmade), the seller’s rating and the specs.',
          'Wait for the parcels. They arrive after a few seconds.',
          'Drag every part onto its slot on the blueprint, plus the shock cord and avionics bay that come in the kit.',
          'Keep an eye on the money: spent vs raised is at the top.',
        ],
      },
      {
        heading: 'The parts',
        terms: [
          { term: 'Nose cone', meaning: 'The pointed top. It helps the rocket cut through the air (less drag). Without one there’s a lot more drag.' },
          { term: 'Body tube', meaning: 'The main tube that everything fits in. It’s rated for a top speed; faster than that and it tears apart.' },
          { term: 'Fin set', meaning: 'Keeps the rocket pointing straight. Also rated for a top speed. Without fins the rocket tumbles, and a warped fin makes it corkscrew.' },
          { term: 'Motor', meaning: 'The engine. Its thrust pushes the rocket up, and it has a set amount of fuel.' },
          { term: 'Parachute', meaning: 'Slows the fall. Canopy size and the rocket’s weight set the landing speed. Each one has a rated opening speed; opening faster than that rips it.' },
          { term: 'Shock cord', meaning: 'Elastic cord that ties the parachute to the rocket. Without it the parachute flies off on its own.' },
          { term: 'Avionics bay', meaning: 'Holds the circuit boards and the flight computer.' },
        ],
      },
    ],
  },

  software: {
    title: 'Software: the flight program',
    lead: 'You program the flight computer. The program decides when the motor lights, how long it burns, and when the parachute comes out.',
    sections: [
      {
        heading: 'Why it matters',
        body: [
          'Nobody can steer a rocket once it leaves the pad. Everything it does in flight comes from the program you upload before launch.',
          'The program arrives with mistakes in it (typos and small slips), and a program with mistakes won’t run.',
        ],
      },
      {
        heading: 'Steps',
        steps: [
          'Drag the USB plug into the flight computer. A green light means it’s connected.',
          'Fix the program. The problems list points to each line that has a mistake.',
          'Tune the three flight numbers at the top of the program.',
          'Upload the program to the rocket. Changes only fly once they’re uploaded.',
        ],
      },
      {
        heading: 'The flight numbers',
        terms: [
          { term: 'throttle', meaning: 'Engine power, 0–100%. Lower throttle pushes less but makes the fuel last longer.' },
          { term: 'burn_time', meaning: 'Seconds the engine burns before it shuts off.' },
          { term: 'deploy_altitude', meaning: 'On the way down, the parachute opens once the rocket falls below this height (ft). The longer it falls, the faster it goes.' },
        ],
      },
      {
        heading: 'Reading the program',
        terms: [
          { term: 'SET', meaning: 'Gives a name a value, e.g. SET throttle = 60.' },
          { term: 'ON launch: … END', meaning: 'The lines in between run when the rocket launches.' },
          { term: 'ON falling: … END', meaning: 'The lines in between run when the altimeter senses the rocket falling (it needs the altimeter circuit).' },
          { term: 'IGNITE / CUTOFF', meaning: 'Light the motor / shut it off.' },
          { term: 'WAIT', meaning: 'Pause for a number of seconds, or WAIT UNTIL something is true.' },
          { term: 'DEPLOY parachute', meaning: 'Fire the ejection charge (it needs the ejection circuit and a parachute).' },
          { term: '// comment', meaning: 'Notes for people. The computer ignores everything after //.' },
        ],
      },
    ],
  },

  business: {
    title: 'Business: sponsors and flyers',
    lead: `You’re the team’s fundraiser. ${money(SEED_FUNDS)} doesn’t buy a whole rocket, so you make deals with sponsors and design a flyer for each one.`,
    sections: [
      {
        heading: 'Why it matters',
        body: [
          'Real rocketry clubs pay for parts with sponsorships: businesses give money and get their name on the rocket and the club’s flyers in return.',
          'Every part Mechanical buys comes out of the team’s money, shown at the top as spent vs raised.',
        ],
      },
      {
        heading: 'Steps',
        steps: [
          'Open a sponsor email to read their offer.',
          'Accept the offer, or counter once with a different amount.',
          'Once you have a deal, describe the flyer in words and generate it.',
          'Decorate it in the paint editor: brush, eraser, stickers and text.',
          'Send it in to get paid. Repeat with other sponsors.',
        ],
      },
      {
        heading: 'How sponsors work',
        terms: [
          { term: 'Opening offer', meaning: 'What the sponsor first proposes to pay for one flyer.' },
          { term: 'Counteroffer', meaning: 'Each sponsor has a hidden limit. Ask a little over it and they come back with a final offer; ask far over and they end the talks. One counter per sponsor.' },
          { term: 'Payout', meaning: 'When the flyer comes in, the sponsor pays between 50% and 150% of the deal, depending on how much care went into it (description detail, colors, brush strokes, stickers, text).' },
          { term: 'Flyer description', meaning: 'Colors, pictures, layouts (poster, banner, badge) and a headline in “quotes” all change the generated flyer.' },
        ],
      },
    ],
  },

  launch: {
    title: 'Launch Pad',
    lead: 'Every launch is a test flight. Launch whenever you like, as often as you like.',
    sections: [
      {
        heading: 'What happens',
        steps: [
          'Anyone presses Launch. A 6-second countdown plays on every teammate’s screen.',
          'Everyone flies their own camera drone to watch. Drones start on the ground around the pad.',
          'The flight plays faster than real time, so the rocket climbs away from the drones quickly.',
          'When it lands, the results list what happened: the height it reached, its landing speed, the money, and any events along the way.',
        ],
      },
      {
        heading: 'Drone controls',
        terms: [
          { term: 'W A S D', meaning: 'Move (relative to where the camera faces).' },
          { term: 'Hold Space', meaning: 'Lift. Let go and the drone falls and lands.' },
          { term: 'Shift', meaning: 'Boost.' },
          { term: 'Mouse / arrow keys', meaning: 'Turn and tilt the camera. Press Ctrl or Esc to free the cursor, Ctrl or click to lock it again.' },
          { term: 'C', meaning: 'Swap to the tracking camera.' },
          { term: 'R', meaning: 'Record the flight. Clips are saved on the Launch Pad.' },
          { term: 'Game controller', meaning: 'Left stick moves, right stick looks, A or left trigger lifts, right trigger boosts.' },
        ],
      },
    ],
  },
}
