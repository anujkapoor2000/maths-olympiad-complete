// Learning material catalog for the "Learn" tab — short explainer lessons a
// child can read before attempting questions on that topic. Each topic has
// a few sections (explanation + worked example) and a "key facts" recap.
//
// diagram (optional) names an illustration component rendered by App.jsx —
// see the DIAGRAMS map there. Keep this file pure data (no JSX) so content
// stays easy to scan and edit.

export const TOPICS = [
  // =========================================================================
  // NUMBER
  // =========================================================================
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
    id: 'negative-numbers',
    title: 'Negative Numbers',
    icon: '➖',
    category: 'Number',
    summary: 'Adding, subtracting, multiplying and dividing with numbers below zero.',
    sections: [
      {
        heading: 'The number line',
        body: "Negative numbers are less than zero. On a number line, they sit to the left of 0 — the further left a number is, the smaller it is, no matter how big it 'looks' without the minus sign.",
      },
      {
        heading: 'Adding and subtracting negative numbers',
        body: "Adding a negative number is the same as subtracting. Subtracting a negative number is the same as adding (the two minus signs cancel out).",
        example: {
          question: 'Work out: −5 + (−3), and 4 − (−6)',
          working: [
            'Adding a negative: −5 + (−3) = −5 − 3 = −8.',
            'Subtracting a negative: 4 − (−6) = 4 + 6 = 10.',
          ],
          answer: '−8 and 10',
        },
      },
      {
        heading: 'Multiplying and dividing negative numbers',
        body: "Same signs give a positive answer. Different signs give a negative answer.",
        example: {
          question: 'Work out: −4 × (−6), and −4 × 6',
          working: [
            'Same signs (both negative): −4 × (−6) = 24.',
            'Different signs (negative × positive): −4 × 6 = −24.',
          ],
          answer: '24 and −24',
        },
      },
      {
        heading: 'Ordering negative numbers',
        body: "To order negative numbers, picture (or draw) a number line. Numbers further to the right are always larger.",
        example: {
          question: 'Put these in order, smallest first: 3, −7, 0, −2, 5',
          working: [
            'Place them on a number line from left (smallest) to right (largest).',
            'Reading left to right: −7, −2, 0, 3, 5.',
          ],
          answer: '−7, −2, 0, 3, 5',
        },
      },
    ],
    keyFacts: [
      'Adding a negative = subtracting. Subtracting a negative = adding.',
      'Same signs multiply/divide to a positive answer; different signs give a negative answer.',
      'On a number line, further right always means larger — e.g. −2 is bigger than −7.',
    ],
  },

  {
    id: 'prime-numbers',
    title: 'Prime Numbers',
    icon: '🔍',
    category: 'Number',
    summary: 'Numbers with exactly two factors — 1 and themselves.',
    sections: [
      {
        heading: 'What is a prime number?',
        body: "A prime number has exactly two factors: 1 and itself. A number with more than two factors is called composite. Note that 1 is not a prime number, because it only has one factor.",
        example: {
          question: 'Which of these are prime? 7, 8, 9, 11, 15',
          working: [
            '7: factors are 1 and 7 only → prime.',
            '8: factors are 1, 2, 4, 8 → not prime.',
            '9: factors are 1, 3, 9 → not prime.',
            '11: factors are 1 and 11 only → prime.',
            '15: factors are 1, 3, 5, 15 → not prime.',
          ],
          answer: '7 and 11 are prime',
        },
      },
      {
        heading: 'The first few prime numbers',
        body: "2, 3, 5, 7, 11, 13, 17, 19, 23, 29, ... Notice that 2 is the only even prime number — every other even number can be divided by 2, so it has more than two factors.",
      },
      {
        heading: 'Prime factor trees',
        body: "Every whole number greater than 1 can be broken down into a unique product of prime numbers — its prime factorisation. A factor tree finds it quickly: split the number into two factors, then keep splitting any factor that isn't prime.",
        example: {
          question: 'Find the prime factorisation of 60.',
          working: [
            'Split 60 = 6 × 10.',
            'Split 6 = 2 × 3 (both prime). Split 10 = 2 × 5 (both prime).',
            '60 = 2 × 3 × 2 × 5 = 2² × 3 × 5.',
          ],
          answer: '60 = 2² × 3 × 5',
        },
      },
    ],
    keyFacts: [
      'A prime number has exactly two factors: 1 and itself.',
      '1 is not prime. 2 is the only even prime number.',
      'Every number greater than 1 can be broken into a unique product of primes.',
    ],
  },

  {
    id: 'hcf-lcm',
    title: 'HCF & LCM',
    icon: '🔗',
    category: 'Number',
    summary: 'The Highest Common Factor and Lowest Common Multiple of two numbers.',
    sections: [
      {
        heading: 'Highest Common Factor (HCF)',
        body: "The HCF of two numbers is the largest number that divides into both of them exactly. List the factors of each number, then find the largest one they have in common.",
        example: {
          question: 'Find the HCF of 24 and 36.',
          working: [
            'Factors of 24: 1, 2, 3, 4, 6, 8, 12, 24.',
            'Factors of 36: 1, 2, 3, 4, 6, 9, 12, 18, 36.',
            'Common factors: 1, 2, 3, 4, 6, 12. The highest is 12.',
          ],
          answer: '12',
        },
      },
      {
        heading: 'Lowest Common Multiple (LCM)',
        body: "The LCM of two numbers is the smallest number that is a multiple of both. List the multiples of each number, then find the smallest one they have in common.",
        example: {
          question: 'Find the LCM of 6 and 8.',
          working: [
            'Multiples of 6: 6, 12, 18, 24, 30, ...',
            'Multiples of 8: 8, 16, 24, 32, ...',
            'The smallest number in both lists is 24.',
          ],
          answer: '24',
        },
      },
      {
        heading: 'Using prime factors for bigger numbers',
        body: "For larger numbers, listing factors or multiples takes too long. Instead, write each number as a product of primes. HCF: multiply the prime factors common to both, using the lowest power of each. LCM: multiply every prime factor that appears in either number, using the highest power of each.",
        example: {
          question: 'Find the HCF and LCM of 60 and 72 using prime factors.',
          working: [
            '60 = 2² × 3 × 5. 72 = 2³ × 3².',
            'HCF: lowest power of each shared prime: 2² × 3 = 12.',
            'LCM: highest power of every prime that appears: 2³ × 3² × 5 = 360.',
          ],
          answer: 'HCF = 12, LCM = 360',
        },
      },
    ],
    keyFacts: [
      'HCF: the largest number that divides exactly into both numbers.',
      'LCM: the smallest number that both numbers divide into exactly.',
      'For bigger numbers, use prime factorisation: HCF uses the lowest shared powers, LCM uses the highest powers of every prime involved.',
    ],
  },

  {
    id: 'fractions-decimals',
    title: 'Fractions, Decimals & Percentages',
    icon: '🍕',
    category: 'Number',
    summary: 'Converting between the three forms, and adding, subtracting, multiplying and dividing fractions.',
    sections: [
      {
        heading: 'Converting between fractions, decimals and percentages',
        body: "Fraction → decimal: divide the numerator by the denominator. Decimal → percentage: multiply by 100. Percentage → fraction: write over 100 and simplify.",
        example: {
          question: 'Write 3/4 as a decimal and a percentage.',
          working: [
            '3/4 = 3 ÷ 4 = 0.75.',
            '0.75 × 100 = 75%.',
          ],
          answer: '0.75 and 75%',
        },
      },
      {
        heading: 'Adding and subtracting fractions',
        body: "Fractions need the same denominator before you can add or subtract them. Find a common denominator, convert each fraction, then add or subtract the numerators.",
        example: {
          question: 'Work out: 1/3 + 1/4',
          working: [
            'Common denominator of 3 and 4 is 12.',
            '1/3 = 4/12 and 1/4 = 3/12.',
            '4/12 + 3/12 = 7/12.',
          ],
          answer: '7/12',
        },
      },
      {
        heading: 'Multiplying and dividing fractions',
        body: "To multiply fractions, multiply the numerators together and the denominators together. To divide by a fraction, flip it (find its reciprocal) and multiply instead.",
        example: {
          question: 'Work out: 2/5 × 3/4, and 2/3 ÷ 1/6',
          working: [
            'Multiply: 2/5 × 3/4 = (2×3)/(5×4) = 6/20 = 3/10.',
            'Divide: flip 1/6 to 6/1, then multiply: 2/3 × 6/1 = 12/3 = 4.',
          ],
          answer: '3/10 and 4',
        },
      },
    ],
    keyFacts: [
      'Fraction to decimal: divide top by bottom. Decimal to percentage: ×100.',
      'Add/subtract fractions: match the denominators first.',
      'Multiply fractions straight across. Divide fractions by flipping the second one and multiplying.',
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

  // =========================================================================
  // ALGEBRA
  // =========================================================================
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
    id: 'algebraic-notation',
    title: 'Algebraic Notation',
    icon: '🔤',
    category: 'Algebra',
    summary: "The shorthand rules mathematicians use for writing expressions with letters.",
    sections: [
      {
        heading: 'Why do we use letters?',
        body: "A letter (like x or n) stands for a number we don't know yet, or a number that can change. Using letters lets us write general rules that work for every number, not just one example.",
      },
      {
        heading: 'The shorthand rules',
        body: "3 × x is written 3x (the multiplication sign is dropped). x × x is written x² (say 'x squared'). x ÷ 4 is written x/4. x + x + x is the same as 3x.",
        example: {
          question: 'Write these using algebraic notation: (a) 5 lots of y, (b) y multiplied by itself, (c) y divided by 2',
          working: [
            '(a) 5 × y = 5y.',
            '(b) y × y = y².',
            '(c) y ÷ 2 = y/2.',
          ],
          answer: '5y, y², y/2',
        },
      },
      {
        heading: 'Terms, expressions and coefficients',
        body: "A term is a single number, letter, or numbers/letters multiplied together (like 3x or 7). An expression is one or more terms added or subtracted together (like 3x + 7). The coefficient is the number in front of a letter — in 3x, the coefficient is 3.",
      },
    ],
    keyFacts: [
      '3 × x is written 3x. x × x is written x².',
      'A term is a single piece (3x); an expression is terms combined (3x + 7).',
      'The coefficient is the number multiplying the letter.',
    ],
  },

  {
    id: 'simplifying-expressions',
    title: 'Simplifying Expressions',
    icon: '➗',
    category: 'Algebra',
    summary: 'Collecting like terms to write an expression in its shortest form.',
    sections: [
      {
        heading: 'Like terms',
        body: "Like terms have exactly the same letter part (e.g. 3x and 5x are like terms; 3x and 5x² are not, because the powers are different). You can only add or subtract like terms.",
      },
      {
        heading: 'Collecting like terms',
        body: "Group the like terms together, then add or subtract their coefficients. Terms that aren't alike stay separate in the answer.",
        example: {
          question: 'Simplify: 4x + 3y − x + 2y',
          working: [
            'Group the x terms: 4x − x = 3x.',
            'Group the y terms: 3y + 2y = 5y.',
            'Combine: 3x + 5y.',
          ],
          answer: '3x + 5y',
        },
      },
      {
        heading: 'Simplifying with powers',
        body: "When multiplying the same letter, add the powers: x² × x³ = x⁵. When dividing, subtract the powers: x⁵ ÷ x² = x³.",
        example: {
          question: 'Simplify: x³ × x²',
          working: [
            'Add the powers: 3+2=5.',
            'x³ × x² = x⁵.',
          ],
          answer: 'x⁵',
        },
      },
    ],
    keyFacts: [
      'Only like terms (same letter part) can be combined.',
      'Add/subtract the coefficients of like terms; keep the letter part the same.',
      'Multiplying powers of the same letter: add the powers. Dividing: subtract the powers.',
    ],
  },

  {
    id: 'expanding-brackets',
    title: 'Expanding Single Brackets',
    icon: '🔓',
    category: 'Algebra',
    summary: 'Multiplying everything inside a bracket by the term outside.',
    sections: [
      {
        heading: 'The rule',
        body: "To expand a(b + c), multiply the term outside the bracket by each term inside: a(b+c) = ab + ac. This works with negative terms too — be careful with signs.",
        example: {
          question: 'Expand: 3(2x + 5)',
          working: [
            'Multiply 3 by 2x: 3×2x=6x.',
            'Multiply 3 by 5: 3×5=15.',
            'Result: 6x + 15.',
          ],
          answer: '6x + 15',
        },
      },
      {
        heading: 'Expanding with a negative term outside',
        body: "If the term outside the bracket is negative, every term inside changes sign when multiplied out.",
        example: {
          question: 'Expand: −2(3x − 4)',
          working: [
            'Multiply −2 by 3x: −2×3x=−6x.',
            'Multiply −2 by −4: −2×(−4)=+8.',
            'Result: −6x + 8.',
          ],
          answer: '−6x + 8',
        },
      },
      {
        heading: 'Expand then simplify',
        body: "Sometimes you need to expand brackets and then collect like terms to finish simplifying.",
        example: {
          question: 'Expand and simplify: 4(x + 3) + 2x',
          working: [
            'Expand: 4(x+3) = 4x + 12.',
            'Add the remaining term: 4x + 12 + 2x.',
            'Collect like terms: 4x + 2x = 6x, so 6x + 12.',
          ],
          answer: '6x + 12',
        },
      },
    ],
    keyFacts: [
      'a(b+c) = ab + ac — multiply everything inside by the term outside.',
      'A negative outside the bracket flips the sign of every term inside.',
      'After expanding, check if you can simplify further by collecting like terms.',
    ],
  },

  {
    id: 'substitution',
    title: 'Substitution',
    icon: '🔁',
    category: 'Algebra',
    summary: 'Replacing letters with numbers to work out the value of an expression.',
    sections: [
      {
        heading: 'What is substitution?',
        body: "Substitution means replacing each letter in an expression with a given number, then working out the answer using the normal order of operations (BIDMAS).",
        example: {
          question: 'Find the value of 3x + 5 when x = 4.',
          working: [
            'Replace x with 4: 3×4 + 5.',
            '3×4=12, then 12+5=17.',
          ],
          answer: '17',
        },
      },
      {
        heading: 'Substituting into more complex expressions',
        body: "With more than one letter, replace each one carefully, and remember powers apply only to the letter (or bracket) they're attached to.",
        example: {
          question: 'Find the value of 2a² + b when a=3 and b=7.',
          working: [
            'Replace the letters: 2×(3²) + 7.',
            '3²=9, so 2×9=18.',
            '18+7=25.',
          ],
          answer: '25',
        },
      },
      {
        heading: 'A common mistake to avoid',
        body: "Be careful with negative numbers when substituting — always put them in brackets first. For x=−2, x² means (−2)² = 4, not the mistaken reading of −2² as −4.",
        example: {
          question: 'Find the value of x² + 3 when x = −2.',
          working: [
            'Put the negative number in brackets: (−2)² + 3.',
            '(−2)² = 4 (a negative times a negative is positive).',
            '4 + 3 = 7.',
          ],
          answer: '7',
        },
      },
    ],
    keyFacts: [
      'Substitution = replace the letters with the given numbers, then calculate.',
      'Follow the normal order of operations (BIDMAS) once the numbers are in.',
      'Put negative numbers in brackets before applying a power, to avoid sign mistakes.',
    ],
  },

  {
    id: 'coordinates',
    title: 'Plotting Coordinates',
    icon: '📍',
    category: 'Algebra',
    summary: 'Describing and plotting the position of a point on a grid.',
    diagram: 'coordinates',
    sections: [
      {
        heading: 'The coordinate grid',
        body: "A coordinate is written as (x, y). The x-coordinate tells you how far to move left/right (horizontally) from the origin (0,0); the y-coordinate tells you how far to move up/down (vertically). Right and up are positive; left and down are negative.",
        example: {
          question: 'Plot the point (3, 2).',
          working: [
            'Start at the origin (0,0).',
            'Move 3 right (x=3).',
            'Move 2 up (y=2).',
          ],
          answer: 'The point is 3 across and 2 up from the origin',
        },
      },
      {
        heading: 'The four quadrants',
        body: "The grid is split into 4 quadrants by the x-axis and y-axis. Top-right: x positive, y positive. Top-left: x negative, y positive. Bottom-left: x negative, y negative. Bottom-right: x positive, y negative.",
      },
      {
        heading: 'Midpoint of a line segment',
        body: "To find the point exactly halfway between two coordinates, average the x-values and average the y-values separately.",
        example: {
          question: 'Find the midpoint of (2, 3) and (8, 7).',
          working: [
            'Average the x-values: (2+8)÷2=5.',
            'Average the y-values: (3+7)÷2=5.',
            'Midpoint: (5, 5).',
          ],
          answer: '(5, 5)',
        },
      },
    ],
    keyFacts: [
      'A coordinate (x, y): x is across, y is up.',
      'The origin is (0, 0), where the axes cross.',
      'Midpoint of two points: average the x-values and average the y-values.',
    ],
  },

  {
    id: 'solving-linear-equations',
    title: 'Solving Linear Equations',
    icon: '⚖️',
    category: 'Algebra',
    summary: 'Finding the value of the unknown letter using the balance method.',
    sections: [
      {
        heading: 'The balance method',
        body: "An equation is balanced — both sides are equal. Whatever you do to one side, you must do to the other, to keep it balanced. Undo operations in reverse order to isolate the letter.",
        example: {
          question: 'Solve: 3x + 4 = 19',
          working: [
            'Subtract 4 from both sides: 3x = 15.',
            'Divide both sides by 3: x = 5.',
          ],
          answer: 'x = 5',
        },
      },
      {
        heading: 'Equations with the letter on both sides',
        body: "Move all the letter terms to one side and all the number terms to the other, by adding or subtracting from both sides.",
        example: {
          question: 'Solve: 5x − 4 = 2x + 11',
          working: [
            'Subtract 2x from both sides: 3x − 4 = 11.',
            'Add 4 to both sides: 3x = 15.',
            'Divide by 3: x = 5.',
          ],
          answer: 'x = 5',
        },
      },
      {
        heading: 'Equations with brackets',
        body: "If the equation has brackets, expand them first, then solve as normal.",
        example: {
          question: 'Solve: 3(x + 2) = 21',
          working: [
            'Expand the bracket: 3x + 6 = 21.',
            'Subtract 6 from both sides: 3x = 15.',
            'Divide by 3: x = 5.',
          ],
          answer: 'x = 5',
        },
      },
    ],
    keyFacts: [
      'Whatever you do to one side of the equation, do to the other.',
      'Undo addition/subtraction first, then multiplication/division — working backwards.',
      'If there are brackets, expand them before you start solving.',
    ],
  },

  // =========================================================================
  // RATIO AND PROPORTION
  // =========================================================================
  {
    id: 'ratios',
    title: 'Ratios',
    icon: '⚖️',
    category: 'Ratio and Proportion',
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
    id: 'scale-factors',
    title: 'Scale Factors',
    icon: '🔎',
    category: 'Ratio and Proportion',
    summary: 'How much bigger or smaller a shape or drawing is compared to the original.',
    sections: [
      {
        heading: 'What is a scale factor?',
        body: "A scale factor tells you how many times bigger (or smaller) an enlarged shape is compared to the original. Multiply every length by the scale factor to find the new lengths.",
        example: {
          question: 'A rectangle with sides 4cm and 6cm is enlarged by a scale factor of 3. Find the new dimensions.',
          working: ['Multiply each side by 3: 4×3=12cm, 6×3=18cm.'],
          answer: '12cm by 18cm',
        },
      },
      {
        heading: 'Scale factors less than 1',
        body: "A scale factor between 0 and 1 makes the shape smaller (a reduction), even though it's still called a 'scale factor'.",
        example: {
          question: 'A photo 20cm wide is reduced by a scale factor of 0.5. How wide is the copy?',
          working: ['Multiply by the scale factor: 20 × 0.5 = 10cm.'],
          answer: '10cm',
        },
      },
      {
        heading: 'Map and model scales',
        body: "Scales are often written as a ratio, like 1:25000 on a map. This means 1 unit on the map represents 25000 of the same unit in real life.",
        example: {
          question: 'A map has a scale of 1:25000. A distance on the map is 6cm. Find the real distance in km.',
          working: [
            'Real distance = 6 × 25000 = 150000cm.',
            '150000cm = 1500m = 1.5km.',
          ],
          answer: '1.5km',
        },
      },
    ],
    keyFacts: [
      'Scale factor > 1: the shape gets bigger. Scale factor between 0 and 1: the shape gets smaller.',
      'Multiply every length by the scale factor to enlarge or reduce a shape.',
      'A map scale like 1:25000 means 1 unit on the map = 25000 of that unit in real life.',
    ],
  },

  // =========================================================================
  // GEOMETRY AND MEASURES
  // =========================================================================
  {
    id: '2d-shapes',
    title: '2D Shapes',
    icon: '🔺',
    category: 'Geometry and Measures',
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
    category: 'Geometry and Measures',
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
          question: 'Find the volume of a cuboid measuring 5cm by 4cm by 3cm.',
          working: [
            'Volume = length × width × height.',
            '5 × 4 × 3 = 60cm³.',
          ],
          answer: '60cm³',
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
    category: 'Geometry and Measures',
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
    category: 'Geometry and Measures',
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
        heading: 'Area of triangles and parallelograms',
        body: "Triangle: Area = ½ × base × height. Parallelogram: Area = base × height (using the perpendicular height, not the slanted side).",
        example: {
          question: 'Find the area of a triangle with base 10cm and height 6cm, and a parallelogram with base 8cm and height 5cm.',
          working: [
            'Triangle: Area = ½ × base × height = ½ × 10 × 6 = 30cm².',
            'Parallelogram: Area = base × height = 8 × 5 = 40cm².',
          ],
          answer: '30cm² and 40cm²',
        },
      },
      {
        heading: 'Area of a rectangle and circle',
        body: "Rectangle: Area = length × width. Circle: Area = π × radius².",
        example: {
          question: 'Find the area of a circle with radius 7cm. Use π = 22/7.',
          working: ['Area = π × r² = (22/7) × 7² = (22/7) × 49 = 154cm².'],
          answer: '154cm²',
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
      'Rectangle area = length × width. Triangle area = ½ × base × height. Parallelogram area = base × height.',
      'Similar shapes: side ratio a:b gives area ratio a²:b².',
    ],
  },

  {
    id: 'angle-rules',
    title: 'Angle Rules',
    icon: '📏',
    category: 'Geometry and Measures',
    summary: 'The key angle facts for straight lines, points, and triangles.',
    diagram: 'angles',
    sections: [
      {
        heading: 'Angles on a straight line',
        body: "Angles on a straight line always add up to 180°.",
        example: {
          question: 'Two angles on a straight line are 65° and x°. Find x.',
          working: [
            'Angles on a straight line sum to 180°.',
            'x = 180 − 65 = 115°.',
          ],
          answer: '115°',
        },
      },
      {
        heading: 'Angles around a point',
        body: "Angles that meet at a single point (all the way around) add up to 360°.",
        example: {
          question: 'Three angles meeting at a point are 110°, 140° and x°. Find x.',
          working: [
            'Angles around a point sum to 360°.',
            'x = 360 − 110 − 140 = 110°.',
          ],
          answer: '110°',
        },
      },
      {
        heading: 'Vertically opposite angles',
        body: "When two straight lines cross, the angles opposite each other (across the crossing point) are always equal.",
      },
      {
        heading: 'Angles in a triangle',
        body: "The three interior angles of any triangle always add up to 180°.",
        example: {
          question: 'A triangle has angles 50° and 70°. Find the third angle.',
          working: [
            'Angles in a triangle sum to 180°.',
            'Third angle = 180 − 50 − 70 = 60°.',
          ],
          answer: '60°',
        },
      },
    ],
    keyFacts: [
      'Angles on a straight line: sum to 180°.',
      'Angles around a point: sum to 360°.',
      'Angles in a triangle: sum to 180°. Vertically opposite angles are equal.',
    ],
  },

  // =========================================================================
  // STATISTICS AND PROBABILITY
  // =========================================================================
  {
    id: 'probability',
    title: 'Probability',
    icon: '🎲',
    category: 'Statistics and Probability',
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
    id: 'averages',
    title: 'Averages: Mean, Median & Mode',
    icon: '📊',
    category: 'Statistics and Probability',
    summary: 'Three different ways to describe the "typical" value in a set of data, plus the range.',
    sections: [
      {
        heading: 'Mean',
        body: "The mean is what most people call the 'average'. Add up all the values, then divide by how many values there are.",
        example: {
          question: 'Find the mean of: 4, 7, 9, 12, 8',
          working: [
            'Add the values: 4+7+9+12+8=40.',
            'Divide by how many there are (5): 40÷5=8.',
          ],
          answer: '8',
        },
      },
      {
        heading: 'Median',
        body: "The median is the middle value when the data is arranged in order. If there are two middle values (an even number of values), the median is halfway between them.",
        example: {
          question: 'Find the median of: 3, 9, 5, 1, 7',
          working: [
            'Arrange in order: 1, 3, 5, 7, 9.',
            'The middle value is 5.',
          ],
          answer: '5',
        },
      },
      {
        heading: 'Mode',
        body: "The mode is the value that appears most often. A set of data can have more than one mode, or no mode at all if every value is different.",
        example: {
          question: 'Find the mode of: 2, 4, 4, 6, 7, 4, 9',
          working: ['4 appears three times — more than any other value.'],
          answer: '4',
        },
      },
      {
        heading: 'Range',
        body: "The range measures how spread out the data is. Range = highest value − lowest value.",
        example: {
          question: 'Find the range of: 3, 9, 5, 1, 7',
          working: [
            'Highest value: 9. Lowest value: 1.',
            'Range = 9 − 1 = 8.',
          ],
          answer: '8',
        },
      },
    ],
    keyFacts: [
      'Mean: add up all the values, divide by how many there are.',
      'Median: the middle value once the data is in order.',
      'Mode: the most frequent value. Range: highest minus lowest.',
    ],
  },

  {
    id: 'charts-graphs',
    title: 'Interpreting Charts & Graphs',
    icon: '📈',
    category: 'Statistics and Probability',
    summary: 'Reading and understanding pie charts, bar charts and scatter graphs.',
    sections: [
      {
        heading: 'Bar charts',
        body: "A bar chart uses bars to compare amounts across different categories. The height (or length) of each bar shows its value — read it against the scale on the axis.",
      },
      {
        heading: 'Pie charts',
        body: "A pie chart shows how a total is split into categories, using slices of a circle. The whole circle represents 360° (the total). To find the angle for a category, work out its fraction of the total and multiply by 360°.",
        example: {
          question: 'In a survey of 90 people, 30 chose football. What angle represents football on a pie chart?',
          working: [
            'Fraction choosing football: 30/90=1/3.',
            'Angle = 1/3 × 360° = 120°.',
          ],
          answer: '120°',
        },
      },
      {
        heading: 'Scatter graphs',
        body: "A scatter graph plots pairs of related values as points, to see if there's a connection (correlation) between them. Points trending upward from left to right show positive correlation; points trending downward show negative correlation; points with no pattern show no correlation. A 'line of best fit' is a straight line drawn through the middle of the points to show the trend.",
      },
    ],
    keyFacts: [
      'Bar chart: compare amounts by bar height/length.',
      'Pie chart: the whole circle (360°) represents the total; angle = fraction of total × 360°.',
      'Scatter graph: shows correlation between two sets of data — positive, negative, or none.',
    ],
  },
];

export const TOPIC_MAP = Object.fromEntries(TOPICS.map(t => [t.id, t]));

export const TOPIC_CATEGORIES = [...new Set(TOPICS.map(t => t.category))];
