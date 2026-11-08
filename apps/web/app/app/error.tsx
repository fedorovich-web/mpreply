"use client";

import { useEffect } from "react";
import Link from "next/link";

interface WorkspaceErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function WorkspaceError({ error, reset }: WorkspaceErrorProps) {
  useEffect(() => {
    // Log workspace operational error without leaking credentials or tokens
    console.error("Workspace error captured by boundary:", error.message);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "2rem 1rem",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          width: "100%",
          backgroundColor: "#ffffff",
          borderRadius: "14px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 12px rgba(15, 23, 42, 0.05)",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            backgroundColor: "#fef2f2",
            color: "#ef4444",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1rem",
          }}
          aria-hidden="true"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "#0f172a",
            marginBottom: "0.5rem",
          }}
        >
          Не удалось загрузить раздел рабочей области
        </h2>
        <p
          style={{
            fontSize: "0.875rem",
            color: "#64748b",
            lineHeight: 1.5,
            marginBottom: "1.25rem",
          }}
        >
          Возникла ошибка при обработке данных кабинета. Ваши интеграции и настройки сохранены в безопасности.
        </p>
        {error.digest && (
          <p
            style={{
              fontSize: "0.75rem",
              color: "#94a3b8",
              marginBottom: "1.25rem",
              fontFamily: "monospace",
            }}
          >
            Код операции: {error.digest}
          </p>
        )}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#0b68f6",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 500,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Повторить попытку
          </button>
          <Link
            href="/app/dashboard"
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#f8fafc",
              color: "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              fontWeight: 500,
              fontSize: "0.875rem",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            В дашборд
          </Link>
        </div>
      </div>
    </div>
  );
}
