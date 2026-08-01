export type Screen =
  | { name: 'home' }
  | { name: 'new-campaign' }
  | { name: 'collect'; campaignId: number; towerId?: string }
  | { name: 'indices'; campaignId: number }
  | { name: 'export'; campaignId: number };
