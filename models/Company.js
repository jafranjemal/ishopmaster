const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  company_name: { type: String, required: true },
  company_type: {
    type: String,
    enum: ["LLC", "Sole Proprietorship", "Corporation", "Partnership", "Other", "Retail"],
    required: true
  },
  contact_person: { type: String, required: true },
  email: { type: String, required: true },
  phone_number: { type: String, required: true },
  address: { type: String, required: true },
  tax_id: { type: String },  // Optional, for tax identification
  registration_number: { type: String },  // Optional, for legal purposes
  company_logo: { type: String },  // Optional, for legal purposes
  company_logo_public_id: { type: String }, // Cloudinary Public ID
  company_fb_link: { type: String },  // Optional, for legal purposes
  company_instagram_link: { type: String },  // Optional, for legal purposes
  company_tiktok_link: { type: String },  // Optional, for legal purposes
  // Invoice Visual Settings
  invoice_show_logo: { type: Boolean, default: true },
  invoice_show_company_name: { type: Boolean, default: true },
  invoice_show_address: { type: Boolean, default: true },
  invoice_show_phone: { type: Boolean, default: true },
  invoice_show_email: { type: Boolean, default: true },
  invoice_show_initials: { type: Boolean, default: true },

  invoice_text_align_header: { type: String, default: "left" },
  invoice_date_format: { type: String, default: "DD/MM/YYYY" },

  invoice_header_color: { type: String, default: "#0000ff" },
  invoice_header_padding: { type: Number, default: 20 },
  invoice_logo_height: { type: Number, default: 50 },
  invoice_header_layout: { type: String, enum: ["vertical", "horizontal"], default: "vertical" },
  invoice_header_gap: { type: Number, default: 50 },
  invoice_hide_company_header: { type: Boolean, default: false },
  invoice_name_prefix_logic: { type: Boolean, default: true },
  invoice_footer_padding: { type: Number, default: 10 },

  invoice_font_size_header: { type: Number, default: 24 },
  invoice_font_size_address: { type: Number, default: 11 },

  // Invoice Footer
  invoice_footer_terms: { type: String },
  invoice_footer_note: { type: String },
  invoice_footer_height: { type: Number, default: 15 },
  invoice_footer_font_size: { type: Number, default: 7 },
  invoice_show_signature_prepared: { type: Boolean, default: true },
  invoice_show_signature_customer: { type: Boolean, default: true },
  invoice_show_signature_issued: { type: Boolean, default: true },
  invoice_text_align_footer: { type: String, default: "center" },

  // Invoice Global Borders
  invoice_border_color: { type: String, default: "#333333" },
  invoice_border_width: { type: Number, default: 1 },

  // Invoice Section Borders
  invoice_header_border_color: { type: String, default: "#333333" },
  invoice_header_border_width: { type: Number, default: 1 },
  invoice_header_bottom_offset: { type: Number, default: 5 },

  invoice_customer_border_color: { type: String, default: "#333333" },
  invoice_customer_border_width: { type: Number, default: 1 },
  invoice_show_customer_border: { type: Boolean, default: true },

  // Invoice Dimensions
  invoice_header_height: { type: Number, default: 25 },
  invoice_body_min_height: { type: Number, default: 100 },

  // Invoice Pagination
  invoice_rows_per_page: { type: Number, default: 7 },
  invoice_row_height: { type: String, default: "auto" },

  // Invoice Print
  invoice_paper_size: { type: String, default: "A5" },
  invoice_orientation: { type: String, default: "landscape" },

  // Invoice Table
  invoice_table_border_color: { type: String, default: "#333333" },
  invoice_table_border_width: { type: Number, default: 1 },

  invoice_show_table_header: { type: Boolean, default: true },
  invoice_show_table_header_border: { type: Boolean, default: true },
  invoice_show_table_body_borders: { type: Boolean, default: true },
  invoice_show_table_column_borders: { type: Boolean, default: true },
  invoice_show_table_outer_border: { type: Boolean, default: true },

  invoice_table_header_bg: { type: String, default: "#f5f5f5" },
  invoice_table_header_color: { type: String, default: "#000000" },
  invoice_table_header_font_size: { type: Number, default: 9 },

  invoice_show_brand_attribution: { type: Boolean, default: true },

  column_visibility: { type: Object, default: {} },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },

  // Invoice Totals Visibility
  invoice_show_total_items: { type: Boolean, default: true },
  invoice_show_subtotal: { type: Boolean, default: true },
  invoice_show_discount: { type: Boolean, default: true },
  invoice_show_net_total: { type: Boolean, default: true },
  invoice_show_due: { type: Boolean, default: true },

  // Invoice Footer Visibility
  invoice_show_footer_terms: { type: Boolean, default: true },
  invoice_show_footer_note: { type: Boolean, default: true },
  invoice_show_footer_signatures: { type: Boolean, default: true },

  invoice_footer_line_height: { type: Number, default: 1.0 },
  invoice_terms_align: { type: String, default: "left" },

  // Cloudinary Configuration (Company Specific)
  cloudinary_cloud_name: { type: String },
  cloudinary_api_key: { type: String },
  cloudinary_api_secret: { type: String }, // SERVER-SIDE ONLY - NEVER EXPOSE
  cloudinary_upload_preset: { type: String },
  cloudinary_folder: { type: String, default: "shop-erp" },
});

const Company = mongoose.model("Company", companySchema);
module.exports = Company;
