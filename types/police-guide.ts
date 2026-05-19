export type PoliceGuideDetail = {
  atcId: string;
  source?: "police" | "portal";
  sequence?: string | null;
  detailUrl: string;
  itemName?: string | null;
  foundDateTime?: string | null;
  foundPlace?: string | null;
  category?: string | null;
  status?: string | null;
  detailDescription?: string | null;
  visitNotice?: string | null;
  receiptPlace?: string | null;
  storagePlace?: string | null;
  storagePhone?: string | null;
  managementNumber?: string | null;
};

export type PoliceGuideResponse = {
  detail: PoliceGuideDetail;
  guidance: string;
  usedFallback: boolean;
};
