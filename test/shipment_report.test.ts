import assert from "node:assert/strict";
import { emailForShipment, hasException, parseShipment } from "../src/shipment_report.ts";

const shipment = parseShipment({
  shipmentId: "SHP-2048",
  customerEmail: "customer@example.com",
  logisticsEmail: "ops@example.com",
  proofOfDelivery: ["signed-receipt.pdf"],
  events: [{ at: "2026-10-24T08:00:00Z", status: "exception", note: "Address needs confirmation" }]
});

assert.equal(hasException(shipment), true);
assert.equal(emailForShipment(shipment).to, "ops@example.com");
assert.match(emailForShipment(shipment).subject, /^Exception report/);
console.log("exception shipments are routed to logistics users");
