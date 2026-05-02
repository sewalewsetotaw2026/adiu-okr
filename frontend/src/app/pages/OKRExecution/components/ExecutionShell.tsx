import { Link } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import { MdChevronRight } from "react-icons/md";

export type ExecutionCrumb = {
  label: string;
  to?: string;
};

type Props = {
  breadcrumbs: ExecutionCrumb[];
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export default function ExecutionShell({
  breadcrumbs,
  title,
  subtitle,
  icon,
  actions,
  children,
}: Props) {
  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 pb-10">
      <nav
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm pt-1"
        aria-label="Breadcrumb"
      >
        {breadcrumbs.map((b, i) => (
          <span key={`${b.label}-${i}`} className="flex items-center gap-2">
            {i > 0 && (
              <MdChevronRight className="text-gray-300 shrink-0 text-lg" />
            )}
            {b.to ? (
              <Link
                to={b.to}
                className="text-gray-500 hover:text-gray-800 transition-colors"
              >
                {b.label}
              </Link>
            ) : (
              <span className="text-gray-800 font-medium">{b.label}</span>
            )}
          </span>
        ))}
      </nav>

      <PageHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            {icon ? (
              <span className="rounded-xl bg-white/15 p-2 ring-1 ring-white/20 shrink-0 text-white">
                {icon}
              </span>
            ) : null}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {title}
              </h1>
              {subtitle ? (
                <p className="text-white/85 text-sm mt-1 max-w-2xl">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </PageHeader>

      <div className="space-y-8">{children}</div>
    </div>
  );
}
