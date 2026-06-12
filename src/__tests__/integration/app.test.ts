import request from "supertest";
import crypto from "node:crypto";
import app from "../../app.js";
import config from "../../config/config.js";

describe("App edge routes", () => {
  it("returns health status", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toMatch(/up and running/i);
    expect(res.body.timestamp).toBeDefined();
  });

  it("returns standardized 404 for unknown routes", async () => {
    const res = await request(app).get("/definitely-not-real");

    expect(res.status).toBe(404);
    expect(res.body.status).toBe("fail");
    expect(res.body.message).toBe("The requested resource was not found.");
  });

  it("rejects Paystack webhooks with invalid signature before body parsing", async () => {
    const res = await request(app)
      .post("/v1/webhooks/paystack")
      .set("x-paystack-signature", "bad-signature")
      .send({ event: "charge.success" });

    expect(res.status).toBe(400);
    expect(res.text).toBe("Invalid signature");
  });

  it("accepts signed non-charge Paystack webhooks", async () => {
    const payload = JSON.stringify({ event: "transfer.success", data: {} });
    const signature = crypto
      .createHmac("sha512", config.payments.paystackSecret)
      .update(payload)
      .digest("hex");

    const res = await request(app)
      .post("/v1/webhooks/paystack")
      .set("Content-Type", "application/json")
      .set("x-paystack-signature", signature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.text).toBe("Webhook Received");
  });
});
