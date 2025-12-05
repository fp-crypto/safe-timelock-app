export interface InputFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  mono?: boolean;
  helper?: string;
}

export function InputField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  mono,
  helper,
}: InputFieldProps) {
  return (
    <div className="input-field">
      <label>{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={mono ? 'mono' : ''}
          rows={3}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={mono ? 'mono' : ''}
        />
      )}
      {helper && <span className="helper">{helper}</span>}
    </div>
  );
}
