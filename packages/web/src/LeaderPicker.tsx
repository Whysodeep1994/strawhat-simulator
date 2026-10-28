import { setOf } from "@strawhat/engine";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  officialText,
  setLabel,
  type Card,
  type CardData,
  type LeaderTip,
  type PlayableDeck,
} from "./card-data.js";
import { COLOR_NAMES } from "./CardPrint.js";

/** A heading in the deck list, with the decks under it. */
export interface DeckGroup {
  label: string;
  decks: PlayableDeck[];
}

/** A choice that isn't a deck, such as "A random Quick deck". */
export interface ExtraChoice {
  id: string;
  title: string;
  hint: string;
}

/** Your decks, then the official starters, then the practice decks; empty groups are left out. */
export function deckGroups(mine: PlayableDeck[], quick: PlayableDeck[]): DeckGroup[] {
  return [
    { label: "My decks", decks: mine },
    { label: "Official starter decks", decks: quick.filter((d) => d.official) },
    { label: "Practice decks", decks: quick.filter((d) => !d.official) },
  ].filter((g) => g.decks.length > 0);
}

/** The line under a Leader's name: which deck it is. */
export function deckSubtitle(deck: PlayableDeck): string {
  if (deck.mine) return deck.name;
  return deck.official ? deck.name : `${setLabel(setOf(deck.leader))} practice deck`;
}

