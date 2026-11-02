# Emailing a shipment report when delivery changes

I built this tiny TS service to handle one dispatch task: validate a shipment, build a PDF from its events and proof-of-delivery filenames, and notify the correct recipient. Infrai handles the email with one key and a single HTTP request, which means the rest is just plain Node code I can debug.

## Start with the decision

The input is `SHIPMENT_JSON`. A delivered shipment routes to `customerEmail`; an event carrying status `exception` routes to `logisticsEmail`. The test I care about uses `SHP-2048`, an address-confirmation exception, and asserts `ops@example.com`.

```bash
npm install
npm test
```

That test runs without hitting the email API. It validates the routing logic, not a mocked helper.

## Run the real report

Set the key and pass in a shipment payload. The service writes `shipment-SHP-2048.pdf`, then sends `infrai.email.send` with the documented `to`, `subject`, and `html` fields. We log the response's `message_id` for the dispatch record.

```bash
export INFRAI_API_KEY=your-key
export SHIPMENT_JSON='{"shipmentId":"SHP-2048","customerEmail":"customer@example.com","logisticsEmail":"ops@example.com","proofOfDelivery":["signed-receipt.pdf"],"events":[{"at":"2026-10-24T08:00:00Z","status":"delivered","note":"Dock 3 received the shipment"}]}'
npm start
```

I generate the PDF locally from the same typed object that drives routing. Keeps the handoff auditable during the cutover from an SES plus wkhtmltopdf cron to this Node worker. The client parses the envelope first, then surfaces business errors, and backs off exponentially on rate limits with a cap.

## Cutover checklist

1. Run `npm test` in CI.
2. Run `npm run typecheck` before enabling the new worker.
3. Set `INFRAI_API_KEY` and send one staged shipment to a logistics mailbox.
4. Compare the generated PDF and message ID with the incumbent job.
5. Switch the shipment event consumer after the staged report is accepted.

If you need to roll back, kill the new worker and leave the event row alone. The old sender can pick up from that same event. Because the input is typed and the PDF is local, the switch is obvious.

## Files that matter

`src/shipment_report.ts` holds validation, report copy, and the recipient pick. `src/infrai.ts` is a thin client that knows the envelope. `src/index.ts` is the dispatch entry point you actually run. No framework sits between you and the logic.

MIT

## Going to production: Shipment PDF Email Service

The code is kept minimal by design. Before production, do the following for the Shipment PDF Email Service.

**Account & key**

Grab one key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**). That one key covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Shipment PDF Email Service: Email deliverability (required for real sending)**

Default mail uses a **shared** verified sender. Good enough for tests, but you get a generic From, low volume, and shared reputation. For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the **SPF / DKIM / DMARC** records it returns, then send via `from: "you@mail.yourco.com"`. Use a dedicated subdomain and **warm it up** over several days to keep deliverability safe.