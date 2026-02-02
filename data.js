const DASHBOARD_DATA = {
    "config": {
        "AIRPORT_GROWTH_PCT": 12.5,
        "AIRPORT_TARGET_GROWTH": 14.2,
        "AIRPORT_BUDGET_GROWTH": 13.5,
        "MARKET_SHARE_TARGET": 15.8,
        "MARKET_SHARE_BUDGET": 15.1,
        "REVENUE_TARGET_GROWTH": 18.0,
        "REVENUE_BUDGET_GROWTH": 16.5,
        "DATA_VERSION": "1.3.3"
    },
    "products": {
        "Standard": [
            { "id": "101", "name": "Vuxen Enkel", "price": 340, "paxCount": 1, "cat": "Standard" },
            { "id": "102", "name": "Vuxen T&R", "price": 640, "paxCount": 1, "cat": "Standard", "isReturn": true }
        ],
        "Group": [
            { "id": "224", "name": "2 för", "price": 480, "paxCount": 2, "cat": "Group" },
            { "id": "335", "name": "3 för", "price": 580, "paxCount": 3, "cat": "Group" },
            { "id": "446", "name": "4 för", "price": 700, "paxCount": 4, "cat": "Group" }
        ],
        "Discount": [
            { "id": "103", "name": "Ungdom", "price": 160, "paxCount": 1, "cat": "Discount" },
            { "id": "104", "name": "Ungdom T&R", "price": 300, "paxCount": 1, "cat": "Discount", "isReturn": true },
            { "id": "107", "name": "Pensionär", "price": 210, "paxCount": 1, "cat": "Discount" }
        ],
        "Commuter": [
            { "id": "1000", "name": "Resepott", "price": 3670, "paxCount": 1, "cat": "Commuter" }
        ]
    },
    "hierarchy": {
        "Direct": {
            "TVM": ["Arlanda", "Central station"],
            "WEB": ["Standard"],
            "APP": ["IOS", "Android"],
            "ARN T5": ["Standard"]
        },
        "Special": {
            "Staff tickets": ["Standard"],
            "Arlanda employees": ["Standard"]
        },
        "Partner": {
            "Airlines": ["SAS", "Norwegian"],
            "B2B": {
                "Distributor web": ["Polisen", "Myndighet"],
                "Corporate offer": ["Martin & Servera", "Svenska Spel"],
                "Manual registration": ["Mcinsey", "eventX"]
            },
            "Flygtaxi": ["Amex", "Omni"],
            "Samtrafiken": ["SJ", "Silverrail", "VY"]
        }
    }
};
