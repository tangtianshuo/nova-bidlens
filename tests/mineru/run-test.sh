#!/bin/bash
set -e
PDF_NAME="$1"
if [ -z "$PDF_NAME" ]; then
  echo "Usage: ./run-test.sh <pdf-filename>"
  echo "  PDF must be in tests/mineru/fixtures/"
  exit 1
fi

echo "=== Running MinerU on $PDF_NAME ==="
docker compose exec mineru mineru \
  -p "/input/$PDF_NAME" \
  -o "/output" \
  -b pipeline \
  -m auto \
  -l ch

echo "=== Output files ==="
ls -la "output/${PDF_NAME%.*}/"

echo "=== content_list.json preview (first 50 lines) ==="
head -50 "output/${PDF_NAME%.*}/${PDF_NAME%.*}_content_list.json"
