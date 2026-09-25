import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const acceptHeader = request.headers.get("accept") || "";

  // If requested by a web browser expecting HTML, render a clean UI status card
  if (acceptHeader.includes("text/html") && !acceptHeader.includes("application/json")) {
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HoneyChain Frontend • Health Status</title>
  <link rel="icon" type="image/svg+xml" href="/bee-emblem.svg">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d0a07;
      color: #fbf8f2;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
    }
    .card {
      background: #14100b;
      border: 1px solid #2a2015;
      border-radius: 16px;
      padding: 32px 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.3);
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .dot {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      box-shadow: 0 0 8px #22c55e;
    }
    h1 {
      color: #f59e0b;
      font-size: 24px;
      margin: 0 0 8px;
    }
    p {
      color: #a89f91;
      font-size: 14px;
      margin: 0 0 24px;
      line-height: 1.5;
    }
    .meta {
      background: #1c160f;
      border: 1px solid #2a2015;
      border-radius: 10px;
      padding: 14px;
      text-align: left;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      color: #d4cfc5;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .row:last-child {
      margin-bottom: 0;
    }
    .label {
      color: #78716c;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <span class="dot"></span>
      Operational
    </div>
    <h1>HoneyChain Frontend</h1>
    <p>The Next.js App Router client portal is running smoothly and responsive to requests.</p>
    <div class="meta">
      <div class="row">
        <span class="label">Status:</span>
        <span style="color:#4ade80; font-weight:600;">200 OK</span>
      </div>
      <div class="row">
        <span class="label">Service:</span>
        <span>honeychain-frontend</span>
      </div>
      <div class="row">
        <span class="label">Timestamp:</span>
        <span>${new Date().toISOString()}</span>
      </div>
    </div>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  // Otherwise, return JSON
  return NextResponse.json({
    status: "ok",
    service: "honeychain-frontend",
    timestamp: new Date().toISOString(),
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
