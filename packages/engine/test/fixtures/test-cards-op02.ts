import type { CardDefinition } from "../../src/index.js";

/** Made-up cards for the effect blocks added for set OP-02. */
export const OP02_EFFECT_CARDS: CardDefinition[] = [
  {
    "id": "TEST-DON-WATCHER",
    "name": "Test DON!! Watcher",
    "category": "leader",
    "colors": [
      "black"
    ],
    "power": 5000,
    "life": 4,
    "effects": [
      {
        "timing": "donGiven",
        "steps": [
          {
            "do": "costChange",
            "target": {
              "side": "opponent",
              "upTo": true
            },
            "amount": -1
          }
        ]
      }
    ]
  },
  {
    "id": "TEST-PLAY-WATCHER",
    "name": "Test Play Watcher",
    "category": "character",
    "colors": [
      "green"
    ],
    "cost": 2,
    "power": 3000,
    "effects": [
      {
        "timing": "youPlayCharacter",
        "played": {
          "noBaseEffect": true
        },
        "steps": [
          {
            "do": "setDonActive",
            "count": 1
          }
        ]
      },
      {
        "timing": "opponentPlaysCharacter",
        "steps": [
          {
            "do": "rest",
            "target": {
              "side": "opponent",
              "upTo": true
            }
          }
        ]
      }
    ]
  },
  {
    "id": "TEST-BATTLE-KO",
    "name": "Test Battle K.O.",
    "category": "character",
    "colors": [
      "black"
    ],
    "cost": 3,
    "power": 5000,
    "effects": [
      {
        "timing": "koInBattle",
        "steps": [
          {
            "do": "setActive",
            "target": {
              "side": "this"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "TEST-UNTOUCHABLE",
    "name": "Test Untouchable",
    "category": "character",
    "colors": [
      "green"
    ],
    "cost": 3,
    "power": 4000,
    "effects": [
      {
        "timing": "permanent",
        "conditions": [
          {
            "allDonRested": true
          }
        ],
        "steps": [
          {
            "do": "grantStatus",
            "target": {
              "side": "this"
            },
            "status": "cannotBeRemovedByOpponentsEffects"
          }
        ]
      }
    ]
  },
  {
    "id": "TEST-BOUNCE-SELF",
    "name": "Test Bounce Self",
    "category": "character",
    "colors": [
      "green"
    ],
    "cost": 2,
    "power": 3000,
    "effects": [
      {
        "timing": "activateMain",
        "costs": [
          {
            "returnOwnCharacter": 1,
            "filter": {
              "isThis": true
            }
          }
        ],
        "steps": [
          {
            "do": "draw",
            "count": 1
          }
        ]
      }
    ]
  },
  {
    "id": "TEST-DRAW-TO",
    "name": "Test Draw To",
    "category": "event",
    "colors": [
      "blue"
    ],
    "cost": 0,
    "effects": [
      {
        "timing": "main",
        "steps": [
          {
            "do": "drawTo",
            "count": 3
          }
        ]
      }
    ]
  },
  {
    "id": "TEST-OPP-RETURN-DON",
    "name": "Test Opponent Returns DON!!",
    "category": "event",
    "colors": [
      "purple"
    ],
    "cost": 0,
    "effects": [
      {
        "timing": "main",
        "steps": [
          {
            "do": "opponentReturnsDon",
            "count": 1
          }
        ]
      }
    ]
  },
  {
    "id": "TEST-KO-STAGE",
    "name": "Test K.O. Stage",
    "category": "event",
    "colors": [
      "black"
    ],
    "cost": 0,
    "effects": [
      {
        "timing": "main",
        "steps": [
          {
            "do": "ko",
            "target": {
              "side": "opponent",
              "zone": "stage",
              "filter": {
                "costAtMost": 3
              },
              "upTo": true
            }
          }
        ]
      }
    ]
  },
  {
    "id": "TEST-STAGE",
    "name": "Test Stage",
    "category": "stage",
    "colors": [
      "black"
    ],
    "cost": 1,
    "effects": [
      {
        "timing": "trigger",
        "steps": [
          {
            "do": "playThis"
          }
        ]
      }
    ]
  }
];
