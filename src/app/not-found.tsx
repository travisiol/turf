import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap flex min-h-[60svh] flex-col items-start justify-center">
      <p className="eyebrow">404</p>
      <h1 className="display mt-3 text-[clamp(44px,7vw,88px)]">Nothing down here.</h1>
      <Link href="/" className="btn btn-ink mt-8">
        Back to the start
      </Link>
    </div>
  );
}
