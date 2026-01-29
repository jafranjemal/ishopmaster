const express = require("express");
const router = express.Router();
const warrantyPolicyController = require("../controllers/warrantyPolicyController");

router.get("/", warrantyPolicyController.getPolicies);
router.post("/", warrantyPolicyController.createPolicy);
router.put("/:id", warrantyPolicyController.updatePolicy);
router.delete("/:id", warrantyPolicyController.deletePolicy);

module.exports = router;
