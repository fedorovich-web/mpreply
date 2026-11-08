"use client";

import { useEffect } from "react";
import Link from "next/link";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Global application error:", error.message);
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafd",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          color: "#071846",
        }}
      >
        <div
          style={{
            maxWidth: "540px",
            width: "90%",
            margin: "2rem auto",
            padding: "2.5rem 2rem",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #dbeafe",
            boxShadow: "0 10px 25px -5px rgba(11, 104, 246, 0.08)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              backgroundColor: "#eff6ff",
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
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#071846",
              marginBottom: "0.75rem",
            }}
          >
            Критический сбой приложения
          </h1>
          <p
            style={{
              color: "#475569",
              fontSize: "0.9375rem",
              lineHeight: 1.5,
              marginBottom: "1.5rem",
            }}
          >
            Не удалось загрузить базовую оболочку сайта. Попробуйте обновить страницу или обратиться в техническую поддержку.
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
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "0.625rem 1.25rem",
                backgroundColor: "#0b68f6",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.9375rem",
                cursor: "pointer",
              }}
            >
              Повторить попытку
            </button>
            <Link
              href="/"
              style={{
                padding: "0.625rem 1.25rem",
                backgroundColor: "#f1f5f9",
                color: "#071846",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.9375rem",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              На главную
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
