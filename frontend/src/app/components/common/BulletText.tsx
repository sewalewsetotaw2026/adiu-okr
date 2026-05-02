import { normalizeBulletTextForDisplay } from "../../utils/bulletText";

type Props = {
  text?: string | null;
  className?: string;
  emptyFallback?: React.ReactNode;
};

export default function BulletText({
  text,
  className,
  emptyFallback = null,
}: Props) {
  const content = normalizeBulletTextForDisplay(text);

  if (!content) {
    return <>{emptyFallback}</>;
  }

  const lines = content.split("\n");

  return (
    <div className={className}>
      {lines.map((line, index) => {
        const bulletMatch = line.match(/^(\s*)[\u2022\u25CF]\s+(.*)$/);

        if (bulletMatch) {
          const indent = bulletMatch[1]?.length ?? 0;
          const itemText = bulletMatch[2] ?? "";

          return (
            <div
              key={`bullet-${index}`}
              className="flex items-start gap-2"
              style={
                indent > 0
                  ? { paddingLeft: `${Math.min(indent * 0.5, 3)}rem` }
                  : undefined
              }
            >
              <span
                aria-hidden="true"
                className="pt-[0.1em] text-[1.08em] font-semibold leading-none"
              >
                •
              </span>
              <span className="whitespace-pre-wrap">{itemText}</span>
            </div>
          );
        }

        if (!line.trim()) {
          return <div key={`blank-${index}`} className="h-2" />;
        }

        return (
          <p key={`text-${index}`} className="whitespace-pre-wrap">
            {line}
          </p>
        );
      })}
    </div>
  );
}
