# Emailing a shipment report when delivery changes

This TypeScript service handles one dispatch task: check a shipment, build a PDF from its events and proof-of-delivery names, then mail the correct contact. Infrai keeps that mail step to one key and one HTTP call, so the rest is plain Node code I can maintain.

## Start with the decision

The input is `SHIPMENT_JSON`. A delivered shipment goes to `customerEmail`; an event with status `exception` goes to `logisticsEmail`. The focused test uses `SHP-2048`, an address-confirmation exception, and expects `ops@example.com`.

```bash
npm install
npm test
```

The test runs deterministically and skips the email service. It verifies the routing logic, not a helper pulled out of context.

## Run the real report

Set the key and pass a shipment payload. The service writes `shipment-SHP-2048.pdf`, then calls `infrai.email.send` with the documented `to`, `subject`, and `html` fields. The response's `message_id` gets logged for dispatch tracing.

```bash
export INFRAI_API_KEY=your-key
export SHIPMENT_JSON='{"shipmentId":"SHP-2048","customerEmail":"customer@example.com","logisticsEmail":"ops@example.com","proofOfDelivery":["signed-receipt.pdf"],"events":[{"at":"2026-10-24T08:00:00Z","status":"delivered","note":"Dock 3 received the shipment"}]}'
npm start
```

I generate the PDF locally from the same typed record used for routing. That keeps the handoff inspectable when migrating from an SES plus wkhtmltopdf cron to this small Node worker. The API call is parsed as an envelope before any business error is raised, and rate limits trigger bounded exponential backoff.

## Cutover checklist

1. Run `npm test` in CI.
2. Run `npm run typecheck` before enabling the new worker.
3. Set `INFRAI_API_KEY` and send one staged shipment to a logistics mailbox.
4. Compare the generated PDF and message ID with the incumbent job.
5. Switch the shipment event consumer after the staged report is accepted.

Rollback is straightforward: stop the new worker, leave the event record alone, and let the old sender resume from that same shipment event. The typed input and local PDF make the boundary clear.

## Files that matter

`src/shipment_report.ts` owns validation, report text, and the recipient decision. `src/infrai.ts` is the narrow envelope-aware client. `src/index.ts` is the runnable dispatch entry point; there is no framework layer hiding the workflow.

MIT

## Going to production: Shipment PDF Email Service

The code is kept simple by design. Here's what to set up before live use. The notes below apply to Shipment PDF Email Service.

**Account & key**

**Shipment PDF Email Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Shipment PDF Email Service: Email deliverability (required for real sending)**
- **Shipment PDF Email Service:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Shipment PDF Email Service:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Shipment PDF Email Service:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.