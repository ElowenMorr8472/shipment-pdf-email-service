import { writeFile } from "node:fs/promises";
import { infrai } from "./infrai.ts";
import { buildPdf, emailForShipment, parseShipment } from "./shipment_report.ts";

const input = process.env.SHIPMENT_JSON;
if (!input) throw new Error("SHIPMENT_JSON is required");
const shipment = parseShipment(JSON.parse(input));
const pdf = buildPdf(shipment);
const output = `shipment-${shipment.shipmentId}.pdf`;
await writeFile(output, pdf);
const sent = await infrai.email.send(emailForShipment(shipment));
console.log(JSON.stringify({ output, message_id: sent.message_id }));
