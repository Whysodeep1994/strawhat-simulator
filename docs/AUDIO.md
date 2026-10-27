# Music and sound effects

All music and sound effects in Strawhat Simulator are **made by the app's own code** while it
runs, using the browser's Web Audio API (`packages/web/src/sound.ts`). There are no audio
recordings or downloaded sound files, so:

- nothing comes from the One Piece anime, games or any other copyrighted source;
- every sound is this project's own work, under the project licence (AGPL-3.0-or-later);
- the site downloads **0 bytes** of audio.

| Sound           | When it plays                                                | How it is made                                                       |
| --------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| Card played     | A Character or Stage enters the field, or an Event is played | Filtered noise "tap" plus a low knock                                |
| Trash           | Cards go to the trash (discard, K.O., Counter)               | Several tiny filtered noise crinkles over a soft swish               |
| Attack          | An attack is declared                                        | Rising filtered-noise swoosh ending in a soft knock                  |
| Your turn       | Your turn starts                                             | Two soft bell notes, rising                                          |
| Opponent's turn | Your opponent's turn starts                                  | Two soft bell notes, falling                                         |
| "Calm Harbour"  | Music on the title screen and menus                          | Soft chords, bass and a seeded kalimba-like melody (D major, 68 bpm) |
| "Open Sea"      | Music during a game                                          | The same instruments, A minor, 92 bpm, with a soft shaker            |

The table sounds are worked out from the game state before and after each move
(`packages/web/src/game-sounds.ts`), so they play for both players' moves: yours, the computer's
and a friend's in Play a Friend.

Players can switch music and sound effects on or off and set each volume under
**Settings → Sound**; the choice stays in their browser. Browsers only allow sound after the
player clicks or presses a key, so sound starts with the first click, and it pauses while the tab
is hidden.
