import type { ResourceSettingsFormValue } from "../client/resourceSettings";

interface Props {
  value: ResourceSettingsFormValue;
  onChange: (value: ResourceSettingsFormValue) => void;
}

export function SettingsPanel({ value, onChange }: Props) {
  return (
    <section className="panel settings-panel" aria-label="Resource settings">
      <h2>Settings</h2>
      <NumberField
        label="GPU memory limit"
        min={16}
        value={value.gpuMemoryLimitMiB}
        unit="MiB"
        onChange={(gpuMemoryLimitMiB) => onChange({ ...value, gpuMemoryLimitMiB })}
      />
      <NumberField
        label="System memory limit"
        min={16}
        value={value.systemMemoryLimitMiB}
        unit="MiB"
        onChange={(systemMemoryLimitMiB) => onChange({ ...value, systemMemoryLimitMiB })}
      />
      <NumberField
        label="Concurrent chunk requests"
        min={1}
        max={64}
        value={value.concurrentChunkRequests}
        onChange={(concurrentChunkRequests) => onChange({ ...value, concurrentChunkRequests })}
      />
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field numeric-field">
      <span>{label}</span>
      <span className="number-input-row">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
        {unit ? <span className="unit">{unit}</span> : null}
      </span>
    </label>
  );
}