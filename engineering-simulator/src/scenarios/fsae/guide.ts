import { money } from '../../core/format'
import type { GuidePage } from '../../shared/ui/Guide'
import { CONE_PENALTY_S, POWER_PATH_BY_ID, REQUIRED, SEED_FUNDS } from './config'
import type { FsaeRoleId } from './types'

/** Explains the system and the options. Never what to change to pass. */

const motor = POWER_PATH_BY_ID.motor
const computer = POWER_PATH_BY_ID.computer

export const CHALLENGE_GUIDE: GuidePage = {
  title: 'Formula SAE: build and race a car',
  lead: 'Formula SAE is a real competition where university engineering students design, build and race their own small race car. At the event, judges put every car through tests. Your team has one car to get through them.',
  sections: [
    {
      heading: 'The car',
      body: [
        `It’s a small single-seat electric race car: about the size of a go-kart, but much faster. A ${motor.sourceV} V battery pack powers a motor that turns the rear wheels. A frame of welded steel tubes holds everything together. Wings on the front and back use the air rushing past to press the tires onto the road.`,
        'A small onboard computer and sensors let the car drive itself with nobody at the wheel. That’s a newer part of the competition, called driverless.',
      ],
    },
    {
      heading: 'What the judges measure (all four must pass)',
      terms: [
        {
          term: `Autocross lap ≤ ${REQUIRED.maxLapS} s`,
          meaning: 'A timed lap of a short, twisty course marked with cones, with a driver at the wheel. Lap time comes from grip in the corners, power on the straights, and weight.',
        },
        {
          term: `Driverless lap ≤ ${REQUIRED.maxDriverlessS} s, ≤ ${REQUIRED.maxConesHit} cones`,
          meaning: 'A lap with nobody driving. The sensors find the cones and the software picks a path between them. Yellow cones mark one edge of the course, orange cones the other.',
        },
        {
          term: 'Wiring inspection',
          meaning: 'Both main wires must deliver a voltage inside their part’s rated range during the lap, and every splice must be tied down so nothing rattles loose.',
        },
        {
          term: 'Car is paid for',
          meaning: `The school gives the team ${money(SEED_FUNDS)}. The finished car costs more than that, so sponsors have to cover the rest. The bar at the top shows Money (raised) vs Car (its cost so far).`,
        },
      ],
    },
    {
      heading: 'Four jobs, one car',
      body: ['Everyone works on the same car at the same time, and every job affects the others.'],
      terms: [
        { term: 'Mechanical', meaning: 'Welds the frame, chooses the wings and sets the car’s size. Mostly affects grip, speed and the autocross lap.' },
        { term: 'Electrical', meaning: 'Gets the right voltage to the motor and the driverless computer, and fits the sensors. Affects motor power, wiring inspection and the driverless lap.' },
        { term: 'Software', meaning: 'Programs the path planner that steers the car on the driverless lap.' },
        { term: 'Business', meaning: 'Wins sponsor deals to pay for the car. Every part anyone adds (wings, a bigger frame, sensors, connectors) adds to the bill.' },
      ],
    },
    {
      heading: 'How to play',
      steps: [
        'Open your job’s tab at the top. You can open the other tabs too, to see what teammates are doing or to help out.',
        'Work through the checklist under the tabs. It ticks itself off as you go. Each station also has its own guide.',
        'Any time you want to know where the car stands, open Test & Race Day and run a Competition Test. It checks all four requirements and lists what happened on the lap.',
        'Change things and test again. Every test teaches you something about the car.',
        'Once the car is built, everyone on the team drives it on Race Day.',
      ],
      body: ['There’s no single right car. Very different designs can pass all four tests.'],
    },
  ],
}

