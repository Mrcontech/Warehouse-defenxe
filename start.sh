#!/usr/bin/env bash
# Run the EBSU data warehouse demo (start MySQL first).
cd "$(dirname "$0")" && node scripts/start.mjs "$@"
