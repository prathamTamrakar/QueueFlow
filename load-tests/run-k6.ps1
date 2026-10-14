# Load test runner for QueueFlow using Dockerized k6
param (
    [string]$Scenario = "01-enqueue-throughput.js"
)

Write-Host "🚀 Running k6 scenario: $Scenario" -ForegroundColor Cyan

docker run --rm -i `
  -v "${PWD}/load-tests:/scripts" `
  grafana/k6 run `
  -e API_URL=http://host.docker.internal:4000 `
  "/scripts/$Scenario"
