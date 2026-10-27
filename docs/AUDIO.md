# Music and sound effects

All music and sound effects in Strawhat Simulator are **made by the app's own code** while it
runs, using the browser's Web Audio API (`packages/web/src/sound.ts`). There are no audio
recordings or downloaded sound files, so:

- nothing comes from the One Piece anime, games or any other copyrighted source;
- every sound is this project's own work, under the project licence (AGPL-3.0-or-later);
- the site downloads **0 bytes** of audio.

| Sound           | When it plays                                                                                     | How it is made                                         |
| --------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Card played     | A Character or Stage enters the field, an Event is played, or a card is added in the deck builder | Filtered noise "tap" plus a low knock                  |
| Trash           | Cards go to the trash (discard, K.O., Counter), or a card is removed in the deck builder          | Several tiny filtered noise crinkles over a soft swish |
| Attack          | An attack is declared                                                                             | Rising filtered-noise swoosh ending in a soft knock    |
| Your turn       | Your turn starts                                                                                  | Two soft bell notes, rising                            |
| Opponent's turn | Your opponent's turn starts                                                                       | Two soft bell notes, falling                           |

### Music

Each piece is written as data in `packages/web/src/music.ts` (chords, a scale, instruments and
drums) and played by `sound.ts` with a seeded melody, so it sounds the same every time. All of
them are original to this project; none is based on any existing song.

| Piece         | Where           | Style                                                      |
| ------------- | --------------- | ---------------------------------------------------------- |
| Set Sail!     | Menus (default) | G major, 132 bpm, marimba, bouncy bass, soft kick and clap |
| Calm Harbour  | Menus           | D major, 68 bpm, soft chords and a kalimba-like melody     |
| Open Sea      | Games           | A minor, 92 bpm, kalimba and soft shaker                   |
| Shanty Jig    | Games           | D major jig in 6/8, accordion-like reed                    |
| Storm Front   | Games           | D minor, 108 bpm, for a tenser feel                        |
| Island Breeze | Games           | F major, 100 bpm, marimba and shaker                       |

Game music can be one piece or **Shuffle**, which plays each in turn, moving on after four
phrases (one to two minutes) and starting each new game with the next piece.

Music from the One Piece anime, including covers by other artists, is not used: the songs belong
to their composers and publishers, and a cover still needs their licence.

The table sounds are worked out from the game state before and after each move
(`packages/web/src/game-sounds.ts`), so they play for both players' moves: yours, the computer's
and a friend's in Play a Friend.

Players can switch music and sound effects on or off and set each volume under
**Settings → Sound** or the **Sound** button during a game, and pick the music there; the choice stays in their browser. Browsers only allow sound after the
player clicks or presses a key, so sound starts with the first click, and it pauses while the tab
is hidden.
