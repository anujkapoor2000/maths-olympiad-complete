// Learning material catalog for the "Learn" tab — short explainer lessons a
// child can read before attempting questions on that topic. Each topic has
// a few sections (explanation + worked example) and a "key facts" recap.
//
// diagram (optional) names an illustration component rendered by App.jsx —
// see the DIAGRAMS map there. Keep this file pure data (no JSX) so content
// stays easy to scan and edit.

export const TOPICS = [
  {
    id: 'number-sequences',
    title: 'Number Sequences',
    icon: '🔢',
    category: 'Number',
    summary: 'Spot the pattern in a list of numbers and predict what comes next.',
    diagram: 'sequence',
    sections: [
      {
        heading: 'What is a sequence?',
        body: "A sequence is a list of numbers that follow a rule. Each number in the list is called a term. To carry on a sequence, work out the rule that turns one term into the next.",
      },
      {
        heading: 'Arithmetic sequences (add or subtract)',
        body: "In an arithmetic sequence, you add (or subtract) the same amount every time. That fixed amount is called the common difference.",
        example: {
          question: 'Find the next two terms of 3, 7, 11, 15, ...',
          working: [
            'Work out the difference between terms: 7−3=4, 11−7=4, 15−11=4.',
            'The common difference is +4.',
            'Next term: 15+4=19. Term after that: 19+4=23.',
          ],
          answer: '19, 23',
        },
      },
      {
        heading: 'Geometric sequences (multiply or divide)',
        body: "In a geometric sequence, you multiply (or divide) by the same amount every time. That fixed amount is called the common ratio.",
        example: {
          question: 'Find the next term of 2, 6, 18, 54, ...',
          working: [
            'Work out what each term is multiplied by: 6÷2=3, 18÷6=3, 54÷18=3.',
            'The common ratio is ×3.',
            'Next term: 54×3=162.',
          ],
          answer: '162',
        },
      },
      {
        heading: 'Special sequences worth knowing',
        body: "Some patterns come up again and again in maths, so it's worth learning to recognise them by sight.",
        example: {
          question: 'Square numbers: 1, 4, 9, 16, 25, ... (each term is n×n). Triangular numbers: 1, 3, 6, 10, 15, ... (each term adds one more than the last gap).',
          working: [
            'Square numbers: 1², 2², 3², 4², 5² = 1, 4, 9, 16, 25.',
            'Triangular numbers: the gaps between terms grow by 1 each time (+2, +3, +4, +5, ...).',
          ],
          answer: 'Recognise these patterns on sight — they save time in a paper.',
        },
      },
      {
        heading: 'Finding the nth term (arithmetic sequences)',
        body: "The nth term formula lets you jump straight to any position in the sequence without listing every term. For an arithmetic sequence: nth term = a + (n−1) × d, where a is the first term and d is the common difference.",
        example: {
          question: 'Find the 10th term of 3, 7, 11, 15, ...',
          working: [
            'First term a=3, common difference d=4.',
            'nth term = a + (n−1)×d = 3 + (n−1)×4.',
            'For n=10: 3 + 9×4 = 3 + 36 = 39.',
          ],
          answer: '39',
        },
      },
    ],
    keyFacts: [
      'Term-to-term rule: how you get from one term to the next (e.g. "add 4").',
      'Position-to-term rule (nth term): a formula that finds any term directly from its position.',
      'Always check the rule works for at least 3 consecutive terms before trusting it.',
    ],
  },

  {
    id: 'place-value',
    title: 'Place Value',
    icon: '🔟',
    category: 'Number',
    summary: 'What each digit in a number is really worth, and how to round numbers sensibly.',
    sections: [
      {
        heading: 'The value of a digit depends on its position',
        body: "The same digit means something different depending on where it sits in a number. In 4,752, the 7 is worth 700 (seven hundreds), not just 7.",
        example: {
          question: 'What is the value of the digit 4 in 2.746?',
          working: [
            'The digits after the decimal point are tenths, hundredths, thousandths, ...',
            '2.746 → 7 is tenths, 4 is hundredths, 6 is thousandths.',
            'The 4 is in the hundredths place: 4 × 0.01 = 0.04.',
          ],
          answer: '0.04',
        },
      },
      {
        heading: 'Rounding numbers',
        body: "To round to a given place, look at the digit just to the right of it. 5 or more rounds up; 4 or less rounds down (or stays the same).",
        example: {
          question: 'Round 47,382 to the nearest thousand.',
          working: [
            'The thousands digit is 7 (47,382).',
            'Look at the digit to its right — the hundreds digit, which is 3.',
            '3 is less than 5, so round down: 47,000.',
          ],
          answer: '47,000',
        },
      },
      {
        heading: 'Standard form for very large or very small numbers',
        body: "Standard form writes a number as A × 10ⁿ, where A is between 1 and 10. It's a compact way to write numbers that would otherwise have lots of zeros.",
        example: {
          question: 'Write 45,600,000 in standard form.',
          working: [
            'Move the decimal point until only one non-zero digit is in front of it: 4.56.',
            'Count how many places you moved it: 7 places.',
            'So 45,600,000 = 4.56 × 10⁷.',
          ],
          answer: '4.56 × 10⁷',
        },
      },
    ],
    keyFacts: [
      'Each place is 10× the value of the place to its right (…, hundreds, tens, units, tenths, hundredths, …).',
      '"5 or more, round up. 4 or less, let it rest."',
      'Standard form: A × 10ⁿ with 1 ≤ A < 10.',
    ],
  },

  {
    id: 'ratios',
    title: 'Ratios',
    icon: '⚖️',
    category: 'Number',
    summary: 'Comparing quantities and sharing amounts fairly using the "parts" method.',
    sections: [
      {
        heading: 'What is a ratio?',
        body: "A ratio compares two or more quantities. Writing 2:3 means 'for every 2 of the first thing, there are 3 of the second thing'. Ratios are simplified the same way fractions are — divide every number by their highest common factor.",
        example: {
          question: 'Simplify the ratio 18:24:30.',
          working: [
            'Find the highest common factor of 18, 24 and 30: it is 6.',
            'Divide every number by 6: 18÷6=3, 24÷6=4, 30÷6=5.',
          ],
          answer: '3:4:5',
        },
      },
      {
        heading: 'Sharing an amount in a given ratio',
        body: "The reliable way to share in a ratio: add up the parts, divide the total by that to find the value of 1 part, then multiply to find each share.",
        example: {
          question: 'Share £84 in the ratio 2:3:7.',
          working: [
            'Add the parts: 2+3+7=12 parts in total.',
            'Value of 1 part: £84÷12=£7.',
            'Shares: 2×£7=£14, 3×£7=£21, 7×£7=£49.',
          ],
          answer: '£14, £21, £49',
        },
      },
      {
        heading: 'Combining ratios',
        body: "If you know a:b and b:c, you can find a:b:c — scale both ratios so the value for b matches in each.",
        example: {
          question: 'a:b = 2:3 and b:c = 4:5. Find a:b:c.',
          working: [
            'Scale a:b so b=12: multiply by 4 → a:b = 8:12.',
            'Scale b:c so b=12: multiply by 3 → b:c = 12:15.',
            'Now both have b=12, so combine: a:b:c = 8:12:15.',
          ],
          answer: '8:12:15',
        },
      },
    ],
    keyFacts: [
      'Simplify a ratio by dividing every part by their highest common factor.',
      '"Parts" method: total parts → value of 1 part → value of each share.',
      'To combine two ratios, scale them so the shared quantity matches.',
    ],
  },

  {
    id: 'probability',
    title: 'Probability',
    icon: '🎲',
    category: 'Number',
    summary: 'How likely something is to happen, from impossible (0) to certain (1).',
    diagram: 'probability-scale',
    sections: [
      {
        heading: 'The probability scale',
        body: "Probability is measured from 0 (impossible) to 1 (certain). It can be written as a fraction, decimal or percentage. A probability of 1/2 (or 0.5, or 50%) means an event is just as likely to happen as not.",
      },
      {
        heading: 'Calculating a simple probability',
        body: "P(event) = number of favourable outcomes ÷ total number of possible outcomes.",
        example: {
          question: 'A bag has 3 green, 5 yellow and 2 red counters. What is the probability of picking red?',
          working: [
            'Total counters: 3+5+2=10.',
            'Favourable outcomes (red): 2.',
            'P(red) = 2/10 = 1/5.',
          ],
          answer: '1/5',
        },
      },
      {
        heading: 'Combined independent events',
        body: "For two independent events (one doesn't affect the other), multiply their probabilities together to find the probability of both happening.",
        example: {
          question: 'A die is rolled twice. What is the probability of rolling a 6 both times?',
          working: [
            'P(6 on one roll) = 1/6.',
            'The rolls are independent, so multiply: 1/6 × 1/6 = 1/36.',
          ],
          answer: '1/36',
        },
      },
      {
        heading: 'Without replacement',
        body: "If items are removed and not put back, the total (and sometimes the favourable count) changes for the next pick.",
        example: {
          question: 'A bag has 3 red and 4 blue balls. Two are drawn without replacement. Find P(both red).',
          working: [
            'P(1st is red) = 3/7.',
            'After removing one red, 2 red and 6 total remain: P(2nd is red) = 2/6.',
            'Multiply: 3/7 × 2/6 = 6/42 = 1/7.',
          ],
          answer: '1/7',
        },
      },
    ],
    keyFacts: [
      'All probabilities are between 0 (impossible) and 1 (certain).',
      'P(event) = favourable outcomes ÷ total outcomes.',
      'Independent events: multiply the probabilities.',
      '"Not happening": P(not A) = 1 − P(A).',
    ],
  },

  {
    id: 'algebra-basics',
    title: 'Algebra Basics',
    icon: '🧮',
    category: 'Algebra',
    summary: 'Using letters to stand for unknown numbers, and solving for them.',
    sections: [
      {
        heading: 'Expressions vs equations',
        body: "An expression (like 3x+5) has no equals sign and can't be 'solved' — only simplified. An equation (like 3x+5=20) has an equals sign, and you can solve it to find the value of the letter.",
      },
      {
        heading: 'Solving equations — the balance method',
        body: "Treat the equals sign like the middle of a set of scales: whatever you do to one side, you must do to the other, to keep it balanced.",
        example: {
          question: 'Solve: 5x − 4 = 2x + 11',
          working: [
            'Subtract 2x from both sides: 3x − 4 = 11.',
            'Add 4 to both sides: 3x = 15.',
            'Divide both sides by 3: x = 5.',
          ],
          answer: 'x = 5',
        },
      },
      {
        heading: 'Expanding brackets',
        body: "To expand brackets, multiply everything inside the brackets by the term outside.",
        example: {
          question: 'Expand: 3(2x − 5)',
          working: [
            '3 × 2x = 6x',
            '3 × (−5) = −15',
          ],
          answer: '6x − 15',
        },
      },
      {
        heading: 'Factorising quadratics',
        body: "To factorise x²+bx+c, find two numbers that multiply to give c and add to give b.",
        example: {
          question: 'Factorise: x² + 7x + 12',
          working: [
            'Find two numbers that multiply to 12 and add to 7: 3 and 4.',
            'Write as two brackets: (x+3)(x+4).',
          ],
          answer: '(x + 3)(x + 4)',
        },
      },
    ],
    keyFacts: [
      'Whatever you do to one side of an equation, do to the other side too.',
      'Expand brackets by multiplying every term inside by the term outside.',
      'To factorise x²+bx+c: find two numbers that multiply to c and add to b.',
    ],
  },

  {
    id: '2d-shapes',
    title: '2D Shapes',
    icon: '🔺',
    category: 'Geometry',
    summary: 'Naming flat shapes and knowing what makes each one special.',
    diagram: 'shapes-2d',
    sections: [
      {
        heading: 'Triangles',
        body: "Equilateral: all 3 sides and angles equal (each angle 60°). Isosceles: 2 sides and 2 angles equal. Scalene: no sides or angles equal. Right-angled: has one 90° angle. Every triangle's interior angles add up to 180°.",
      },
      {
        heading: 'Quadrilaterals (4-sided shapes)',
        body: "Square: 4 equal sides, 4 right angles. Rectangle: opposite sides equal, 4 right angles. Parallelogram: opposite sides equal and parallel, no right angles needed. Rhombus: 4 equal sides, opposite angles equal. Trapezium: exactly one pair of parallel sides. Every quadrilateral's interior angles add up to 360°.",
      },
      {
        heading: 'Polygon angle sums',
        body: "The interior angles of any polygon add up to (n−2)×180°, where n is the number of sides.",
        example: {
          question: "Find the sum of the interior angles of a hexagon (6 sides), and the size of each angle if it's regular.",
          working: [
            'Sum: (n−2)×180 = (6−2)×180 = 4×180 = 720°.',
            "For a regular hexagon, all 6 angles are equal: 720÷6=120° each.",
          ],
          answer: 'Sum 720°, each angle 120°',
        },
      },
      {
        heading: 'Circles',
        body: "Radius: distance from the centre to the edge. Diameter: distance right across the circle through the centre (2× the radius). Circumference: the distance around the outside, found using Circumference = π × diameter.",
      },
    ],
    keyFacts: [
      'Triangle angles always sum to 180°. Quadrilateral angles always sum to 360°.',
      'Any polygon: interior angle sum = (n−2)×180°.',
      'Diameter = 2 × radius. Circumference = π × diameter.',
    ],
  },

  {
    id: '3d-shapes',
    title: '3D Shapes',
    icon: '📦',
    category: 'Geometry',
    summary: 'Solid shapes with faces, edges and vertices — and how to count them.',
    diagram: 'shapes-3d',
    sections: [
      {
        heading: 'Faces, edges and vertices',
        body: "A face is a flat (or curved) surface. An edge is where two faces meet. A vertex (plural: vertices) is a corner point where edges meet. For any solid with flat faces, Euler's formula holds: Faces + Vertices − Edges = 2.",
        example: {
          question: 'A cube has 6 faces and 8 vertices. How many edges does it have?',
          working: [
            "Euler's formula: F + V − E = 2.",
            '6 + 8 − E = 2, so 14 − E = 2.',
            'E = 12.',
          ],
          answer: '12 edges',
        },
      },
      {
        heading: 'Common 3D shapes',
        body: "Cube: 6 square faces, all edges equal. Cuboid: 6 rectangular faces. Sphere: perfectly round, 1 curved surface, no edges or vertices. Cylinder: 2 circular faces + 1 curved surface. Cone: 1 circular face + 1 curved surface, meeting at a single vertex. Square-based pyramid: 1 square base + 4 triangular faces meeting at a point.",
      },
      {
        heading: 'Volume of a cuboid, cube and cylinder',
        body: "Volume of a cuboid = length × width × height. For a cube, that's just side³. Volume of a cylinder = π × radius² × height.",
        example: {
          question: 'Find the volume of a cylinder with radius 3cm and height 10cm, in terms of π.',
          working: [
            'Volume = π × r² × h.',
            'π × 3² × 10 = π × 9 × 10 = 90π cm³.',
          ],
          answer: '90π cm³',
        },
      },
    ],
    keyFacts: [
      "Euler's formula: Faces + Vertices − Edges = 2 (for solids with flat faces).",
      'A sphere has no edges and no vertices — just one curved surface.',
      'Volume of a cuboid = length × width × height.',
    ],
  },

  {
    id: 'pythagoras-theorem',
    title: "Pythagoras' Theorem",
    icon: '📐',
    category: 'Geometry',
    summary: 'Finding a missing side of a right-angled triangle.',
    diagram: 'pythagoras',
    sections: [
      {
        heading: 'The theorem',
        body: "For any right-angled triangle, a² + b² = c², where c is the hypotenuse (the longest side, always opposite the right angle) and a and b are the other two sides. It only works for right-angled triangles.",
      },
      {
        heading: 'Finding the hypotenuse',
        body: "If you know the two shorter sides, square them, add the results, then take the square root.",
        example: {
          question: 'A right-angled triangle has legs of 9cm and 12cm. Find the hypotenuse.',
          working: [
            'c² = a² + b² = 9² + 12² = 81 + 144 = 225.',
            'c = √225 = 15.',
          ],
          answer: '15cm',
        },
      },
      {
        heading: 'Finding a shorter side',
        body: "If you know the hypotenuse and one other side, rearrange to subtract instead of add: a² = c² − b².",
        example: {
          question: 'A ladder 17m long leans against a wall with its foot 8m from the wall. How high up the wall does it reach?',
          working: [
            'The ladder is the hypotenuse (17m), the ground distance is one leg (8m).',
            'height² = 17² − 8² = 289 − 64 = 225.',
            'height = √225 = 15.',
          ],
          answer: '15m',
        },
      },
    ],
    keyFacts: [
      'a² + b² = c² — only true for right-angled triangles.',
      'c is always the hypotenuse: the longest side, opposite the right angle.',
      'Finding the hypotenuse: add the squares. Finding a shorter side: subtract.',
    ],
  },

  {
    id: 'area-perimeter',
    title: 'Area & Perimeter',
    icon: '📏',
    category: 'Geometry',
    summary: 'The distance around a shape versus the space it covers.',
    sections: [
      {
        heading: "Perimeter: the distance around the outside",
        body: "Add up the lengths of all the sides. For a rectangle, Perimeter = 2 × (length + width).",
        example: {
          question: 'Find the perimeter of a rectangle with length 9cm and width 4cm.',
          working: ['Perimeter = 2 × (9+4) = 2 × 13 = 26cm.'],
          answer: '26cm',
        },
      },
      {
        heading: 'Area: the space a shape covers',
        body: "Rectangle: Area = length × width. Triangle: Area = ½ × base × height. Circle: Area = π × radius².",
        example: {
          question: 'Find the area of a triangle with base 10cm and height 6cm.',
          working: ['Area = ½ × base × height = ½ × 10 × 6 = 30cm².'],
          answer: '30cm²',
        },
      },
      {
        heading: 'Similar shapes: scaling area',
        body: "If two shapes are similar (same shape, different size) with sides in ratio a:b, then their areas are in ratio a²:b².",
        example: {
          question: 'Two similar triangles have sides in ratio 2:5. The smaller triangle has area 12cm². Find the larger area.',
          working: [
            'Area ratio = (side ratio)² = 2²:5² = 4:25.',
            'Larger area = 12 × (25/4) = 75cm².',
          ],
          answer: '75cm²',
        },
      },
    ],
    keyFacts: [
      'Perimeter is measured in a single unit of length (cm, m). Area is measured in square units (cm², m²).',
      'Rectangle area = length × width. Triangle area = ½ × base × height.',
      'Similar shapes: side ratio a:b gives area ratio a²:b².',
    ],
  },

  {
    id: 'percentages',
    title: 'Percentages',
    icon: '％',
    category: 'Number',
    summary: '"Per cent" means "out of 100" — how to find, increase, decrease and reverse them.',
    sections: [
      {
        heading: 'What percentages mean',
        body: "A percentage is just a fraction out of 100. 50% = 50/100 = 1/2 = 0.5. To convert a fraction or decimal to a percentage, multiply by 100.",
      },
      {
        heading: 'Finding a percentage of an amount',
        body: "Convert the percentage to a decimal (divide by 100), then multiply.",
        example: {
          question: 'Find 15% of £45.',
          working: ['15% = 0.15.', '0.15 × 45 = £6.75.'],
          answer: '£6.75',
        },
      },
      {
        heading: 'Percentage increase and decrease',
        body: "To increase by a percentage, multiply by (1 + the percentage as a decimal). To decrease, multiply by (1 − the percentage as a decimal).",
        example: {
          question: 'Tyger jumps 20% further than Newton. Newton jumps 400cm. How far does Tyger jump?',
          working: ['Increase multiplier: 1 + 0.20 = 1.20.', '400 × 1.20 = 480cm.'],
          answer: '480cm',
        },
      },
      {
        heading: 'Reverse percentages (working backwards)',
        body: "If you're told the amount left AFTER a percentage change, and asked for the ORIGINAL amount, divide instead of multiplying.",
        example: {
          question: 'Sally spends 15% on food and 35% on rent, leaving £350. What was her budget?',
          working: [
            'Spent so far: 15%+35%=50%, so the remaining 50% is £350.',
            'Whole budget = 350 ÷ 0.5 = £700.',
          ],
          answer: '£700',
        },
      },
    ],
    keyFacts: [
      '"Per cent" = "out of 100". 50% = 1/2 = 0.5.',
      'Percentage of an amount: convert to a decimal, then multiply.',
      'Reverse percentage: divide by the decimal that the remaining amount represents.',
    ],
  },
];

export const TOPIC_MAP = Object.fromEntries(TOPICS.map(t => [t.id, t]));

export const TOPIC_CATEGORIES = [...new Set(TOPICS.map(t => t.category))];
