/** Labels and the dropdown suggestion lists. All dropdowns also accept custom values. */

export const CONDITION_LABEL = { brand_new: "Brand New", foreign_used: "Foreign Used", nigerian_used: "Nigerian Used" } as const;
export const AVAILABILITY_LABEL = { available: "Available", reserved: "Reserved", sold: "Sold", out_of_stock: "Out of Stock" } as const;
export const ORDER_STATUS_LABEL = { pending: "Pending Confirmation", confirmed: "Confirmed", processing: "Processing", completed: "Completed", cancelled: "Cancelled" } as const;
export const ORDER_PAYMENT_LABEL = { pending: "Pending", paid: "Paid", failed: "Failed", refunded: "Refunded" } as const;
export const SALE_PAYMENT_LABEL = { unpaid: "Unpaid", partially_paid: "Partially Paid", fully_paid: "Fully Paid" } as const;
export const PAYMENT_METHOD_LABEL = { bank_transfer: "Bank transfer", cash: "Cash", pos: "POS", online: "Online payment", other: "Other" } as const;
export const COMMISSION_STATUS_LABEL = { pending: "Pending", approved: "Approved", paid: "Paid", cancelled: "Cancelled" } as const;
export const AGENT_STATUS_LABEL = { pending: "Pending approval", approved: "Approved", suspended: "Suspended" } as const;
export const ADMIN_ROLE_LABEL = { owner: "Owner", manager: "Manager", sales: "Sales staff" } as const;
export const IMAGE_KIND_LABEL = { front: "Front", rear: "Rear", side: "Side", interior: "Interior", dashboard: "Dashboard", engine: "Engine", other: "Other" } as const;
export const EXPENSE_CATEGORY_LABEL = {
  vehicle_purchase: "Vehicle purchase", transportation: "Transportation", repairs: "Repairs", customs: "Customs",
  marketing: "Marketing", office: "Office expenses", staff: "Staff expenses", agent_commissions: "Agent commissions",
  maintenance: "Maintenance", other: "Other expenses",
} as const;

export const BRANDS = ["Toyota", "Lexus", "Honda", "Mercedes-Benz", "Mercedes-AMG", "BMW", "Audi", "Land Rover", "Porsche", "Ford", "Hyundai", "Kia", "Nissan", "Volkswagen", "Tesla", "Lamborghini", "Peugeot", "Mitsubishi", "Jeep", "Acura", "Infiniti", "Volvo"];
export const CATEGORIES = ["Sedan", "SUV", "Coupe", "Luxury", "Sports", "Pickup", "Bus", "Hatchback", "Electric"];
export const BODY_TYPES = ["Sedan", "SUV", "Coupe", "Hatchback", "Convertible", "Pickup", "Wagon", "Van", "Crossover", "Fastback"];
export const TRANSMISSIONS = ["Automatic", "Manual", "CVT", "Dual-clutch"];
export const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Electric", "CNG"];
export const DRIVE_TYPES = ["FWD", "RWD", "AWD", "4WD"];
export const ENGINE_TYPES = ["Inline-4", "Inline-6", "V6", "V8", "V10", "V12", "Turbocharged Inline-4", "Electric motor", "Hybrid"];
export const STEERING = ["Left-hand drive", "Right-hand drive"];
export const COLORS = [
  { name: "Black", hex: "#111111" }, { name: "White", hex: "#f5f5f2" }, { name: "Silver", hex: "#c0c3c7" },
  { name: "Grey", hex: "#6b6e73" }, { name: "Blue", hex: "#1f4e8c" }, { name: "Red", hex: "#a51f24" },
  { name: "Green", hex: "#2f5d3a" }, { name: "Brown", hex: "#5a3d2b" }, { name: "Gold", hex: "#c8a96a" },
  { name: "Orange", hex: "#e8731c" }, { name: "Yellow", hex: "#f2c418" }, { name: "Beige", hex: "#d8c7a6" },
];

/** Default feature suggestions; editable in Admin → Settings. */
export const DEFAULT_FEATURES = [
  "Leather seats", "Sunroof", "Navigation", "Reverse camera", "Parking sensors", "Bluetooth", "Apple CarPlay",
  "Android Auto", "Cruise control", "Automatic climate control", "Power seats", "Keyless entry",
  "Adaptive cruise control", "Lane keep assist", "Blind-spot monitoring", "Heated seats", "Premium sound system",
  "360° camera", "Push-button start", "Alloy wheels",
];

export const PAGE_SIZE = 12;
export const ADMIN_PAGE_SIZE = 20;