/** Does the deck match what was typed in the search box? */
export function deckMatches(deck: PlayableDeck, data: CardData, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const leader = data.catalog[deck.leader];
  const words = [
    leader?.name ?? "",
    deck.name,
    deck.leader,
    setLabel(setOf(deck.leader)),
    ...(leader?.colors ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((part) => words.includes(part));
}

interface Place {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

/**
 * A dropdown of decks shown by their Leader cards. Open it to skim every Leader's picture; the
 * one you point at (or move to with the arrow keys) shows its ability and a tip on the right.
 */
export function LeaderPicker({
  data,
  groups,
  value,
  onChange,
  label,
  extra,
}: {
  data: CardData;
  groups: DeckGroup[];
  value: string;
  onChange: (id: string) => void;
  /** Read out to screen readers, e.g. "Your deck". */
  label: string;
  extra?: ExtraChoice;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();
  const optionId = (id: string) => `${listId}-${id}`;

  const all = groups.flatMap((g) => g.decks);
  const chosen = all.find((d) => d.id === value);
  const shown = groups
    .map((g) => ({ ...g, decks: g.decks.filter((d) => deckMatches(d, data, query)) }))
    .filter((g) => g.decks.length > 0);
  const showExtra = extra !== undefined && query.trim() === "";
  const options = [
    ...(showExtra ? [extra.id] : []),
    ...shown.flatMap((g) => g.decks.map((d) => d.id)),
  ];
  // The highlighted option: the one you pointed at, or the first one that matches the search.
  const current = active !== null && options.includes(active) ? active : (options[0] ?? null);
  const previewId = current ?? value;
  const preview = all.find((d) => d.id === previewId);

  const close = (refocus: boolean) => {
    setOpen(false);
    setPlace(null);
    setQuery("");
    if (refocus) button.current?.focus();
  };
  const pick = (id: string) => {
    onChange(id);
    close(true);
  };

  // Sit under the button (or over it when there's no room below), inside the window.
  useLayoutEffect(() => {
    if (!open) return;
    const placeIt = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(780, vw - 24);
      const left = Math.max(12, Math.min(r.left, vw - width - 12));
      const below = vh - r.bottom - 12;
      const above = r.top - 12;
      const up = below < 320 && above > below;
      setPlace(
        up
          ? { left, width, bottom: vh - r.top + 6, maxHeight: Math.min(600, above - 6) }
          : { left, width, top: r.bottom + 6, maxHeight: Math.min(600, Math.max(240, below - 6)) },
      );
    };
    placeIt();
    const onScroll = (e: Event) => {
      if (!pop.current?.contains(e.target as Node)) placeIt();
    };
    window.addEventListener("resize", placeIt);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", placeIt);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // Clicking anywhere else closes the list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (pop.current?.contains(target) || button.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  });

  // Once it's open and placed: type to search straight away, starting on the deck you have now.
  const placed = place !== null;
  useEffect(() => {
    if (!open || !placed) return;
    setActive(value);
    search.current?.focus();
    reveal(optionId(value), true);
  }, [open, placed]);

  const move = (step: number) => {
    if (options.length === 0) return;
    const at = current ? options.indexOf(current) : -1;
    const next = options[Math.max(0, Math.min(options.length - 1, at + step))]!;
    setActive(next);
    reveal(optionId(next), false);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") move(1);
    else if (e.key === "ArrowUp") move(-1);
    else if (e.key === "PageDown") move(6);
    else if (e.key === "PageUp") move(-6);
    else if (e.key === "Enter" && current) pick(current);
    else if (e.key === "Escape") close(true);
    else if (e.key === "Tab") close(false);
    else return;
    e.preventDefault();
    // Escape closes the list, not the whole screen.
    e.stopPropagation();
  };

  const style: CSSProperties | undefined = place
    ? {
        left: place.left,
        width: place.width,
        top: place.top,
        bottom: place.bottom,
        maxHeight: place.maxHeight,
      }
    : { visibility: "hidden" };

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`leader-pick ${open ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${chosen ? `${data.catalog[chosen.leader]?.name ?? chosen.name}, ${deckSubtitle(chosen)}` : (extra?.title ?? "none chosen")}`}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {chosen ? (
          <DeckRowFace deck={chosen} data={data} />
        ) : extra && value === extra.id ? (
          <ExtraFace extra={extra} />
        ) : (
          <span className="leader-row-text">
            <strong>Choose a deck…</strong>
          </span>
        )}
        <span className="leader-pick-arrow" aria-hidden="true">
          ▾
        </span>
      </button>

      {open &&
        createPortal(
          <div ref={pop} className="leader-pop" style={style} onKeyDown={onKey}>
            <div className="leader-pop-list">
              <input
                ref={search}
                type="search"
                className="leader-search"
                placeholder="Search a Leader, colour or set…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={current ? optionId(current) : undefined}
                aria-label={`${label}: search`}
              />
              <div id={listId} role="listbox" aria-label={label} className="leader-options">
                {showExtra && (
                  <div
                    id={optionId(extra.id)}
                    role="option"
                    aria-selected={value === extra.id}
                    className={optionClass(extra.id, value, current)}
                    onPointerEnter={() => setActive(extra.id)}
                    onClick={() => pick(extra.id)}
                  >
                    <ExtraFace extra={extra} />
                  </div>
                )}
                {shown.map((group) => (
                  <div key={group.label} role="group" aria-label={group.label}>
                    <div className="leader-group" aria-hidden="true">
                      {group.label} <span className="count">{group.decks.length}</span>
                    </div>
                    {group.decks.map((deck) => (
                      <div
                        key={deck.id}
                        id={optionId(deck.id)}
                        role="option"
                        aria-selected={value === deck.id}
                        className={optionClass(deck.id, value, current)}
                        onPointerEnter={() => setActive(deck.id)}
                        onClick={() => pick(deck.id)}
                      >
                        <DeckRowFace deck={deck} data={data} />
                      </div>
                    ))}
                  </div>
                ))}
                {options.length === 0 && (
                  <p className="note leader-none">No Leader matches that.</p>
                )}
              </div>
            </div>
            <div className="leader-pop-preview" aria-live="polite">
              {preview ? (
                <LeaderDetails deck={preview} data={data} />
              ) : extra && previewId === extra.id ? (
                <p className="note">{extra.hint}</p>
              ) : null}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Scroll the list (only the list, never the page) so the option is in view. */
function reveal(id: string, center: boolean) {
  const option = document.getElementById(id);
  const list = option?.closest<HTMLElement>(".leader-options");
  if (!option || !list) return;
  const top = option.offsetTop;
  const bottom = top + option.offsetHeight;
  if (center) list.scrollTop = top - (list.clientHeight - option.offsetHeight) / 2;
  else if (top < list.scrollTop) list.scrollTop = top;
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
}

function optionClass(id: string, value: string, active: string | null): string {
  return ["leader-option", id === value ? "chosen" : "", id === active ? "active" : ""].join(" ");
}

/** A deck as one row: a small picture of its Leader card, its name, deck and colours. */
function DeckRowFace({ deck, data }: { deck: PlayableDeck; data: CardData }) {
  const leader = data.catalog[deck.leader];
  const art = data.imageUrl(leader);
  return (
    <>
      <span className="leader-thumb">
        {art ? <img src={art} alt="" loading="lazy" draggable={false} /> : null}
      </span>
      <span className="leader-row-text">
        <strong>{leader?.name ?? deck.name}</strong>
        <span>{deckSubtitle(deck)}</span>
        <span className="leader-colors">
          <ColorDots leader={leader} />
          {leader ? `Life ${leader.life ?? "?"} · ${leader.power ?? "?"} power` : ""}
        </span>
      </span>
    </>
  );
}

function ExtraFace({ extra }: { extra: ExtraChoice }) {
  return (
    <>
      <span className="leader-thumb mystery" aria-hidden="true">
        ?
      </span>
      <span className="leader-row-text">
        <strong>{extra.title}</strong>
        <span>{extra.hint}</span>
      </span>
    </>
  );
}

function ColorDots({ leader }: { leader: Card | undefined }) {
  return (
    <>
      {(leader?.colors ?? []).map((c) => (
        <i key={c} className="color-dot" style={{ background: `var(--c-${c})` }} title={c} />
      ))}
    </>
  );
}

/** The big view in the open list: the Leader card, its ability and how to play the deck. */
function LeaderDetails({ deck, data }: { deck: PlayableDeck; data: CardData }) {
  const leader = data.catalog[deck.leader];
  const art = data.imageUrl(leader);
  return (
    <>
      <div className="leader-pop-card">
        {art ? <img src={art} alt={leader?.name ?? ""} draggable={false} /> : null}
        <div>
          <strong>{leader?.name ?? deck.name}</strong>
          <span>{deckSubtitle(deck)}</span>
          <span>
            {(leader?.colors ?? []).map((c) => COLOR_NAMES[c]).join(" / ")} · Life{" "}
            {leader?.life ?? "?"} · {leader?.power ?? "?"} power
          </span>
        </div>
      </div>
      <LeaderInfo leader={leader} tip={data.tips[deck.leader]} />
    </>
  );
}

/** A Leader's official ability, and (when there is one) a tip on how to play its deck. */
export function LeaderInfo({
  leader,
  tip,
}: {
  leader: Card | undefined;
  tip?: LeaderTip | undefined;
}) {
  const lines = leader ? officialText(leader) : [];
  return (
    <div className="leader-info">
      <div className="leader-ability">
        <h3>Leader ability</h3>
        {lines.length ? (
          lines.map((line) => <p key={line}>{withKeywords(line)}</p>)
        ) : (
          <p>No ability: this Leader just attacks.</p>
        )}
      </div>
      {tip && (
        <div className="leader-tip">
          <h3>How to play it</h3>
          <p>{tip.tip}</p>
          <p className="leader-tip-source">
            Based on{" "}
            <a href={tip.source} target="_blank" rel="noreferrer">
              {tip.sourceName}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

/** Card text with its [keywords] picked out, the way they're printed on cards. */
function withKeywords(line: string) {
  return line.split(/(\[[^\]]+\])/).map((part, i) =>
    /^\[.*\]$/.test(part) ? (
      <b key={i} className="kw">
        {part}
      </b>
    ) : (
      part
    ),
  );
}
