import {
  copyLimit,
  formatDeckList,
  parseDeckList,
  searchCards,
  searchOptions,
  setOf,
  type CardCatalog,
  type CardCategory,
  type Color,
} from "@strawhat/engine";
import { useMemo, useState, type ReactNode } from "react";
import { officialText, setLabel, type Card, type CardData } from "./card-data.js";
import { CardView } from "./CardView.js";
import { cardList, fromList, problemsOf, type SavedDeck } from "./my-decks.js";

interface Props {
  data: CardData;
  deck: SavedDeck;
  /** The browser refused to store the last change. */
  saveFailed: boolean;
  onChange: (deck: SavedDeck) => void;
  onDelete: () => void;
  onDone: () => void;
}

/** Results render in pages, so a library of thousands of cards stays quick. */
const PAGE = 60;

const CATEGORY_NAMES: Record<CardCategory, string> = {
  leader: "Leader",
  character: "Character",
  event: "Event",
  stage: "Stage",
};
const COLOR_NAMES: Record<Color, string> = {
  red: "Red",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  black: "Black",
  yellow: "Yellow",
};

export function DeckBuilder({ data, deck, saveFailed, onChange, onDelete, onDone }: Props) {
  const catalog = data.catalog as CardCatalog;
  const options = useMemo(() => searchOptions(catalog), [catalog]);
  const [text, setText] = useState("");
  const [id, setId] = useState("");
  const [sets, setSets] = useState<string[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [type, setType] = useState("");
  const [cost, setCost] = useState<[number, number]>([options.cost.min, options.cost.max]);
  const [forLeader, setForLeader] = useState(true);
  const [shown, setShown] = useState(PAGE);
  const [detail, setDetail] = useState<Card | null>(null);
  const [dialog, setDialog] = useState<"paste" | "copy" | "delete" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deckOpen, setDeckOpen] = useState(false);

  const leader = deck.leader ? data.catalog[deck.leader] : undefined;
  const choosingLeader = !leader;
  const costFiltered = cost[0] > options.cost.min || cost[1] < options.cost.max;
  const total = Object.values(deck.cards).reduce((sum, n) => sum + n, 0);
  const problems = useMemo(() => problemsOf(deck, data), [deck, data]);

  const results = useMemo(() => {
    const found = searchCards(catalog, {
      ...(id.trim() ? { id } : {}),
      sets,
      colors,
      categories: choosingLeader ? ["leader"] : categories,
      types: type ? [type] : [],
      ...(costFiltered ? { cost: { min: cost[0], max: cost[1] } } : {}),
      ...(!choosingLeader && forLeader && deck.leader ? { leader: deck.leader } : {}),
    }) as Card[];
    const query = text.trim().toLowerCase();
    const matching = query ? found.filter((card) => matchesText(card, query)) : found;
    // Cards the format allows come first; the rest stay visible so you can see why they're out.
    const usable = (card: Card) =>
      card.category === "leader" || copyLimit(data.format, catalog, card.id) > 0;
    return [...matching.filter(usable), ...matching.filter((card) => !usable(card))];
  }, [
    catalog,
    data.format,
    text,
    id,
    sets,
    colors,
    categories,
    type,
    cost,
    costFiltered,
    forLeader,
    deck.leader,
    choosingLeader,
  ]);

  const filtersOn =
    text || id || sets.length || colors.length || categories.length || type || costFiltered;

  function resetFilters() {
    setText("");
    setId("");
    setSets([]);
    setColors([]);
    setCategories([]);
    setType("");
    setCost([options.cost.min, options.cost.max]);
    setShown(PAGE);
  }

  function setCount(cardId: string, count: number) {
    const cards = { ...deck.cards };
    if (count > 0) cards[cardId] = count;
    else delete cards[cardId];
    onChange({ ...deck, cards, updated: new Date().toISOString() });
  }

  function add(card: Card) {
    setNotice(null);
    if (card.category === "leader") {
      onChange({ ...deck, leader: card.id, updated: new Date().toISOString() });
      setNotice(`${card.name} is your Leader. Now add 50 cards.`);
      return;
    }
    const have = deck.cards[card.id] ?? 0;
    const limit = copyLimit(data.format, catalog, card.id);
    if (limit === 0) return setNotice(`${card.name} can't be used in ${data.format.name}.`);
    if (have >= limit) {
      return setNotice(`You already have ${have} ${card.name}; the limit is ${limit}.`);
    }
    setCount(card.id, have + 1);
  }

  function remove(cardId: string) {
    setNotice(null);
    setCount(cardId, (deck.cards[cardId] ?? 0) - 1);
  }

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className={`builder ${deckOpen ? "deck-open" : ""}`}>
      <header className="builder-bar">
        <button className="ghost" onClick={onDone}>
          ← Done
        </button>
        <input
          className="deck-name"
          value={deck.name}
          onChange={(e) =>
            onChange({ ...deck, name: e.target.value, updated: new Date().toISOString() })
          }
          aria-label="Deck name"
          maxLength={40}
        />
        <span className={`legal-chip ${problems.length ? "bad" : "good"}`}>
          {problems.length ? `${total}/50` : `Legal in ${data.format.name}`}
        </span>
        <span className="saved-note" role="status">
          {saveFailed ? "Not saved: this browser won't store decks" : "Saved"}
        </span>
      </header>

      <section className="builder-search" aria-label="Card library">
        <div className="filters">
          <div className="filter-row">
            <input
              type="search"
              placeholder="Search names, types and text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setShown(PAGE);
              }}
              aria-label="Search names, types and card text"
            />
            <input
              className="id-search"
              placeholder="Card ID, e.g. OP13-001"
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setShown(PAGE);
              }}
              aria-label="Card ID"
            />
          </div>
          <Chips label="Set">
            {options.sets.map((set) => (
              <Chip key={set} on={sets.includes(set)} onClick={() => setSets(toggle(sets, set))}>
                {setLabel(set)}
              </Chip>
            ))}
          </Chips>
          <Chips label="Colour">
            {options.colors.map((color) => (
              <Chip
                key={color}
                on={colors.includes(color)}
                onClick={() => setColors(toggle(colors, color))}
              >
                <span className="dot" style={{ background: `var(--c-${color})` }} />
                {COLOR_NAMES[color]}
              </Chip>
            ))}
          </Chips>
          {!choosingLeader && (
            <Chips label="Card type">
              {options.categories
                .filter((c) => c !== "leader")
                .map((category) => (
                  <Chip
                    key={category}
                    on={categories.includes(category)}
                    onClick={() => setCategories(toggle(categories, category))}
                  >
                    {CATEGORY_NAMES[category]}
                  </Chip>
                ))}
            </Chips>
          )}
          <div className="filter-row">
            <label className="field inline">
              <span>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Any type</option>
                {options.types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <CostRange
              min={options.cost.min}
              max={options.cost.max}
              value={cost}
              onChange={(v) => {
                setCost(v);
                setShown(PAGE);
              }}
            />
          </div>
          <div className="filter-row small">
            {!choosingLeader && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={forLeader}
                  onChange={(e) => setForLeader(e.target.checked)}
                />
                Only cards my Leader can use
              </label>
            )}
            {filtersOn ? (
              <button className="ghost small" onClick={resetFilters}>
                Clear filters
              </button>
            ) : null}
            <span className="count">
              {results.length} {results.length === 1 ? "card" : "cards"}
            </span>
          </div>
        </div>

        {choosingLeader && (
          <p className="step">
            Step 1: tap a Leader. Its colours decide which cards your deck can use.
          </p>
        )}
        {notice && (
          <p className="builder-notice" role="status">
            {notice}
          </p>
        )}

        <div className="library">
          {results.slice(0, shown).map((card) => {
            const count =
              card.category === "leader"
                ? card.id === deck.leader
                  ? 1
                  : 0
                : (deck.cards[card.id] ?? 0);
            const limit = card.category === "leader" ? 1 : copyLimit(data.format, catalog, card.id);
            return (
              <div key={card.id} className={`library-card ${limit === 0 ? "banned" : ""}`}>
                <CardView
                  def={card}
                  image={data.imageUrl(card)}
                  onClick={() => add(card)}
                  label={`Add ${card.name} (${card.id})`}
                  glow={count > 0 ? "selected" : null}
                />
                {limit === 0 && (
                  <span className="limit-tag banned">
                    {data.format.banned?.includes(card.id)
                      ? "Banned"
                      : `Not in ${data.format.name}`}
                  </span>
                )}
                {limit > 0 && limit < 4 && card.category !== "leader" && (
                  <span className="limit-tag">Limit {limit}</span>
                )}
                {count > 0 && (
                  <span className="count-tag">
                    {card.category === "leader" ? "Leader" : `×${count}`}
                  </span>
                )}
                <div className="library-actions">
                  <button
                    className="small"
                    onClick={() => setDetail(card)}
                    aria-label={`Read ${card.name}`}
                  >
                    Read
                  </button>
                  {count > 0 && card.category !== "leader" && (
                    <button
                      className="small"
                      onClick={() => remove(card.id)}
                      aria-label={`Remove one ${card.name}`}
                    >
                      −
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {results.length === 0 && <p className="note">No cards match. Try clearing a filter.</p>}
        </div>
        {results.length > shown && (
          <button className="show-more" onClick={() => setShown(shown + PAGE)}>
            Show more ({results.length - shown} left)
          </button>
        )}
      </section>

      <aside className="builder-deck" aria-label="Your deck">
        <div className="deck-head">
          {leader ? (
            <div className="deck-leader">
              <CardView
                def={leader}
                image={data.imageUrl(leader)}
                size="small"
                showName={false}
                onClick={() => setDetail(leader)}
              />
              <div>
                <strong>{leader.name}</strong>
                <span>
                  {leader.id} · {leader.colors.map((c) => COLOR_NAMES[c]).join("/")} Leader
                </span>
                <button
                  className="ghost small"
                  onClick={() => onChange(fromList(deck, undefined, cardList(deck)))}
                >
                  Change Leader
                </button>
              </div>
            </div>
          ) : (
            <p className="note">No Leader yet. Tap one in the library.</p>
          )}
          <div className="deck-count">
            <div className="meter" aria-hidden="true">
              <span
                style={{ width: `${Math.min(100, (total / 50) * 100)}%` }}
                className={total > 50 ? "over" : ""}
              />
            </div>
            <span>
              <strong>{total}</strong> / 50 cards
            </span>
          </div>
          <CostCurve deck={deck} data={data} />
        </div>

        <DeckList deck={deck} data={data} onAdd={add} onRemove={remove} onRead={setDetail} />

        <div className={`deck-check ${problems.length ? "bad" : "good"}`}>
          {problems.length === 0 ? (
            <p>✓ Ready to play: legal in {data.format.name}.</p>
          ) : (
            <ul>
              {problems.slice(0, 6).map((p) => (
                <li key={p.message}>{p.message}</li>
              ))}
              {problems.length > 6 && <li>…and {problems.length - 6} more</li>}
            </ul>
          )}
          {!data.formatLoaded && (
            <p className="note">
              The official banned and restricted list isn't loaded yet, so only the basic deck rules
              are checked (50 cards, up to 4 copies, Leader colours).
            </p>
          )}
        </div>

        <div className="row deck-buttons">
          <button onClick={() => setDialog("paste")}>Paste a list</button>
          <button onClick={() => setDialog("copy")} disabled={!leader}>
            Copy list
          </button>
          <button className="ghost danger-text" onClick={() => setDialog("delete")}>
            Delete deck
          </button>
        </div>
      </aside>

      <button className="deck-toggle primary" onClick={() => setDeckOpen(!deckOpen)}>
        {deckOpen ? "Back to cards" : `View deck · ${total}/50`}
      </button>

      {detail && (
        <Dialog title={detail.name} onClose={() => setDetail(null)}>
          <div className="read-card">
            <CardView def={detail} image={data.imageUrl(detail)} size="large" />
            <div className="read-text">
              <p className="meta">
                <span className="card-id">{detail.id}</span> · {CATEGORY_NAMES[detail.category]} ·{" "}
                {detail.colors.map((c) => COLOR_NAMES[c]).join("/")}
                {detail.cost !== undefined ? ` · cost ${detail.cost}` : ""}
                {detail.power !== undefined ? ` · ${detail.power} power` : ""}
                {detail.counter ? ` · counter +${detail.counter}` : ""}
                {detail.life !== undefined ? ` · ${detail.life} Life` : ""}
              </p>
              {detail.types?.length ? <p className="types">{detail.types.join(" / ")}</p> : null}
              <ul className="effect-text">
                {officialText(detail).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="meta">Set: {setLabel(setOf(detail.id))}</p>
              <div className="row">
                <button className="primary" onClick={() => add(detail)}>
                  {detail.category === "leader" ? "Use as Leader" : "Add 1"}
                </button>
                {(deck.cards[detail.id] ?? 0) > 0 && (
                  <button onClick={() => remove(detail.id)}>Remove 1</button>
                )}
                <span className="count">
                  In deck:{" "}
                  {detail.category === "leader"
                    ? detail.id === deck.leader
                      ? 1
                      : 0
                    : (deck.cards[detail.id] ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {dialog === "paste" && (
        <PasteDialog
          data={data}
          onClose={() => setDialog(null)}
          onImport={(leaderId, list) => {
            onChange({ ...fromList(deck, leaderId, list) });
            setDialog(null);
            setNotice("Deck list imported.");
          }}
        />
      )}
      {dialog === "copy" && leader && (
        <CopyDialog
          text={formatDeckList({ leader: leader.id, deck: cardList(deck) })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && (
        <Dialog title="Delete this deck?" onClose={() => setDialog(null)}>
          <p>“{deck.name}” will be removed from this browser. This can't be undone.</p>
          <div className="row center">
            <button className="danger" onClick={onDelete}>
              Delete
            </button>
            <button onClick={() => setDialog(null)}>Keep it</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function matchesText(card: Card, query: string): boolean {
  return (
    card.name.toLowerCase().includes(query) ||
    card.id.toLowerCase().includes(query) ||
    (card.types ?? []).some((t) => t.toLowerCase().includes(query)) ||
    (card.text ?? "").toLowerCase().includes(query) ||
    (card.trigger ?? "").toLowerCase().includes(query)
  );
}

function Chips({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      <span className="chips-label">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

/** Two handles on one track, for a range such as cost 4 to 6. */
function CostRange({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}) {
  const [low, high] = value;
  const span = Math.max(1, max - min);
  return (
    <div className="cost-range">
      <span className="cost-range-label">
        Cost <strong>{low === high ? low : `${low}–${high}`}</strong>
      </span>
      <div
        className="cost-track"
        style={{
          ["--low" as string]: `${((low - min) / span) * 100}%`,
          ["--high" as string]: `${((high - min) / span) * 100}%`,
        }}
      >
        <input
          type="range"
          min={min}
          max={max}
          value={low}
          onChange={(e) => onChange([Math.min(Number(e.target.value), high), high])}
          aria-label="Lowest cost"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={high}
          onChange={(e) => onChange([low, Math.max(Number(e.target.value), low)])}
          aria-label="Highest cost"
        />
      </div>
    </div>
  );
}

function CostCurve({ deck, data }: { deck: SavedDeck; data: CardData }) {
  const buckets = Array<number>(11).fill(0);
  for (const [id, n] of Object.entries(deck.cards)) {
    const c = data.catalog[id]?.cost;
    if (c !== undefined) buckets[Math.min(10, c)]! += n;
  }
  const most = Math.max(1, ...buckets);
  return (
    <div className="curve" aria-label="Cards at each cost">
      {buckets.map((n, cost) => (
        <div key={cost} className="curve-col" title={`Cost ${cost === 10 ? "10+" : cost}: ${n}`}>
          <span className="curve-n">{n || ""}</span>
          <span className="curve-bar" style={{ height: `${(n / most) * 100}%` }} />
          <span className="curve-cost">{cost === 10 ? "10+" : cost}</span>
        </div>
      ))}
    </div>
  );
}

function DeckList({
  deck,
  data,
  onAdd,
  onRemove,
  onRead,
}: {
  deck: SavedDeck;
  data: CardData;
  onAdd: (card: Card) => void;
  onRemove: (id: string) => void;
  onRead: (card: Card) => void;
}) {
  const entries = Object.entries(deck.cards)
    .map(([id, n]) => ({ id, n, card: data.catalog[id] }))
    .sort(
      (a, b) =>
        (a.card?.cost ?? 99) - (b.card?.cost ?? 99) ||
        a.id.localeCompare(b.id, "en", { numeric: true }),
    );
  if (entries.length === 0)
    return <p className="note deck-empty">Your deck is empty. Tap cards to add them.</p>;
  const groups: [string, typeof entries][] = (["character", "event", "stage", "leader"] as const)
    .map((cat): [string, typeof entries] => [
      CATEGORY_NAMES[cat],
      entries.filter((e) => e.card?.category === cat),
    ])
    .filter(([, list]) => list.length > 0);
  const unknown = entries.filter((e) => !e.card);
  if (unknown.length) groups.push(["Unknown cards", unknown]);
  return (
    <div className="deck-list">
      {groups.map(([name, list]) => (
        <section key={name}>
          <h3>
            {name}s <span>{list.reduce((s, e) => s + e.n, 0)}</span>
          </h3>
          <ul>
            {list.map(({ id, n, card }) => {
              const image = data.imageUrl(card);
              return (
                <li key={id}>
                  <button
                    className="deck-row"
                    onClick={() => card && onRead(card)}
                    style={image ? { ["--thumb" as string]: `url("${image}")` } : undefined}
                  >
                    <span className="row-cost">{card?.cost ?? "–"}</span>
                    <span className="row-name">
                      {card?.name ?? id}
                      <small>{id}</small>
                    </span>
                  </button>
                  <button
                    className="small"
                    onClick={() => onRemove(id)}
                    aria-label={`Remove one ${card?.name ?? id}`}
                  >
                    −
                  </button>
                  <span className="row-n">{n}</span>
                  <button
                    className="small"
                    onClick={() => card && onAdd(card)}
                    aria-label={`Add one ${card?.name ?? id}`}
                  >
                    +
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PasteDialog({
  data,
  onClose,
  onImport,
}: {
  data: CardData;
  onClose: () => void;
  onImport: (leader: string | undefined, list: string[]) => void;
}) {
  const [text, setText] = useState("");
  const parsed = useMemo(
    () => (text.trim() ? parseDeckList(data.catalog as CardCatalog, text) : null),
    [text, data],
  );
  return (
    <Dialog title="Paste a deck list" onClose={onClose}>
      <p>One card per line, like “4xOP01-016”, with the Leader as “1x”. This replaces the deck.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={"1xST01-001\n4xST01-004\n4xST01-006\n…"}
        aria-label="Deck list"
      />
      {parsed && parsed.errors.length > 0 && (
        <ul className="paste-errors">
          {parsed.errors.slice(0, 6).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="row center">
        <button
          className="primary"
          disabled={!parsed || (parsed.deck.length === 0 && !parsed.leader)}
          onClick={() => parsed && onImport(parsed.leader, parsed.deck)}
        >
          Import {parsed ? `(${parsed.deck.length} cards)` : ""}
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </Dialog>
  );
}

function CopyDialog({ text, onClose }: { text: string; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <Dialog title="Copy deck list" onClose={onClose}>
      <textarea
        readOnly
        value={text}
        rows={10}
        aria-label="Deck list"
        onFocus={(e) => e.target.select()}
      />
      <div className="row center">
        <button
          className="primary"
          onClick={(e) => {
            const area = e.currentTarget.closest(".modal")?.querySelector("textarea");
            navigator.clipboard.writeText(text).then(
              () => setCopied("Copied."),
              () => {
                area?.select();
                setCopied("Selected: press Ctrl+C (or ⌘C) to copy.");
              },
            );
          }}
        >
          Copy
        </button>
        <button onClick={onClose}>Close</button>
      </div>
      {copied && <p className="note">{copied}</p>}
    </Dialog>
  );
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal left"
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {children}
        <button className="ghost close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
    </div>
  );
}
