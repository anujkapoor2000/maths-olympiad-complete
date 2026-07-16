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
  ],
  'algebraic-notation': [
    { name: 'Shorthand', expression: '3 × x = 3x,   x × x = x²', note: 'the multiplication sign is dropped' },
  ],
  'simplifying-expressions': [
    { name: 'Laws of indices', expression: 'xᵃ × xᵇ = xᵃ⁺ᵇ,   xᵃ ÷ xᵇ = xᵃ⁻ᵇ', note: '' },
  ],
  'expanding-brackets': [
    { name: 'Expanding a single bracket', expression: 'a(b + c) = ab + ac', note: '' },
  ],
  substitution: [
    { name: 'Substitution', expression: 'replace each letter with its value, then calculate', note: 'follow the normal order of operations (BIDMAS)' },
  ],
  coordinates: [
    { name: 'Midpoint of two points', expression: 'midpoint = ( (x₁+x₂)/2 , (y₁+y₂)/2 )', note: '' },
  ],
  'solving-linear-equations': [
    { name: 'Balance method', expression: 'whatever you do to one side, do to the other', note: '' },
  ],
  ratios: [
    { name: 'Sharing in a ratio', expression: '1 part = total ÷ number of parts', note: 'then multiply to find each share' },
  ],
  'scale-factors': [
    { name: 'Scaling a length', expression: 'new length = original length × scale factor', note: '' },
  ],
  '2d-shapes': [
    { name: 'Polygon angle sum', expression: 'interior angle sum = (n − 2) × 180°', note: 'n = number of sides' },
    { name: 'Circumference', expression: 'circumference = π × diameter', note: '' },
  ],
  '3d-shapes': [
    { name: "Euler's formula", expression: 'Faces + Vertices − Edges = 2', note: 'for solids with flat faces' },
    { name: 'Volume of a cuboid', expression: 'volume = length × width × height', note: '' },
  ],
  'pythagoras-theorem': [
    { name: "Pythagoras' theorem", expression: 'a² + b² = c²', note: 'c = hypotenuse, right-angled triangles only' },
  ],
  'area-perimeter': [
    { name: 'Rectangle', expression: 'Area = l × w,   Perimeter = 2(l + w)', note: '' },
    { name: 'Triangle', expression: 'Area = ½ × base × height', note: '' },
    { name: 'Circle', expression: 'Area = π × r²', note: '' },
  ],
  'angle-rules': [
    { name: 'Angle sums', expression: 'straight line = 180°,   point = 360°,   triangle = 180°', note: '' },
  ],
  probability: [
    { name: 'Simple probability', expression: 'P(event) = favourable outcomes ÷ total outcomes', note: '' },
    { name: 'Independent events', expression: 'P(A and B) = P(A) × P(B)', note: '' },
  ],
  averages: [
    { name: 'Mean', expression: 'mean = sum of values ÷ number of values', note: '' },
    { name: 'Range', expression: 'range = highest value − lowest value', note: '' },
  ],
  'charts-graphs': [
    { name: 'Pie chart angle', expression: 'angle = (part ÷ total) × 360°', note: '' },
  ],
};
