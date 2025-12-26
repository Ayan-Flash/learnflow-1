import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";

export interface NavigationProps {
  role: "teacher" | "institution";
  onRefresh?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ role, onRefresh }) => {
  const router = useRouter();

  return (
    <div className="header">
      <div className="brand">
        <h1>LearnFlow AI — Dashboard</h1>
        <p>
          Role: <strong>{role === "teacher" ? "Teacher" : "Institution"}</strong>
        </p>
      </div>

      <nav className="nav" aria-label="Dashboard navigation">
        <Link className="button" href="/" aria-current={router.pathname === "/" ? "page" : undefined}>
          Home
        </Link>
        <Link className="button" href="/teacher" aria-current={router.pathname === "/teacher" ? "page" : undefined}>
          Teacher
        </Link>
        <Link
          className="button"
          href="/institution"
          aria-current={router.pathname === "/institution" ? "page" : undefined}
        >
          Institution
        </Link>
        <button type="button" className="button primary" onClick={onRefresh}>
          Refresh
        </button>
      </nav>
    </div>
  );
};
