import { DayType } from './supabase'

export const TARGETS: Record<DayType, { kcal: number; p: number; c: number; f: number }> = {
  rest:     { kcal: 2000, p: 180, c: 175, f: 64 },
  light:    { kcal: 2200, p: 180, c: 236, f: 59 },
  moderate: { kcal: 2400, p: 180, c: 282, f: 61 },
  hard:     { kcal: 2600, p: 180, c: 325, f: 64 },
  race:     { kcal: 2700, p: 160, c: 371, f: 54 },
}

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  rest:     'Rest · 2,000',
  light:    'Light · 2,200',
  moderate: 'Moderate · 2,400',
  hard:     'Hard · 2,600',
  race:     'Race · 2,700',
}

export const QUICK_FOODS = [
  { name: 'Overnight oats + Isopure',    kcal: 380, p: 28, c: 45, f: 8 },
  { name: 'Spinach smoothie',            kcal: 280, p: 25, c: 30, f: 5 },
  { name: 'Coconut water + pre-workout', kcal:  60, p:  0, c: 15, f: 0 },
  { name: 'Isopure shake (1 scoop)',     kcal: 100, p: 25, c:  0, f: 0 },
  { name: 'Chicken breast 6oz',          kcal: 280, p: 52, c:  0, f: 6 },
  { name: 'Ground turkey 93% 6oz',       kcal: 240, p: 44, c:  0, f: 8 },
  { name: 'White rice 1 cup cooked',     kcal: 200, p:  4, c: 44, f: 0 },
  { name: 'Sweet potato medium',         kcal: 130, p:  3, c: 30, f: 0 },
  { name: 'Greek yogurt ¾ cup + Isopure',kcal: 250, p: 35, c: 18, f: 4 },
  { name: 'Protein bar 20g+',            kcal: 200, p: 21, c: 22, f: 7 },
  { name: "TJ's Peruvian corn ⅓ cup",   kcal: 130, p:  3, c: 22, f: 4 },
  { name: 'Banana',                      kcal: 105, p:  1, c: 27, f: 0 },
  { name: 'Apple',                       kcal:  95, p:  0, c: 25, f: 0 },
  { name: 'String cheese',               kcal:  80, p:  7, c:  0, f: 6 },
  { name: 'Energy gel',                  kcal: 100, p:  0, c: 22, f: 0 },
  { name: 'Rice cake',                   kcal:  35, p:  1, c:  7, f: 0 },
  { name: 'Almond butter 1 tbsp',        kcal:  98, p:  3, c:  3, f: 9 },
  { name: 'Air-popped popcorn 3 cups',   kcal:  90, p:  3, c: 18, f: 1 },
  { name: 'Cottage cheese ¾ cup',        kcal: 130, p: 20, c:  6, f: 3 },
]

export const CHAT_SYSTEM_PROMPT = `You are a nutrition analyzer for an athlete training for Falmouth Road Race and Hyrox Boston. The user describes what they ate. Extract every food item and estimate macros accurately.

Return ONLY a raw JSON object — no markdown, no text before or after:
{"items":[{"name":"food with quantity","kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0,"note":""}],"total_kcal":0,"total_protein_g":0,"overall_note":""}

Key reference values:
- Teddy unsalted PB 1 scoop (2 tbsp): 190 kcal, 8g P, 6g C, 16g F
- Chicken sausage link: 140 kcal, 14g P, 2g C, 8g F
- Small corn tortilla (6"): 60 kcal, 1g P, 12g C, 1g F
- Ground turkey 93% lean 4oz serving: 170 kcal, 22g P, 0g C, 9g F
- Apple: 95 kcal, 0g P, 25g C, 0g F
- Coconut water 12oz: 60 kcal, 0g P, 15g C, 0g F
- Black beans ½ cup: 110 kcal, 7g P, 20g C, 0g F

Rules:
- Multiply quantities (3 scoops PB = 3×190 = 570 kcal)
- List every item separately with quantity in the name
- Always estimate, never refuse`

export const PHOTO_PROMPT = `Analyze this food image or nutrition label. Return ONLY a raw JSON object — no markdown, no text before or after:
{"name":"food description","kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0,"note":"confidence note"}
For a nutrition label: read the values directly (1 serving).
For a plated meal: estimate based on visible portion sizes.
Always return valid JSON.`
