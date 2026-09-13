"use client";

import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "@/components/theme/ThemeToggle";
import Button from "@/components/ui/Button";
import { useAuth } from "@/components/providers/AuthProvider";
import { IconLogout } from "@tabler/icons-react";

const navLinks = [
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Features", href: "/#features" },
  { label: "Map", href: "/#map" },
  { label: "Verify A Jar", href: "/verify" },
  { label: "About", href: "/about" },
];

export default function Header() {
  const { user, logout } = useAuth();

  const dashboardHref =
    user?.role === "admin" || user?.role === "auditor"
      ? "/authority/dashboard"
      : user?.role === "beekeeper"
      ? "/farmer/dashboard"
      : user?.role === "lab"
      ? "/lab/dashboard"
      : user?.role === "processor"
      ? "/processor/dashboard"
      : user?.role === "distributor" || user?.role === "transporter"
      ? "/distributor/dashboard"
      : "/login";

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-ink/5 bg-paper/70 px-4 py-5 backdrop-blur-md dark:border-ink-dark/5 dark:bg-paper-dark/70 md:px-8">
      <Link href="/" className="group flex items-center gap-2.5">
        <div className="relative h-9 w-9 shrink-0">
          <Image
            src="/images/logo/logo.png"
            alt="HoneyChain logo"
            fill
            priority
            sizes="36px"
            className="object-contain transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <span className="font-mono text-xl italic text-ink transition-colors group-hover:text-honey dark:text-ink-dark">
          HoneyChain
        </span>
      </Link>

      <nav className="hidden items-center gap-8 text-sm text-ink/70 dark:text-ink-dark/70 md:flex">
        {navLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="transition-colors hover:text-honey"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <ThemeToggle />

        {user ? (
          <>
            <Link href={dashboardHref}>
              <Button size="sm" variant="outline">
                Dashboard
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={logout}>
              <IconLogout size={16} stroke={1.75} />
              Sign out
            </Button>
          </>
        ) : (
          <Link href="/login">
            <Button size="sm" variant="outline">
              Sign in
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}