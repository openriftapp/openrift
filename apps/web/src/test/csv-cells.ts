const FORMULA_LIKE_CELLS = [
  "=SUM(A1)",
  "+1 foil",
  "@Teemo",
  "-signed",
  "-",
  "-1e5",
  "-1,5",
  "=a,b",
] as const;

const NUMBER_CELLS = ["-1", "-0.5", "-.5", "+3", "0", "9.5"] as const;

const TEXT_CELLS = [
  "Jinx, Loose Cannon",
  'the "Rebel" deck',
  "line one\nline two",
  "line one\r\nline two",
  "line one\rline two",
  "'quoted",
  "'=x",
  "''@x",
  "'-3",
  "'-signed",
  "' =x",
  "a\t=b",
  '=HYPERLINK("x", "y"),\r\n"z"',
] as const;

export const ROUND_TRIP_CELLS = [...FORMULA_LIKE_CELLS, ...NUMBER_CELLS, ...TEXT_CELLS];
