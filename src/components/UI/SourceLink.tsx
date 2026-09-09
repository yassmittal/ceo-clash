import { AUTHOR } from "@/author";
import { GithubMark } from "./GithubMark";

/**
 * "Read the source" — the standing invitation in the chrome.
 *
 * The game is open source, so the link belongs in the game rather than only in
 * the README nobody opens. It is a link *out* of the product, so it never takes
 * the loud rung: it borrows the mono icon-button idiom in the corner and the
 * quiet mono line on the screens, never the skewed neon `.btn`.
 */
export function SourceLink({
  label = "SOURCE",
  className = "source-link",
  markSize = 12,
  hideLabelWhenNarrow = false,
}: {
  label?: string;
  className?: string;
  markSize?: number;
  /** Drops to the bare mark on phones, where the corner row is tight. */
  hideLabelWhenNarrow?: boolean;
}) {
  return (
    <a
      href={AUTHOR.repoUrl}
      target="_blank"
      rel="noreferrer"
      title={`View the source on GitHub — ${AUTHOR.handle}/ceo-clash`}
      /* The label is hidden on phones, so the name has to live on the element
         rather than in the text — one accessible name at every width. */
      aria-label={label}
      className={className}
    >
      <GithubMark size={markSize} />
      <span className={hideLabelWhenNarrow ? "label-wide" : undefined}>{label}</span>
    </a>
  );
}
