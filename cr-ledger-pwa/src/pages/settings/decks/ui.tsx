import { cx } from "../../../lib/cx";

export function Spinner({ className }: { className?: string }) {
	return (
		<span
			className={cx(
				"inline-block animate-spin rounded-full border-2 border-black/20 border-t-black/70",
				className ?? "h-4 w-4"
			)}
			aria-hidden="true"
		/>
	);
}
