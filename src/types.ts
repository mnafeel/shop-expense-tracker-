export interface BillItem {
  id: string;
  itemName: string;
  price: number;
}

export interface ItemBill {
  id: string;
  shopName: string;
  savedAt: string;
  updatedAt: string;
  items: BillItem[];
}

export interface LabourEntry {
  id: string;
  description: string;
  amount: number;
  addedAt: string;
}

export interface AppData {
  itemBills: ItemBill[];
  labour: LabourEntry[];
}
