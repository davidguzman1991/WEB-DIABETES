import { useState } from "react";
import Link from "next/link";

export default function Navigation({ title, links = [] }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="nav">
      <div className="nav-title">{title}</div>
      <button type="button" className="nav-toggle" onClick={() => setOpen((prev) => !prev)}>
        {open ? "Cerrar" : "Menu"}
      </button>
      <nav className={`nav-links ${open ? "open" : ""}`}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
