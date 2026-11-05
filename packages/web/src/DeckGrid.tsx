import type { Card, CardData } from "./card-data.js";
import { CATEGORY_NAMES } from "./CardPrint.js";
import { CardView } from "./CardView.js";
import type { SavedDeck } from "./my-decks.js";

interface Props {
  deck: SavedDeck;
  data: CardData;
  onAdd: (card: Card) => void;
  onRemove: (id: string) => void;
  onRead: (card: Card) => void;
  onHover: (card: Card | null) => void;
  onClose: () => void;
}

/**
 * The deck laid out as card pictures, like the library, so you can take in the
 * whole deck at a glance. Each card shows once with its copy count.
 */
export function DeckGrid({ deck, data, onAdd, onRemove, onRead, onHover, onClose }: Props) {
  const leader = deck.leader ? data.catalog[deck.leader] : undefined;
  const entries = Object.entries(deck.cards)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, n, card: data.catalog[id] }))
    .sort(
      (a, b) =>
        (a.card?.cost ?? 99) - (b.card?.cost ?? 99) ||
        a.id.localeCompare(b.id, "en", { numeric: true }),
    );
  const total = entries.reduce((sum, e) => sum + e.n, 0);
  const groups = (["character", "event", "stage"] as const)
    .map((cat) => ({
      name: `${CATEGORY_NAMES[cat]}s`,
      list: entries.filter((e) => e.card?.category === cat),
    }))
    .filter((g) => g.list.length > 0);

  return (
    <section className="deck-grid" aria-label="Your deck as cards">
      <div className="deck-grid-bar">
        <strong>Your deck · {total}/50 cards</strong>
        <button className="primary small" onClick={onClose} aria-pressed="true">
          ☰ Back to card search
        </button>
      </div>

      {!leader && entries.length === 0 && (
        <p className="note deck-empty">Your deck is empty. Go back to card search to add cards.</p>
      )}

      <div className="deck-grid-body" onMouseLeave={() => onHover(null)}>
        {leader && (
          <div className="deck-grid-group">
            <h3>Leader</h3>
            <div className="library">
              <div className="library-card" onFocus={() => onHover(leader)}>
                <CardView
                  def={leader}
                  image={data.imageUrl(leader)}
                  onHover={() => onHover(leader)}
                  onClick={() => onRead(leader)}
                  label={`Read ${leader.name} (${leader.id})`}
                />
                <span className="count-tag">Leader</span>
              </div>
            </div>
          </div>
        )}
        {groups.map(({ name, list }) => (
          <div className="deck-grid-group" key={name}>
            <h3>
              {name} <span>{list.reduce((sum, e) => sum + e.n, 0)}</span>
            </h3>
            <div className="library">
              {list.map(({ id, n, card }) =>
                card ? (
                  <div
                    key={id}
                    className={`library-card ${n > 1 ? "stacked" : ""}`}
                    onFocus={() => onHover(card)}
                  >
                    <CardView
                      def={card}
                      image={data.imageUrl(card)}
                      onHover={() => onHover(card)}
                      onClick={() => onRead(card)}
                      label={`Read ${card.name} (${card.id}), ${n} in deck`}
                    />
                    <span className="count-tag">×{n}</span>
                    <div className="library-actions">
                      <button
                        className="small"
                        onClick={() => onRemove(id)}
                        aria-label={`Remove one ${card.name}`}
                      >
                        −
                      </button>
                      <button
                        className="small"
                        onClick={() => onAdd(card)}
                        aria-label={`Add one ${card.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
