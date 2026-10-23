# Rules questions

Any rule we are unsure about goes here instead of being guessed silently. Each entry cites the
Comprehensive Rules number it relies on and the test that encodes our current answer.

Rules version in use: **1.2.1** (updated 2026-08-28).

| #   | Question                                                                    | Rule(s)                            | Current answer                                                                                                                                                                       | Status                                             | Test                                           |
| --- | --------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------- |
| 1   | Does a [Double Attack] hit against exactly 1 Life win the game?             | 7-1-4-1-1-1, 7-1-4-1-1-3, 10-1-2-1 | No. The 0-Life check happens once, when damage is determined. 7-1-4-1-1-3 repeats only the "take a Life card" step, so the defender takes their last Life card and the game goes on. | Following the rule text; confirm with official Q&A | `scenarios/battle/double-attack-one-life.json` |
| 2   | Should the game skip the Counter Step when the defender has nothing to use? | 7-1-3, 3-4-3                       | No. Skipping would tell the attacker the defender's hand has no counters. The engine always asks; the app may auto-pass after a short delay if the player turns that on.             | Design decision                                    | `test/view.test.ts`                            |
