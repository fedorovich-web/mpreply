"use client";

import { useEffect } from "react";
import Link from "next/link";

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    // Log error for client observability without leaking secrets
    console.error("Application error captured by boundary:", error.message);
  }, [error]);

  return (
    <div
      className="not-found-render-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="public-container"
        style={{ padding: "4rem 1rem", textAlign: "center", maxWidth: "640px" }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #dbeafe",
            padding: "2.5rem 2rem",
            boxShadow: "0 10px 25px -5px rgba(11, 104, 246, 0.08)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "#eff6ff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1.25rem",
              color: "#0b68f6",
            }}
            aria-hidden="true"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "#071846",
              marginBottom: "0.75rem",
            }}
          >
            Произошла непредвиденная ошибка
          </h1>
          <p
            style={{
              color: "#475569",
              lineHeight: 1.6,
              marginBottom: "1.5rem",
            }}
          >
            Мы уже зафиксировали проблему. Попробуйте повторить запрос или вернитесь на главную страницу сервиса.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: "0.8125rem",
                color: "#94a3b8",
                marginBottom: "1.5rem",
                fontFamily: "monospace",
              }}
            >
              Код обращения: {error.digest}
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="button button-primary"
              onClick={() => reset()}
              style={{ minWidth: "160px" }}
            >
              Повторить попытку
            </button>
            <Link
              href="/"
              className="button button-secondary"
              style={{ minWidth: "160px" }}
            >
              На главную
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
