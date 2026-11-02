import { z } from "zod";

const eventSchema = z.object({
  at: z.string().min(1),
  status: z.enum(["picked_up", "in_transit", "delivered", "exception"]),
  note: z.string().min(1)
});

export const shipmentSchema = z.object({
  shipmentId: z.string().min(1),
  customerEmail: z.string().email(),
  logisticsEmail: z.string().email(),
  proofOfDelivery: z.array(z.string().min(1)),
  events: z.array(eventSchema).min(1)
});

export type Shipment = z.infer<typeof shipmentSchema>;

export function parseShipment(input: unknown): Shipment {
  return shipmentSchema.parse(input);
}

export function hasException(shipment: Shipment): boolean {
  return shipment.events.some((event) => event.status === "exception");
}

export function buildPdf(shipment: Shipment): Buffer {
  const lines = [
    "Shipment report",
    `Shipment: ${shipment.shipmentId}`,
    `Proof files: ${shipment.proofOfDelivery.join(", ") || "none"}`,
    "Events:",
    ...shipment.events.map((event) => `${event.at} | ${event.status} | ${event.note}`)
  ];
  const body = lines.join("\\n");
  const pdf = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n%% ${body}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

export function emailForShipment(shipment: Shipment): { to: string; subject: string; html: string } {
  const exception = hasException(shipment);
  return {
    to: exception ? shipment.logisticsEmail : shipment.customerEmail,
    subject: `${exception ? "Exception" : "Delivery"} report for ${shipment.shipmentId}`,
    html: `<p>Shipment <strong>${shipment.shipmentId}</strong> has ${exception ? "an exception requiring review" : "a delivery update"}.</p><p>The generated PDF report is ready for your dispatch record.</p>`
  };
}
