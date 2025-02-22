const ReportedIssue = require('../models/ReportedIssue');

class ReportedIssueController {
  // Create a new reported issue
  static async createReportedIssue(req, res) {
    try {
      const newIssue = new ReportedIssue(req.body);
      await newIssue.save();
      res.status(201).json(newIssue);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Get all reported issues
  static async getAllReportedIssues(req, res) {
    try {
      const issues = await ReportedIssue.aggregate([
        {
          $addFields: {
            issueLength: { $strLenCP: "$issue" }
          }
        },
        {
          $sort: { issueLength: 1 }
        }
      ]);
      res.status(200).json(issues);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Get a reported issue by ID
  static async getReportedIssueById(req, res) {
    try {
      const issue = await ReportedIssue.findById(req.params.id);
      if (!issue) {
        return res.status(404).json({ message: 'Reported issue not found' });
      }
      res.status(200).json(issue);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Update a reported issue by ID
  static async updateReportedIssue(req, res) {
    try {
      const updatedIssue = await ReportedIssue.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updatedIssue) {
        return res.status(404).json({ message: 'Reported issue not found' });
      }
      res.status(200).json(updatedIssue);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Delete a reported issue by ID
  static async deleteReportedIssue(req, res) {
    try {
      const deletedIssue = await ReportedIssue.findByIdAndDelete(req.params.id);
      if (!deletedIssue) {
        return res.status(404).json({ message: 'Reported issue not found' });
      }
      res.status(200).json({ message: 'Reported issue deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = ReportedIssueController;