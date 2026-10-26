import { useState, type ChangeEvent } from "react";
import { BACK_PRESETS, presetChoice, readBackImage, type BackChoice } from "./card-backs.js";
import { CardView } from "./CardView.js";

/** Pick a card back for one side: one of the built-in designs, or an uploaded picture. */
export function BackPicker({
  label,
  choice,
  onChange,
}: {
  label: string;
  choice: BackChoice;
  /** Returns false when the choice can't be kept for next time. */
  onChange: (choice: BackChoice) => boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const uploaded = choice.startsWith("data:") ? choice : null;

  const pick = (next: BackChoice) => {
    const saved = onChange(next);
    setMessage(saved ? null : "Using it for now, but this browser won't keep it for next time.");
  };

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      pick(await readBackImage(file));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="back-picker">
      <strong>{label}</strong>
      <div className="back-options" role="radiogroup" aria-label={label}>
        {BACK_PRESETS.map((preset) => {
          const value = presetChoice(preset.id);
          return (
            <BackOption
              key={preset.id}
              name={preset.name}
              image={preset.image}
              selected={choice === value}
              onPick={() => pick(value)}
            />
          );
        })}
        {uploaded && (
          <BackOption name="Your picture" image={uploaded} selected onPick={() => pick(uploaded)} />
        )}
      </div>
      <div className="row">
        <label className="button small">
          Upload image
          <input type="file" accept="image/*" onChange={(e) => void upload(e)} />
        </label>
      </div>
      {message && <p className="note">{message}</p>}
    </div>
  );
}

function BackOption({
  name,
  image,
  selected,
  onPick,
}: {
  name: string;
  image: string | null;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      className={`back-option ${selected ? "selected" : ""}`}
      role="radio"
      aria-checked={selected}
      aria-label={name}
      title={name}
      onClick={onPick}
    >
      <CardView faceDown back={image} size="small" label={name} />
      <span>{name}</span>
    </button>
  );
}
