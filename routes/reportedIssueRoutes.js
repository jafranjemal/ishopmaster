const express = require('express');
const router = express.Router();
const ReportedIssueController = require('../controllers/ReportedIssueController');

router.post('/', ReportedIssueController.createReportedIssue);
router.get('/', ReportedIssueController.getAllReportedIssues);
router.get('/:id', ReportedIssueController.getReportedIssueById);
router.put('/:id', ReportedIssueController.updateReportedIssue);
router.delete('/:id', ReportedIssueController.deleteReportedIssue);

module.exports = router;