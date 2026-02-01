export const defaultPolicies = [
    {
        name: "Standard Used (30D/60D)",
        phase1_days: 30, // Replacement
        phase2_days: 60, // Service
        terms_list: [
            "No water damage or liquid intake",
            "No physical damage to screen or body",
            "Warranty seal must be intact",
            "No software rooting or unofficial ROMs"
        ]
    },
    {
        name: "Standard Used (1M Replacement + 2M Service)",
        phase1_days: 30, // Month 1: Phone-to-Phone Replacement
        phase2_days: 60, // Month 2 & 3: Service Only (Total 90 days)
        terms_list: [
            "Phase 1 (Day 1-30): Full device replacement for hardware failure.",
            "Phase 2 (Day 31-90): Free technical service/labor only.",
            "Phase 2 Note: Any hardware parts (Battery, LCD, etc.) are billable to the customer.",
            "Warranty void if physical damage, water intake, or seal tampering is found."
        ]
    },
    {
        name: "Brand New (Apple/Samsung Official)",
        phase1_days: 7, // Shop Check Warranty
        phase2_days: 358, // Remaining Year Service
        terms_list: [
            "Subject to Brand Center approval",
            "Original box and accessories required for claim",
            "Physical damage voids all terms"
        ]
    },
    {
        name: "Battery/Accessories (90D)",
        phase1_days: 90,
        phase2_days: 0,
        terms_list: ["Full replacement for swelling or backup issues"]
    },
    {
        name: "No Warranty (Sales Only)",
        phase1_days: 0,
        phase2_days: 0,
        terms_list: ["Checked and verified at the time of sale"]
    }
];