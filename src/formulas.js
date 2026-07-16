// Formula reference catalog — the key formula(s)/rules "to master" for each
// Learn topic (src/topics.js). Shown both on the standalone Formulas tab and
// as a quick-reference callout at the top of each Learn topic's lesson page.
// Every entry here should key to a real topic id in topics.js.

export const FORMULAS = {
  'number-sequences': [
    { name: 'nth term (arithmetic)', expression: 'nth term = a + (n − 1) × d', note: 'a = first term, d = common difference' },
  ],
  'place-value': [
    { name: 'Standard form', expression: 'A × 10ⁿ', note: '1 ≤ A < 10' },
  ],
  'negative-numbers': [
    { name: 'Multiplying / dividing', expression: 'same signs → +, different signs → −', note: '' },
  ],
  'prime-numbers': [
    { name: 'Prime factorisation', expression: 'n = p₁ × p₂ × p₃ × ...', note: 'every number > 1 is a unique product of primes' },
  ],
  'hcf-lcm': [
    { name: 'HCF × LCM', expression: 'HCF(a, b) × LCM(a, b) = a × b', note: 'for two numbers a and b' },
  ],
  'fractions-decimals': [
    { name: 'Multiplying fractions', expression: 'a/b × c/d = (a×c) / (b×d)', note: 'multiply straight across' },
    { name: 'Dividing fractions', expression: 'a/b ÷ c/d = a/b × d/c', note: 'flip the second fraction, then multiply' },
  ],
  percentages: [
    { name: 'Percentage of an amount', expression: 'amount × (percentage ÷ 100)', note: '' },
    { name: 'Increase / decrease', expression: 'amount × (1 ± percentage ÷ 100)', note: '+ to increase, − to decrease' },
  ],
  'algebra-basics': [
    { name: 'Factorising a quadratic', expression: 'x² + bx + c = (x + p)(x + q)', note: 'where p × q = c and p + q = b' },
    { name: 'Difference of two squares', expression: 'a² − b² = (a − b)(a + b)', note: '' },
  ],
  'algebraic-notation': [
    { name: 'Shorthand', expression: '3 × x = 3x,   x × x = x²', note: 'the multiplication sign is dropped' },
  ],
  'simplifying-expressions': [
    { name: 'Laws of indices', expression: 'xᵃ × xᵇ = xᵃ⁺ᵇ,   xᵃ ÷ xᵇ = xᵃ⁻ᵇ', note: '' },
    { name: 'Power of a power', expression: '(xᵃ)ᵇ = xᵃᵇ', note: '' },
  ],
  'expanding-brackets': [
    { name: 'Expanding a single bracket', expression: 'a(b + c) = ab + ac', note: '' },
    { name: 'Expanding double brackets', expression: '(a + b)(c + d) = ac + ad + bc + bd', note: '' },
  ],
  substitution: [
    { name: 'Substitution', expression: 'replace each letter with its value, then calculate', note: 'follow the normal order of operations (BIDMAS)' },
  ],
  coordinates: [
    { name: 'Midpoint of two points', expression: 'midpoint = ( (x₁+x₂)/2 , (y₁+y₂)/2 )', note: '' },
  ],
  'solving-linear-equations': [
    { name: 'Balance method', expression: 'whatever you do to one side, do to the other', note: '' },
    { name: 'Quadratic formula', expression: 'x = ( −b ± √(b² − 4ac) ) ÷ 2a', note: 'stretch — for ax² + bx + c = 0 when it won\'t factorise' },
  ],
  ratios: [
    { name: 'Sharing in a ratio', expression: '1 part = total ÷ number of parts', note: 'then multiply to find each share' },
  ],
  'scale-factors': [
    { name: 'Scaling a length', expression: 'new length = original length × scale factor', note: '' },
  ],
  '2d-shapes': [
    { name: 'Polygon angle sum', expression: 'interior angle sum = (n − 2) × 180°', note: 'n = number of sides' },
    { name: 'Regular polygon interior angle', expression: 'interior angle = (n − 2) × 180° ÷ n', note: '' },
    { name: 'Circumference', expression: 'circumference = π × diameter', note: '' },
  ],
  '3d-shapes': [
    { name: "Euler's formula", expression: 'Faces + Vertices − Edges = 2', note: 'for solids with flat faces' },
    { name: 'Volume of a cuboid', expression: 'volume = length × width × height', note: '' },
    { name: 'Volume of a cylinder', expression: 'volume = π × r² × height', note: '' },
    { name: 'Volume of a sphere', expression: 'volume = (4/3) × π × r³', note: '' },
    { name: 'Volume of a cone', expression: 'volume = (1/3) × π × r² × height', note: 'a third of the matching cylinder' },
  ],
  'pythagoras-theorem': [
    { name: "Pythagoras' theorem", expression: 'a² + b² = c²', note: 'c = hypotenuse, right-angled triangles only' },
    { name: 'Distance between two points', expression: 'd = √( (x₂−x₁)² + (y₂−y₁)² )', note: '' },
  ],
  'area-perimeter': [
    { name: 'Rectangle', expression: 'Area = l × w,   Perimeter = 2(l + w)', note: '' },
    { name: 'Triangle', expression: 'Area = ½ × base × height', note: '' },
    { name: 'Circle', expression: 'Area = π × r²', note: '' },
  ],
  'angle-rules': [
    { name: 'Angle sums', expression: 'straight line = 180°,   point = 360°,   triangle = 180°', note: '' },
    { name: 'Exterior angle of a regular polygon', expression: 'exterior angle = 360° ÷ n', note: '' },
    { name: 'Parallel lines', expression: 'alternate = corresponding (equal);   co-interior sum to 180°', note: "'Z', 'F' and 'C' angles" },
  ],
  probability: [
    { name: 'Simple probability', expression: 'P(event) = favourable outcomes ÷ total outcomes', note: '' },
    { name: 'Independent events (AND)', expression: 'P(A and B) = P(A) × P(B)', note: '' },
    { name: 'Complement', expression: 'P(not A) = 1 − P(A)', note: '' },
    { name: 'Mutually exclusive events (OR)', expression: 'P(A or B) = P(A) + P(B)', note: 'A and B can\'t both happen' },
  ],
  averages: [
    { name: 'Mean', expression: 'mean = sum of values ÷ number of values', note: '' },
    { name: 'Range', expression: 'range = highest value − lowest value', note: '' },
  ],
  'charts-graphs': [
    { name: 'Pie chart angle', expression: 'angle = (part ÷ total) × 360°', note: '' },
  ],
  'unit-conversion': [
    { name: 'Length', expression: '10mm = 1cm,   100cm = 1m,   1000m = 1km', note: '' },
    { name: 'Mass & capacity', expression: '1000g = 1kg,   1000ml = 1 litre', note: '' },
    { name: 'Time', expression: '60s = 1 min,   60 min = 1 hour,   24 hours = 1 day', note: '' },
    { name: 'Converting', expression: 'to a smaller unit: ×,   to a larger unit: ÷', note: '' },
  ],
};
