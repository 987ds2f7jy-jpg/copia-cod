param(
  [switch]$Force,
  [switch]$ListOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$AffectedFunctions = @(
  "accept-appointment",
  "accept-queue-entry",
  "accept-solicitacao-exame",
  "answer-question",
  "bootstrap-app-user",
  "cancel-appointment",
  "check-plan-coverage",
  "create-appointment",
  "create-plan-checkout",
  "create-privacy-rights-request",
  "create-question",
  "create-solicitacao-exame",
  "deactivate-account",
  "deepgram-token",
  "delete-question",
  "delete-solicitacao-exame",
  "delete-uploaded-files",
  "ensure-payment-charge",
  "finish-consulta",
  "finish-solicitacao-exame-atendimento",
  "generate-my-privacy-data-export",
  "get-admin-approval-queue",
  "get-admin-privacy-rights-queue",
  "get-finance-dashboard",
  "get-my-active-consultation",
  "get-my-plans",
  "get-my-privacy-rights-requests",
  "get-patient-payments",
  "get-patient-prontuarios",
  "get-payment-status",
  "get-professional-dashboard",
  "get-reconciliation-queue",
  "get-solicitacao-exame-atendimento",
  "get-teleconsulta-context",
  "groq-completion",
  "join-queue",
  "leave-queue",
  "login-app-user",
  "payments",
  "payments-webhook",
  "quote-service-pricing",
  "read-home-banners",
  "read-models",
  "reconcile-financial-owner",
  "record-consultation-consent",
  "record-legal-event",
  "refresh-app-session",
  "register-professional",
  "replace-availability-slots",
  "request-withdrawal",
  "retry-plan-activation",
  "review-privacy-rights-request",
  "review-professional-application",
  "set-professional-duty",
  "start-consulta-session",
  "submit-appointment-review",
  "submit-consulta-evaluation",
  "update-my-profile",
  "update-solicitacao-exame",
  "upload-file",
  "upsert-office-location",
  "upsert-professional-banking-data",
  "upsert-professional-profile",
  "upsert-prontuario",
  "zoom-token"
)

if ($AffectedFunctions -contains "simulate-payment-paid") {
  throw "simulate-payment-paid must not be deployed to staging by this script."
}

Write-Host "Affected staging Edge Functions ($($AffectedFunctions.Count)):"
$AffectedFunctions | ForEach-Object { Write-Host " - $_" }

if ($ListOnly) {
  Write-Host "ListOnly mode: no deploy executed."
  exit 0
}

if (-not $Force) {
  $confirmation = Read-Host "Type DEPLOY to deploy these Functions using the linked Supabase project"
  if ($confirmation -ne "DEPLOY") {
    Write-Host "Deploy cancelled. No Function was published."
    exit 0
  }
}

foreach ($functionName in $AffectedFunctions) {
  Write-Host "Deploying $functionName..."
  & npx supabase functions deploy $functionName
  if ($LASTEXITCODE -ne 0) {
    throw "Deploy failed for $functionName."
  }
}

Write-Host "Staging Function deploy completed."
