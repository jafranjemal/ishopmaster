 
const Account = require("../models/Account");
const Employees = require("../models/Employee");
 

// Create a new employee
exports.createEmployee = async (req, res, next) => {
    try {
      const { name, email, phone, address, roles, salary_type, fixed_salary, hourly_rate, allowances, deductions } = req.body;
  
      // Create the employee
      const employee = new Employees({
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
        account_name: `${name}'s Salary Account (${employee?.employee_id})`, // Dynamic account name
        account_type: "Salary", // This could be any other account type depending on your use case
        account_owner_type: "Employees",
        related_party_id: employee._id, // Linking to the Employees's ID
        balance: 0, // Initial balance can be 0, or you can set an initial deposit if needed
        description: `Salary account for employee ${name}`,
      });
  
      console.log("employeeAccount",employeeAccount)
      await employeeAccount.save();
  
      // Link the employee account to the employee record (optional)
     // employee.account_id = employeeAccount._id; // Assuming you want to store the account in the employee record
     // await employee.save();
  
      res.status(201).json({ message: "Employees created successfully with an account", employee });
    } catch (error) {
      next(error);
     // res.status(500).json({ message: "Error creating employee or account", error });
    }
  };
  

// Get all employees
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await Employees.find();
    res.status(200).json(employees);
  } catch (error) {
    res.status(500).json({ message: "Error fetching employees", error });
  }
};

// Get a single employee by ID
exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await Employees.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employees not found" });
    }
    res.status(200).json(employee);
  } catch (error) {
    res.status(500).json({ message: "Error fetching employee", error });
  }
};

/**
 * Updates an employee by ID.
 *
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @returns {Promise<void>}
 */
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate the request body
    if (!req.body) {
      return res.status(400).json({ error: "Request body is required" });
    }

    console.log(req.body);

    // Update the employee
    const updatedEmployee = await Employees.findByIdAndUpdate(id, req.body, { new: true });

    // Check if the employee exists
    if (!updatedEmployee) {
      return res.status(404).json({ error: "Employees not found" });
    }

    console.log("Updated employee:", updatedEmployee);

    // Return the updated employee
    res.status(200).json(updatedEmployee);
  } catch (error) {
    // Log the error for debugging purposes
    console.error("Error updating employee:", error);

    // Return a generic error message to the client
    const errorMessage = "Error updating employee";
    res.status(500).json({ error: errorMessage, details: error.message });
  }
};

// Delete an employee
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employees.findByIdAndDelete(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employees not found" });
    }
    res.status(200).json({ message: "Employees deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting employee", error });
  }
};
