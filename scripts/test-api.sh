#!/usr/bin/env bash
# Manual contract tests for Lab 2. Start the server first: npm run dev
# Usage: bash scripts/test-api.sh
BASE="http://localhost:3000/api/v1"

run() {
  echo; echo "=== $1"; shift
  curl -s -w "\n--> HTTP %{http_code}\n" "$@"
}

run "GET all resources (expect 200)" "$BASE/resources"
run "GET resources type=ROOM (expect 200, filtered)" "$BASE/resources?type=ROOM"
run "GET resources type=STUDY_ROOM (expect 200, [])" "$BASE/resources?type=STUDY_ROOM"
run "GET resources type= empty (expect 400 VALIDATION_ERROR)" "$BASE/resources?type="

BODY='{"resourceId":"res-101","userId":"user-456","startTime":"2026-10-01T10:00:00Z","endTime":"2026-10-01T11:00:00Z"}'
run "POST reservation (expect 201)" -X POST "$BASE/reservations" -H "Content-Type: application/json" -d "$BODY"
run "POST same reservation again (expect 409 DOUBLE_BOOKING)" -X POST "$BASE/reservations" -H "Content-Type: application/json" -d "$BODY"
run "POST overlapping slot 10:30-11:30 (expect 409)" -X POST "$BASE/reservations" -H "Content-Type: application/json" \
  -d '{"resourceId":"res-101","userId":"user-789","startTime":"2026-10-01T10:30:00Z","endTime":"2026-10-01T11:30:00Z"}'
run "POST missing fields (expect 400)" -X POST "$BASE/reservations" -H "Content-Type: application/json" -d '{"resourceId":"res-101"}'
run "POST non-ISO date (expect 400)" -X POST "$BASE/reservations" -H "Content-Type: application/json" \
  -d '{"resourceId":"res-101","userId":"user-456","startTime":"10/01/2026 10am","endTime":"2026-10-01T11:00:00Z"}'
run "POST endTime before startTime (expect 400)" -X POST "$BASE/reservations" -H "Content-Type: application/json" \
  -d '{"resourceId":"res-102","userId":"user-456","startTime":"2026-10-01T11:00:00Z","endTime":"2026-10-01T10:00:00Z"}'
run "POST malformed JSON (expect 400 INVALID_JSON)" -X POST "$BASE/reservations" -H "Content-Type: application/json" -d '{"resourceId":'
run "POST unknown resource (expect 404)" -X POST "$BASE/reservations" -H "Content-Type: application/json" \
  -d '{"resourceId":"res-999","userId":"user-456","startTime":"2026-10-02T10:00:00Z","endTime":"2026-10-02T11:00:00Z"}'
run "GET reservations for user-456 (expect 200, 1 item)" "$BASE/reservations/user/user-456"
echo
