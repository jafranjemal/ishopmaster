const mongoose = require("mongoose");




const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  employee_id: { type: String},
  email: { type: String,   unique: true },
  phone: { type: String, required: true },
  address: { type: String },
     roles: [{ 
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Role'
     }],
  salary_type: { 
    type: String, 
    enum: ["Fixed", "Task-Based"], 
    required: true 
  },
  fixed_salary: { type: Number, default: 0 }, // Only for Fixed Salary employees
  hourly_rate: { type: Number, default: 0 }, // Only for Task-Based employees
  allowances: { type: Number, default: 0 }, // Monthly Allowances
  deductions: { type: Number, default: 0 }, // Monthly Deductions
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

async function generateEmployeeId() {
  const lastEmployee = await this.constructor.findOne().sort("-created_at");
  const currentId = lastEmployee
    ? parseInt(lastEmployee.employee_id.replace("EMP-", ""), 10)
    : 0;
  const newId = currentId + 1;
  return `EMP-${String(newId).padStart(6, "0")}`;
}

employeeSchema.pre("save", async function (next) {
    if (!this.isNew) return next(); // Skip if the document is not new
  
    try {
        this.employee_id = await generateEmployeeId.call(this);
        next();
      } catch (error) {
        next(error);
      }
 
  });


const Employees  = mongoose.model("Employees", employeeSchema);
module.exports  = Employees;
