// Mock test data for the local practice app.
// Everything here is fictional practice data - never put real company data,
// real user names or real passwords in this file.

const ALL_MODULES = [
  'accounts', 'vendors', 'products', 'recipes', 'menu',
  'purchase', 'inventory', 'workflow', 'notifications', 'revenue',
];

module.exports = {
  users: [
    {
      key: 'qa',
      username: 'qa_user',
      password: 'Practice#2026',
      displayName: 'QA User',
      profile: 'Site Manager',
      roles: ['Menu Planner', 'Buyer', 'Approver'],
      modules: ALL_MODULES,
      accounts: ['ACC-100'],
      locations: ['LOC-1', 'LOC-2'],
    },
    {
      key: 'limited',
      username: 'limited_user',
      password: 'Practice#2026',
      displayName: 'Limited User',
      profile: 'Inventory Clerk',
      roles: ['Counter'],
      modules: ['inventory', 'workflow'],
      accounts: ['ACC-100'],
      locations: ['LOC-1'],
    },
  ],

  accounts: [
    { id: 'ACC-100', name: 'Demo School District' },
    { id: 'ACC-200', name: 'Sample Hospital Group' },
  ],

  locations: [
    { id: 'LOC-1', accountId: 'ACC-100', name: 'North Campus Kitchen', type: 'School', mealPeriod: 'Lunch' },
    { id: 'LOC-2', accountId: 'ACC-100', name: 'South Campus Cafe', type: 'Cafe', mealPeriod: 'Breakfast' },
    { id: 'LOC-3', accountId: 'ACC-200', name: 'Main Wing Kitchen', type: 'Hospital', mealPeriod: 'Lunch' },
  ],

  vendors: [
    {
      id: 'VEN-10',
      name: 'Fresh Farms Supply',
      status: 'Active',
      productLines: ['Produce', 'Dairy'],
      locations: ['LOC-1', 'LOC-2'],
    },
    {
      id: 'VEN-20',
      name: 'Hospital Linen Co',
      status: 'Active',
      productLines: ['Linen'],
      locations: ['LOC-3'],
    },
  ],

  products: [
    {
      id: 'PRD-501', name: 'Whole Milk 1L', type: 'Purchased', category: 'Dairy', productLine: 'Dairy',
      purchaseUnit: 'Case (12)', inventoryUnit: 'Each', locationTypes: ['School', 'Cafe'],
      mealTypes: ['Breakfast', 'Lunch'], canBeMenued: true, menuUnit: 'Carton',
    },
    {
      id: 'PRD-502', name: 'Carrots 5kg', type: 'Purchased', category: 'Vegetables', productLine: 'Produce',
      purchaseUnit: 'Bag (5kg)', inventoryUnit: 'kg', locationTypes: ['School'],
      mealTypes: ['Lunch'], canBeMenued: false, menuUnit: '',
    },
  ],

  recipes: [
    {
      id: 'RCP-701', name: 'Veg Pasta', type: 'Standard', mealType: 'Lunch', yield: 10, notes: '',
      workflowStatus: 'Approved',
      components: [
        { name: 'Carrots', qty: 0.5, unit: 'kg' },
        { name: 'Pasta', qty: 1.25, unit: 'kg' },
      ],
      nutrition: { calories: 420, protein: 14, 'crediting-grain': 2, 'crediting-vegetable': 0.5 },
    },
    {
      id: 'RCP-702', name: 'Breakfast Box', type: 'Finished Meal', mealType: 'Breakfast', yield: 1, notes: '',
      workflowStatus: 'Pending',
      components: [
        { name: 'Whole Milk 1L', qty: 1, unit: 'Carton' },
        { name: 'Wholegrain Muffin', qty: 1, unit: 'Each' },
      ],
      nutrition: { calories: 380, protein: 12, 'crediting-grain': 1, 'crediting-vegetable': 0 },
    },
  ],

  // Saved menus, keyed by "<locationId>|<YYYY-MM-DD>". 2030 dates keep practice data away from "today".
  menus: {
    'LOC-1|2030-01-10': ['PRD-501', 'RCP-701'],
  },

  orderGuides: [
    { id: 'OG-1', accountId: 'ACC-100', name: 'Demo School Weekly Guide', products: ['PRD-501', 'PRD-502'] },
  ],

  orderGuideTemplates: [
    { id: 'TPL-1', name: 'Weekly Dairy Template', active: true },
    { id: 'TPL-2', name: 'Legacy 2019 Template', active: false },
  ],

  inventory: {
    'LOC-1': { storageAreas: ['Dry Store', 'Walk-in Cooler'], counts: [{ productId: 'PRD-501', qty: 24 }, { productId: 'PRD-502', qty: 6 }] },
    'LOC-2': { storageAreas: ['Cafe Fridge'], counts: [{ productId: 'PRD-501', qty: 10 }] },
    'LOC-3': { storageAreas: ['Main Store'], counts: [] },
  },

  transactions: [
    { id: 'TXN-9001', type: 'Recipe approval', reference: 'RCP-702', assignee: 'qa', state: 'todo', status: 'Pending approval' },
    { id: 'TXN-9002', type: 'Order guide change', reference: 'OG-1', assignee: 'qa', state: 'active', status: 'In review' },
    { id: 'TXN-9003', type: 'Recipe approval', reference: 'RCP-701', assignee: 'qa', state: 'completed', status: 'Approved' },
  ],

  notificationConfig: [
    { event: 'Order guide change request', recipient: 'qa-recipient@example.test', channel: 'Email (mock outbox)', enabled: true },
    { event: 'Recipe change', recipient: 'qa-recipient@example.test', channel: 'Email (mock outbox)', enabled: false },
  ],

  revenueCategories: ['Breakfast', 'Lunch', 'A la carte'],
};
