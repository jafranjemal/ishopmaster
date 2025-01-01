const Account = require("../models/Account");
const Employee = require("../models/Employee");

// Create a new employee
exports.createEmployee = async (req, res) => {
    try {
      const { name, email, phone, address, roles, salary_type, fixed_salary, hourly_rate, allowances, deductions } = req.body;
  
      // Create the employee
      const employee = new Employee({
        name,
        email,
        phone,
        address,
        roles,
        salary_type,
        fixed_salary,
        hourly_rate,
        allowances,
        deductions,
      });
  
      await employee.save();
  
      // Create the employee account for salary tracking
      const employeeAccount = new Account({
        account_name: `${name}'s Salary Account (${employee.employee_id})`, // Dynamic account name
        account_type: "Salary", // This could be any other account type depending on your use case
        account_owner_type: "Employee",
        related_party_id: employee._id, // Linking to the Employee's ID
        balance: 0, // Initial balance can be 0, or you can set an initial deposit if needed
        description: `Salary account for employee ${name}`,
      });
  
      await employeeAccount.save();
  
      // Link the employee account to the employee record (optional)
     // employee.account_id = employeeAccount._id; // Assuming you want to store the account in the employee record
     // await employee.save();
  
      res.status(201).json({ message: "Employee created successfully with an account", employee });
    } catch (error) {
      res.status(500).json({ message: "Error creating employee or account", error });
    }
  };
  

// Get all employees
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find();
    res.status(200).json(employees);
  } catch (error) {
    res.status(500).json({ message: "Error fetching employees", error });
  }
};

// Get a single employee by ID
exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.status(200).json({ employee });
  } catch (error) {
    res.status(500).json({ message: "Error fetching employee", error });
  }
};

// Update an employee
exports.updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.status(200).json({ message: "Employee updated successfully", employee });
  } catch (error) {
    res.status(500).json({ message: "Error updating employee", error });
  }
};

// Delete an employee
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting employee", error });
  }
};
