#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing dependencies..."
npm install

echo "==> Running lint..."
npm run lint

echo "==> Running tests..."
npm test

echo "==> Building..."
npm run build

echo "==> CI passed!"
