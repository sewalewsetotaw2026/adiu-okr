import { normalizeBulletTextInput } from "../../utils/bulletText";

type Props = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange"
> & {
  onValueChange: (value: string) => void;
};

export default function BulletTextarea({
  onValueChange,
  value,
  ...rest
}: Props) {
  const normalizedValue =
    typeof value === "string" ? normalizeBulletTextInput(value) : value;

  return (
    <textarea
      {...rest}
      value={normalizedValue}
      onChange={(event) =>
        onValueChange(normalizeBulletTextInput(event.target.value))
      }
    />
  );
}
