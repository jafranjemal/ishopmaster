const mongoose = require("mongoose");

const WarrantySchema = new mongoose.Schema({
    warranty_id: { type: String, unique: true },
    invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: "SalesInvoice", required: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    serial_number: { type: String }, // Optional for non-serialized
    item_name: { type: String },
    type: { type: String, enum: ["Product", "Service"], required: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    duration_days: { type: Number },
    status: {
        type: String,
        enum: ["Active", "Claimed", "Expired", "Voided"],
        default: "Active"
    },
    claims: [{
        ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket" },
        claim_date: { type: Date },
        reason: { type: String },
        outcome: { type: String }
    }],
    warranty_proof_image: { type: String },
    notes: { type: String }
}, { timestamps: true });

async function generateWarrantyId() {
    const last = await this.constructor.findOne().sort("-createdAt");
    const count = last && last.warranty_id ? parseInt(last.warranty_id.split("-")[1]) + 1 : 1;
    return `WRNTY-${String(count).padStart(8, "0")}`;
}

WarrantySchema.pre("save", async function (next) {
    if (!this.isNew) return next();
    this.warranty_id = await generateWarrantyId.call(this);
    next();
});

module.exports = mongoose.model("Warranty", WarrantySchema);