export const STATION_GUIDES: Record<FsaeRoleId | 'race', GuidePage> = {
  mechanical: {
    title: 'Mechanical: frame, wings and size',
    lead: 'You’re in charge of the car’s structure and how it uses the air. Your choices decide how much grip the car has in corners, how fast it goes on the straights, and part of what it costs.',
    sections: [
      {
        heading: 'Why it matters',
        body: [
          'In a corner, the only thing keeping a race car on the road is the grip between its tires and the ground. Tires grip harder when they’re pressed down harder. Wings press them down using the air (downforce), but pushing air around also holds the car back (drag).',
          'The frame matters too: a stiff, well-welded frame keeps all four tires working evenly. A weak frame flexes in corners and the tires lose grip.',
        ],
      },
      {
        heading: 'Steps',
        steps: [
          'Weld every frame joint. Click a glowing joint on the car to go to the welding bench. There you line up the two tubes, clamp them, weld the seam in one smooth stroke, then sand the weld flush. Each joint gets a strength score, and you can redo any joint.',
          'Choose a front wing design and set how far out the rear wing sits. Hover over a wing to preview it on the car.',
          'Set the car’s size: wheelbase, track width and ride height.',
          'Run the wind tunnel. It measures the forces on the car as it’s set up right now.',
        ],
      },
      {
        heading: 'What the words and options mean',
        terms: [
          { term: 'Downforce', meaning: 'Air pushing the car down onto the road. More downforce, more grip in corners.' },
          { term: 'Drag', meaning: 'Air pushing back against the car as it moves. More drag, slower on the straights.' },
          { term: 'Front wing design', meaning: 'More elements (stacked blades) turn the air harder: more downforce, but also more drag, weight and cost.' },
          { term: 'Rear wing slider', meaning: 'Further out catches more air: more downforce and more drag at the back of the car.' },
          {
            term: 'Balance (% on front axle)',
            meaning: 'How the downforce is split between the front and rear tires. Too little on the front: understeer (the car runs wide in corners). Too much: oversteer (the back slides out).',
          },
          { term: 'Wheelbase', meaning: 'Distance from the front axle to the rear axle. A short car turns in quicker in tight corners; a long one is steadier in fast ones.' },
          { term: 'Track width', meaning: 'Distance between the left and right wheels. Wider grips more in corners, but adds weight, drag and cost.' },
          { term: 'Ride height', meaning: 'Gap between the floor and the ground. A low floor sucks the car down (ground effect, extra downforce); too low and it scrapes over bumps.' },
          { term: 'Weld strength', meaning: 'Weak or missing welds let the frame flex, so the tires grip less.' },
          { term: 'Cost', meaning: 'Wings and extra tubing for a bigger car are added to the team’s bill.' },
        ],
      },
    ],
  },

  electrical: {
    title: 'Electrical: power, wiring and sensors',
    lead: 'You’re in charge of getting the right amount of electricity to each part, wiring it safely, and fitting the sensors the car uses to drive itself.',
    sections: [
      {
        heading: 'Why it matters',
        body: [
          `Every electrical part is built for a voltage range, and the batteries don’t match them. The drive motor is rated ${motor.lo}–${motor.hi} V, but ${motor.sourceV} V arrives from the main pack. The driverless computer is rated ${computer.lo}–${computer.hi} V, but its pack is ${computer.sourceV} V.`,
          'Too much voltage and the motor controller cuts power to protect the motor, or the computer overheats. Too little and the motor is weak, or the computer keeps restarting. Wiring inspection checks both wires during the lap.',
        ],
      },
      {
        heading: 'Steps for each wire (drive motor, then driverless computer)',
        steps: [
          'Click a glowing part on the car to zoom in to its wire.',
          'Cut the wire somewhere along it. Each stretch is tinted by what it runs past. Hover over the wire to read it.',
          'Crimp a connector onto both cut ends at the crimp bench: pick the die for the wire’s size, strip the right length of wire, and squeeze the handles through a full stroke.',
          'Splice a part into the wire (a resistor or a booster) and turn its dial.',
          'Watch the multimeter: it shows the voltage the part gets right now, and its rated range.',
          'Route and tie down the splice on the tie-down plate: connect each pair of pins without crossing wires, using every tie point.',
        ],
      },
      {
        heading: 'Then the self-driving sensors',
        steps: [
          'The LiDAR comes already mounted and wired. Choose a spot for the camera and one for the wheel-speed sensor (the dots on the car). Each spot lists its facts.',
          'Run both sensor cables to the computer on their own plate.',
        ],
      },
      {
        heading: 'What the words and options mean',
        terms: [
          { term: 'Voltage (V)', meaning: 'The electrical “push”. Each part lists the range it’s rated for.' },
          { term: 'Current (A)', meaning: 'How much electricity flows through the wire. Each wire shows how much its part draws.' },
          { term: 'Resistance (Ω, ohms)', meaning: 'How much something resists the flow. Voltage dropped = current × resistance (V = I × R).' },
          { term: 'Power resistor', meaning: 'Lowers the voltage by I × R. The dial sets R. The energy it removes becomes heat: P = I² × R.' },
          { term: 'Voltage booster', meaning: 'A small circuit board that raises the voltage. The dial sets how many volts it adds.' },
          { term: 'Crimp', meaning: 'Squeezing a metal connector onto a bare wire end. A weak crimp adds resistance, and a weak one in a moving stretch can shake loose on the lap.' },
          { term: 'Hot stretch', meaning: 'Runs past the motor or battery. Connectors there resist more.' },
          { term: 'Moving stretch', meaning: 'Runs past the suspension, steering or pedals, which shake and move during a lap.' },
          { term: 'Clear stretch', meaning: 'Nothing nearby, but the splice needs a bigger tie-down plate.' },
          { term: 'AWG', meaning: 'Wire size. A smaller number means a thicker wire.' },
          { term: 'LiDAR', meaning: 'A laser scanner that measures how far away the cones are.' },
          { term: 'Camera', meaning: 'Gives the computer a picture of the course. Spots differ in how far it sees at night and how much it shakes.' },
          { term: 'Wheel-speed sensor', meaning: 'Counts wheel turns so the car knows how far it has gone. The motor drives the rear wheels.' },
        ],
      },
    ],
  },

  software: {
    title: 'Software: the path planner',
    lead: 'You write the code that plans the car’s path when it drives itself. Here the planner is a graph: you write a math function, and the car follows its curve.',
    sections: [
      {
        heading: 'Why it matters',
        body: [
          'On the driverless lap nobody steers. The car’s computer has to pick its own path past the cones, and it can only drive paths its code knows how to plan.',
          'The three graph courses here train the planner. Each one you clear, in order (Easy, then Medium, then Hard), lets the planner drive a better line on the real driverless lap.',
        ],
      },
      {
        heading: 'Steps',
        steps: [
          'Look at the graph: the car is on the left, the gold target on the right, and brown obstacles sit in between.',
          'Build a function y = f(x). In the Function helper, add pieces and slide their numbers. Or switch to Type it yourself and write any function.',
          'Click Fire. The path draws itself from the car, left to right.',
          'Read what happened, change the function, and fire again. Your last few shots stay faint on the graph to compare.',
          'Clear Easy to unlock Medium, then Hard.',
        ],
      },
      {
        heading: 'What the words and pieces mean',
        terms: [
          { term: 'y = f(x)', meaning: 'For every x across the screen, the function gives a height y. The car drives along those heights from left to right.' },
          { term: 'Starts at the car', meaning: 'The whole curve slides up or down so it begins exactly where the car is.' },
          { term: 'Line  a·x', meaning: 'A straight slope. a sets how steep it is; a negative a goes down.' },
          { term: 'Parabola  a·(x − h)²', meaning: 'A U shape (upside down when a is negative). Its bottom sits at x = h; a sets how sharply it bends.' },
          { term: 'Wave  A·sin(B·x + C)', meaning: 'Up-and-down wiggles. A is how tall, B how close together, C slides the wave left or right.' },
          { term: 'Bump  A·e^(−((x − h)/w)²)', meaning: 'A single hill (or a dip when A is negative) centered at x = h. A is how tall, w how wide.' },
          { term: 'Adding pieces', meaning: 'The helper adds every piece together into one curve.' },
          { term: 'Typing it yourself', meaning: 'Use + − * / ^, parentheses, numbers like 2x, and sin, cos, tan, sqrt, abs, exp, ln, pi.' },
          { term: 'Why a path stops', meaning: 'It touches an obstacle, leaves the screen, or the function breaks (a jump, dividing by zero, the square root of a negative).' },
        ],
      },
    ],
  },

  business: {
    title: 'Business: sponsors and flyers',
    lead: `You’re the team’s fundraiser. The school’s ${money(SEED_FUNDS)} doesn’t cover the car, so you make deals with sponsors and design a flyer for each one.`,
    sections: [
      {
        heading: 'Why it matters',
        body: [
          'Real Formula SAE teams run like small companies. They pitch businesses for money and parts, and show the sponsors’ names on the car in return.',
          'Everything the engineers add (wings, a bigger frame, sensors, connectors) goes on the bill. The bar at the top shows Money (raised so far) and Car (what it costs right now). It turns red while the car costs more than the team has.',
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
          { term: 'Flyer description', meaning: 'Colors, pictures (race car, checkered flag, lightning, food…), layouts (poster, banner, badge) and a headline in “quotes” all change the generated flyer.' },
        ],
      },
    ],
  },

  race: {
    title: 'Test & Race Day',
    lead: 'This is where the judges measure the car, and then everyone on the team drives it.',
    sections: [
      {
        heading: 'Competition Test',
        body: [
          'Runs an autocross lap and a driverless lap with the car exactly as it is right now, then checks all four requirements. The test plays on every teammate’s screen.',
          'The results list what happened as facts: where the car was fastest and slowest, the forces from the wings, each wire’s voltage, how the driverless car did, and what the car cost.',
          'The Night Test has the same requirements on the floodlit course after dark.',
        ],
      },
      {
        heading: 'Race Day',
        steps: [
          'Anyone on the team presses Start a race heat (day or night).',
          'Every teammate’s screen counts down together, then each person drives the team’s car on their own laptop.',
          'Steer and drive with the arrow keys or W A S D.',
          `Each cone hit adds ${CONE_PENALTY_S} s to your time. Driving on the grass slows you down.`,
          'Teammates’ earlier laps race alongside you as ghost cars. Every heat has standings and a replay.',
        ],
        body: ['Race Day uses the car’s real numbers: its power, weight, grip, downforce and drag.'],
      },
      {
        heading: 'Words in the results',
        terms: [
          { term: 'Autocross', meaning: 'A timed lap of a short, twisty course marked by cones.' },
          { term: 'Driverless', meaning: 'The car drives itself using its sensors and its path planner.' },
          { term: 'DNF', meaning: 'Did not finish.' },
          { term: 'Understeer / oversteer', meaning: 'Front tires grip less than the rears (the car runs wide) / rear tires grip less than the fronts (the back slides out).' },
        ],
      },
    ],
  },
}
