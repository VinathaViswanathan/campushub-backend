#!/usr/bin/env bash
# CampusHub Lab 3 regression test against docs/openapi.yaml.
# Prereqs (in another terminal):  npm run seed && npm run dev
# Run:                             npm run test:smoke
# Re-run `npm run seed` before each run: the tests create reservations.

BASE="${BASE:-http://localhost:3000/api/v1}"
PASS=0
FAIL=0
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

req() { # method path [json]
  local method=$1 path=$2 data=${3:-}
  if [ -n "$data" ]; then
    STATUS=$(curl -s -o "$BODY_FILE" -w '%{http_code}' -X "$method" "$BASE$path" \
      -H 'Content-Type: application/json' --data "$data")
  else
    STATUS=$(curl -s -o "$BODY_FILE" -w '%{http_code}' -X "$method" "$BASE$path")
  fi
  BODY=$(cat "$BODY_FILE")
}

pass() { echo "PASS  $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL  $1"; echo "      got $STATUS: $BODY"; FAIL=$((FAIL + 1)); }

# check NAME STATUS [SUBSTRING]
check() {
  local name=$1 exp=$2 needle=${3:-}
  if [ "$STATUS" = "$exp" ] && { [ -z "$needle" ] || [[ "$BODY" == *"$needle"* ]]; }; then
    pass "$name"
  else
    fail "$name (expected $exp${needle:+ containing $needle})"
  fi
}

# js EXPRESSION -> evaluates against parsed BODY as `b`
js() { node -e "const b=JSON.parse(process.argv[1]); process.stdout.write(String($1))" "$BODY" 2>/dev/null; }

# checkjs NAME STATUS JS_BOOLEAN
checkjs() {
  local name=$1 exp=$2 cond=$3
  if [ "$STATUS" = "$exp" ] && [ "$(js "$cond")" = "true" ]; then pass "$name"; else fail "$name"; fi
}

echo "Testing $BASE"
req GET /resources
if [ "$STATUS" = "000" ]; then
  echo "Server not reachable. Start MongoDB, then run: npm run seed && npm run dev"
  exit 1
fi

RID=$(js "(b.find(r => r.name === 'Robotics Lab') || {}).id")
UNAVAIL=$(js "(b.find(r => r.name === 'Chemistry Lab 2') || {}).id")
if [ -z "$RID" ] || [ -z "$UNAVAIL" ]; then
  echo "Seed data missing. Run: npm run seed"
  exit 1
fi

H='"userId":"user-789"'

echo "--- GET /resources"
checkjs "1  list all -> 200, 5 resources" 200 "Array.isArray(b) && b.length === 5"
checkjs "1b response has exactly the spec'd fields" 200 \
  "b.every(r => Object.keys(r).sort().join() === 'id,isAvailable,location,name,type')"
req GET "/resources?type=ROOM"
checkjs "2  ?type=ROOM -> only rooms" 200 "b.length === 2 && b.every(r => r.type === 'ROOM')"
req GET "/resources?type=FOO"
checkjs "3  ?type=FOO -> 200 []" 200 "Array.isArray(b) && b.length === 0"
req GET "/resources?type="
check "4  ?type= (empty) -> 400" 400 '"code":"VALIDATION_ERROR"'

echo "--- POST /reservations"
req POST /reservations "{\"resourceId\":\"$RID\",$H,\"startTime\":\"2026-12-01T10:00:00Z\",\"endTime\":\"2026-12-01T11:00:00Z\"}"
checkjs "5  valid -> 201 PENDING, spec'd fields only" 201 \
  "b.status === 'PENDING' && Object.keys(b).sort().join() === 'endTime,id,resourceId,startTime,status,userId'"
req POST /reservations "{\"resourceId\":\"$RID\",$H,\"startTime\":\"2026-12-01T10:00:00Z\",\"endTime\":\"2026-12-01T11:00:00Z\"}"
check "6  same slot -> 409 DOUBLE_BOOKING" 409 '"code":"DOUBLE_BOOKING"'
req POST /reservations "{\"resourceId\":\"$RID\",$H,\"startTime\":\"2026-12-01T10:30:00Z\",\"endTime\":\"2026-12-01T11:30:00Z\"}"
check "6b partial overlap -> 409 DOUBLE_BOOKING" 409 '"code":"DOUBLE_BOOKING"'
req POST /reservations "{\"resourceId\":\"$RID\",$H,\"startTime\":\"2026-12-01T11:00:00Z\",\"endTime\":\"2026-12-01T12:00:00Z\"}"
check "6c back-to-back slot -> 201" 201 '"status":"PENDING"'
req POST /reservations "{\"resourceId\":\"res-999\",$H,\"startTime\":\"2026-12-02T10:00:00Z\",\"endTime\":\"2026-12-02T11:00:00Z\"}"
check "7  resourceId res-999 -> 404" 404 '"code":"RESOURCE_NOT_FOUND"'
req POST /reservations "{\"resourceId\":\"000000000000000000000000\",$H,\"startTime\":\"2026-12-02T10:00:00Z\",\"endTime\":\"2026-12-02T11:00:00Z\"}"
check "7b well-formed but unknown id -> 404" 404 '"code":"RESOURCE_NOT_FOUND"'
req POST /reservations "{\"resourceId\":\"$UNAVAIL\",$H,\"startTime\":\"2026-12-02T10:00:00Z\",\"endTime\":\"2026-12-02T11:00:00Z\"}"
check "8  unavailable resource -> 409" 409 '"code":"RESOURCE_UNAVAILABLE"'
req POST /reservations "{\"resourceId\":\"$RID\",$H,\"startTime\":\"2026-12-03T11:00:00Z\",\"endTime\":\"2026-12-03T10:00:00Z\"}"
check "9  endTime before startTime -> 400" 400 '"code":"VALIDATION_ERROR"'
req POST /reservations "{\"resourceId\":\"$RID\",\"startTime\":\"2026-12-03T10:00:00Z\",\"endTime\":\"2026-12-03T11:00:00Z\"}"
check "10 missing userId -> 400" 400 '"code":"VALIDATION_ERROR"'
req POST /reservations "{\"resourceId\":\"$RID\",$H,\"startTime\":\"2026-12-03T10:00:00Z\",\"endTime\":\"2026-12-03T11:00:00Z\",\"status\":\"CONFIRMED\"}"
check "11 client sends status -> 400" 400 '"code":"VALIDATION_ERROR"'
req POST /reservations "{\"resourceId\":\"$RID\",$H,\"startTime\":\"2026-12-03T10:00:00\",\"endTime\":\"2026-12-03T11:00:00Z\"}"
check "12 startTime without timezone -> 400" 400 '"code":"VALIDATION_ERROR"'
req POST /reservations '{"resourceId": "abc", '
check "13 malformed JSON -> 400 INVALID_JSON" 400 '"code":"INVALID_JSON"'

echo "--- GET /reservations/user/{userId}"
req GET /reservations/user/user-456
checkjs "14 user-456 -> 2 active, sorted, cancelled excluded" 200 \
  "b.length === 2 && b[0].startTime < b[1].startTime && b.every(r => r.status !== 'CANCELLED')"
req GET /reservations/user/nobody
checkjs "15 unknown user -> 200 []" 200 "Array.isArray(b) && b.length === 0"

echo "--- Routes outside the contract"
req GET /does-not-exist
check "16 unknown route -> 404 NOT_FOUND" 404 '"code":"NOT_FOUND"'
req GET /reservations
check "17 GET /reservations (not in spec) -> 404" 404 '"code":"NOT_FOUND"'

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
