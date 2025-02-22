const mongoose = require('mongoose');

const reportedIssueSchema = new mongoose.Schema({
  issue: {
    type: String,
    required: true,
    unique: true,
  },
});

const ReportedIssue = mongoose.model('ReportedIssue', reportedIssueSchema);
module.exports = ReportedIssue;